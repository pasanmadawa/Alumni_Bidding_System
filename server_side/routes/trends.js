'use strict';

const express = require('express');

const { prisma } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function labelOrUnknown(value, fallback) {
  const text = value ? String(value).trim() : '';
  return text || fallback;
}

function dateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function countItems(values) {
  const totals = new Map();

  values.forEach(function (value) {
    const label = labelOrUnknown(value, 'Not recorded');
    totals.set(label, (totals.get(label) || 0) + 1);
  });

  return Array.from(totals.entries())
    .map(function ([label, count]) {
      return { label, count };
    })
    .sort(function (a, b) {
      return b.count - a.count || a.label.localeCompare(b.label);
    })
    .slice(0, 8);
}

function matchFilter(user, programme, graduationDate) {
  const degrees = user.profile && Array.isArray(user.profile.degrees)
    ? user.profile.degrees
    : [];

  if (programme && !degrees.some(function (degree) {
    return degree.title === programme;
  })) {
    return false;
  }

  if (graduationDate && !degrees.some(function (degree) {
    return dateOnly(degree.completionDate) === graduationDate;
  })) {
    return false;
  }

  return true;
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

function inferLocation(profile) {
  const text = [
    profile && profile.bio,
    profile && profile.profilePageUrl,
    profile && profile.linkedinUrl
  ].filter(Boolean).join(' ');
  const match = text.match(/\b(?:in|at|from)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\b/);

  return match ? match[1] : 'Not recorded';
}

router.use(authenticate);

router.get('/', async function getTrends(req, res, next) {
  try {
    const programme = req.query.programme ? String(req.query.programme) : '';
    const graduationDate = req.query.graduationDate ? String(req.query.graduationDate) : '';
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
        }
      }
    });
    const filtered = alumni.filter(function (user) {
      return matchFilter(user, programme, graduationDate);
    });
    const programmes = new Set();
    const graduationDates = new Set();
    const skillSignals = [];
    const sectors = [];
    const jobTitles = [];
    const employers = [];
    const locations = [];

    filtered.forEach(function (user) {
      const profile = user.profile || {};

      (profile.degrees || []).forEach(function (degree) {
        if (degree.title) programmes.add(degree.title);
        if (degree.completionDate) graduationDates.add(dateOnly(degree.completionDate));
      });

      (profile.courses || []).forEach(function (course) {
        skillSignals.push(course.name);
      });
      (profile.certifications || []).forEach(function (certification) {
        skillSignals.push(certification.name);
      });
      (profile.licences || []).forEach(function (licence) {
        skillSignals.push(licence.name);
      });
      (profile.employment || []).forEach(function (employment) {
        sectors.push(inferSector(employment));
        jobTitles.push(employment.role);
        employers.push(employment.company);
      });

      locations.push(inferLocation(profile));
    });

    res.json({
      filters: {
        programme,
        graduationDate,
        programmes: Array.from(programmes).sort(),
        graduationDates: Array.from(graduationDates).sort().reverse()
      },
      totals: {
        alumni: filtered.length
      },
      charts: {
        curriculumSkillsGap: countItems(skillSignals),
        employmentByIndustrySector: countItems(sectors),
        mostCommonJobTitles: countItems(jobTitles),
        topEmployers: countItems(employers),
        geographicDistribution: countItems(locations)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
