'use strict';

const express = require('express');

const { prisma } = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

const router = express.Router();
const requireSponsorOrAdmin = authorizeRoles('ADMIN', 'SPONSOR');
const requireAdmin = authorizeRoles('ADMIN');

function buildAlumnusResponse(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    appearanceCount: user.appearanceCount,
    createdAt: user.createdAt,
    profile: user.profile || null,
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
          employment: true
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
            employment: true
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

    res.json({
      alumni: alumni.map(buildAlumnusResponse)
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
