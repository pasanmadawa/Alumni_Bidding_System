'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const validator = require('validator');

const { prisma } = require('../db');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, req.currentUser.id + '-' + Date.now() + ext);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (_req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }

    cb(null, true);
  }
});

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function toNullableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date: ' + value);
  }
  return parsed;
}

function validateOptionalUrl(value, fieldName) {
  if (!value) return null;

  if (!validator.isURL(String(value), {
    protocols: ['http', 'https'],
    require_protocol: true
  })) {
    throw new Error(fieldName + ' must be a valid http or https URL');
  }

  return String(value).trim();
}

function normalizeCollection(items) {
  return Array.isArray(items) ? items : [];
}

function ensureRequired(value, fieldName) {
  if (!value) {
    throw new Error(fieldName + ' is required');
  }
  return value;
}

function hasNonEmptyString(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

async function getFullProfileByUserId(userId) {
  return prisma.profile.findUnique({
    where: {
      userId: userId
    },
    include: {
      degrees: true,
      certifications: true,
      licences: true,
      courses: true,
      employment: true
    }
  });
}

function isAlumnus(user) {
  return user && user.role === 'ALUMNUS';
}

function isSponsor(user) {
  return user && user.role === 'SPONSOR';
}

function buildProfileIncludeForRole(user) {
  if (isAlumnus(user)) {
    return {
      degrees: true,
      certifications: true,
      licences: true,
      courses: true,
      employment: true
    };
  }

  return undefined;
}

async function getProfileForCurrentUser(user) {
  const include = buildProfileIncludeForRole(user);

  return prisma.profile.findUnique({
    where: {
      userId: user.id
    },
    include: include
  });
}

router.use(authenticate, authorizeRoles('ALUMNUS', 'SPONSOR'));

router.get('/me', async function getMyProfile(req, res, next) {
  try {
    const profile = await getProfileForCurrentUser(req.currentUser);

    res.json({
      user: {
        id: req.currentUser.id,
        email: req.currentUser.email,
        emailVerified: req.currentUser.emailVerified,
        role: req.currentUser.role
      },
      profile: profile
    });
  } catch (error) {
    next(error);
  }
});

router.put('/me', async function updateMyProfile(req, res, next) {
  try {
    const body = req.body || {};
    const profileUpdateData = {
      displayName: toNullableString(body.displayName),
      bio: toNullableString(body.bio),
      contactNumber: toNullableString(body.contactNumber),
      linkedinUrl: validateOptionalUrl(toNullableString(body.linkedinUrl), 'LinkedIn URL'),
      profilePageUrl: validateOptionalUrl(toNullableString(body.profilePageUrl), 'Profile page URL')
    };

    if (isAlumnus(req.currentUser) && hasNonEmptyString(body.firstName)) {
      profileUpdateData.firstName = toNullableString(body.firstName);
    }

    if (isAlumnus(req.currentUser) && hasNonEmptyString(body.lastName)) {
      profileUpdateData.lastName = toNullableString(body.lastName);
    }

    const degrees = isAlumnus(req.currentUser) ? normalizeCollection(body.degrees).map(function (item) {
      return {
        title: ensureRequired(toNullableString(item.title), 'Degree title'),
        institutionUrl: validateOptionalUrl(toNullableString(item.institutionUrl), 'Degree URL'),
        completionDate: toNullableDate(item.completionDate)
      };
    }) : [];
    const certifications = isAlumnus(req.currentUser) ? normalizeCollection(body.certifications).map(function (item) {
      return {
        name: ensureRequired(toNullableString(item.name), 'Certification name'),
        issuerUrl: validateOptionalUrl(toNullableString(item.issuerUrl), 'Certification URL'),
        completionDate: toNullableDate(item.completionDate)
      };
    }) : [];
    const licences = isAlumnus(req.currentUser) ? normalizeCollection(body.licences).map(function (item) {
      return {
        name: ensureRequired(toNullableString(item.name), 'Licence name'),
        issuerUrl: validateOptionalUrl(toNullableString(item.issuerUrl), 'Licence URL'),
        completionDate: toNullableDate(item.completionDate)
      };
    }) : [];
    const courses = isAlumnus(req.currentUser) ? normalizeCollection(body.courses).map(function (item) {
      return {
        name: ensureRequired(toNullableString(item.name), 'Course name'),
        courseUrl: validateOptionalUrl(toNullableString(item.courseUrl), 'Course URL'),
        completionDate: toNullableDate(item.completionDate)
      };
    }) : [];
    const employment = isAlumnus(req.currentUser) ? normalizeCollection(body.employment).map(function (item) {
      return {
        company: ensureRequired(toNullableString(item.company), 'Company'),
        role: ensureRequired(toNullableString(item.role), 'Role'),
        startDate: toNullableDate(item.startDate),
        endDate: toNullableDate(item.endDate)
      };
    }) : [];

    const updatedProfile = await prisma.$transaction(async function (tx) {
      const profile = await tx.profile.upsert({
        where: {
          userId: req.currentUser.id
        },
        update: profileUpdateData,
        create: {
          userId: req.currentUser.id,
          displayName: toNullableString(body.displayName),
          firstName: toNullableString(body.firstName),
          lastName: toNullableString(body.lastName),
          bio: toNullableString(body.bio),
          contactNumber: toNullableString(body.contactNumber),
          linkedinUrl: validateOptionalUrl(toNullableString(body.linkedinUrl), 'LinkedIn URL'),
          profilePageUrl: validateOptionalUrl(toNullableString(body.profilePageUrl), 'Profile page URL')
        }
      });

      if (isAlumnus(req.currentUser)) {
        await Promise.all([
          tx.degree.deleteMany({ where: { profileId: profile.id } }),
          tx.certification.deleteMany({ where: { profileId: profile.id } }),
          tx.licence.deleteMany({ where: { profileId: profile.id } }),
          tx.course.deleteMany({ where: { profileId: profile.id } }),
          tx.employment.deleteMany({ where: { profileId: profile.id } })
        ]);

        if (degrees.length) {
          await tx.degree.createMany({
            data: degrees.map(function (item) {
              return Object.assign({ profileId: profile.id }, item);
            })
          });
        }

        if (certifications.length) {
          await tx.certification.createMany({
            data: certifications.map(function (item) {
              return Object.assign({ profileId: profile.id }, item);
            })
          });
        }

        if (licences.length) {
          await tx.licence.createMany({
            data: licences.map(function (item) {
              return Object.assign({ profileId: profile.id }, item);
            })
          });
        }

        if (courses.length) {
          await tx.course.createMany({
            data: courses.map(function (item) {
              return Object.assign({ profileId: profile.id }, item);
            })
          });
        }

        if (employment.length) {
          await tx.employment.createMany({
            data: employment.map(function (item) {
              return Object.assign({ profileId: profile.id }, item);
            })
          });
        }
      }

      return tx.profile.findUnique({
        where: {
          id: profile.id
        },
        include: buildProfileIncludeForRole(req.currentUser)
      });
    });

    res.json({
      message: 'Profile saved successfully',
      profile: updatedProfile
    });
  } catch (error) {
    if (
      error.message &&
      (error.message.includes('required') ||
        error.message.includes('Invalid date') ||
        error.message.includes('URL'))
    ) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.post('/me/image', upload.single('profileImage'), async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Profile image is required'
      });
    }

    const relativePath = '/uploads/profiles/' + req.file.filename;
    const profile = await prisma.profile.upsert({
      where: {
        userId: req.currentUser.id
      },
      update: {
        profileImage: relativePath
      },
      create: {
        userId: req.currentUser.id,
        profileImage: relativePath
      }
    });

    res.json({
      message: 'Profile image uploaded successfully',
      profileImage: profile.profileImage
    });
  } catch (error) {
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

module.exports = router;
