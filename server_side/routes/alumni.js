'use strict';

const express = require('express');

const { prisma } = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

const router = express.Router();
const requireSponsorOrAdmin = authorizeRoles('ADMIN', 'SPONSOR');
const requireAdmin = authorizeRoles('ADMIN');

function dateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function inferSector(employment) {
  const company = (employment.company || '').toLowerCase();
  const role = (employment.role || '').toLowerCase();
  const text = `${company} ${role}`;

  if (/(software|developer|engineer|data|cloud|tech|it|systems)/.test(text)) return 'Technology';
  if (/(bank|finance|account|audit|insurance)/.test(text)) return 'Finance';
  if (/(school|university|teacher|lecturer|education)/.test(text)) return 'Education';
  if (/(hospital|health|medical|clinic)/.test(text)) return 'Healthcare';
  if (/(market|sales|brand|media|advertising)/.test(text)) return 'Marketing and sales';

  return 'Other / not recorded';
}

function matchAlumniFilters(user, filters) {
  const profile = user.profile || {};
  const degrees = Array.isArray(profile.degrees) ? profile.degrees : [];
  const employment = Array.isArray(profile.employment) ? profile.employment : [];

  if (filters.programme && !degrees.some(function (degree) {
    return degree.title === filters.programme;
  })) {
    return false;
  }

  if (filters.graduationDate && !degrees.some(function (degree) {
    return dateOnly(degree.completionDate) === filters.graduationDate;
  })) {
    return false;
  }

  if (filters.industrySector && !employment.some(function (entry) {
    return inferSector(entry) === filters.industrySector;
  })) {
    return false;
  }

  return true;
}

function buildAlumnusResponse(user) {
  const profile = user.profile || null;
  const employment = profile && Array.isArray(profile.employment) ? profile.employment : [];

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    appearanceCount: user.appearanceCount,
    createdAt: user.createdAt,
    industrySectors: Array.from(new Set(employment.map(inferSector))).sort(),
    profile: profile,
    bids: Array.isArray(user.bids)
      ? user.bids.map(function (bid) {
          return {
            id: bid.id,
            status: bid.status,
            bidDate: bid.bidDate,
            bidMonth: bid.bidMonth,
            bidYear: bid.bidYear,
            targetFeaturedDate: bid.targetFeaturedDate
          };
        })
      : []
  };
}

async function findAlumnusById(userId) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      role: 'ALUMNUS'
    },
    include: {
      profile: {
        include: {
          degrees: true,
          certifications: true,
          licences: true,
          courses: true,
          employment: true,
          specialisedAreas: true
        }
      },
      bids: {
        orderBy: [
          { targetFeaturedDate: 'desc' },
          { bidDate: 'desc' }
        ]
      }
    }
  });
}

router.use(authenticate);

router.get('/', requireSponsorOrAdmin, async function listAlumni(req, res, next) {
  try {
    const filters = {
      programme: req.query.programme ? String(req.query.programme) : '',
      graduationDate: req.query.graduationDate ? String(req.query.graduationDate) : '',
      industrySector: req.query.industrySector ? String(req.query.industrySector) : ''
    };
    const alumni = await prisma.user.findMany({
      where: {
        role: 'ALUMNUS'
      },
      include: {
        profile: {
          include: {
            degrees: true,
            certifications: true,
            licences: true,
            courses: true,
            employment: true,
            specialisedAreas: true
          }
        },
        bids: {
          orderBy: [
            { targetFeaturedDate: 'desc' },
            { bidDate: 'desc' }
          ]
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    const filtered = alumni.filter(function (user) {
      return matchAlumniFilters(user, filters);
    });

    res.json({
      filters: filters,
      alumni: filtered.map(buildAlumnusResponse)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:userId', requireSponsorOrAdmin, async function getAlumnus(req, res, next) {
  try {
    const alumnus = await findAlumnusById(req.params.userId);

    if (!alumnus) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alumnus not found'
      });
    }

    res.json({
      alumnus: buildAlumnusResponse(alumnus)
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:userId', requireAdmin, async function deleteAlumnus(req, res, next) {
  try {
    const alumnus = await prisma.user.findFirst({
      where: {
        id: req.params.userId,
        role: 'ALUMNUS'
      },
      include: {
        profile: true
      }
    });

    if (!alumnus) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alumnus not found'
      });
    }

    await prisma.user.delete({
      where: {
        id: alumnus.id
      }
    });

    res.json({
      message: 'Alumnus profile deleted successfully',
      alumnus: {
        id: alumnus.id,
        email: alumnus.email
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
