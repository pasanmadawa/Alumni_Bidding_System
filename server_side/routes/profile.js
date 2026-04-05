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

async function ensureProfileForCurrentUser(tx, user) {
  return tx.profile.upsert({
    where: {
      userId: user.id
    },
    update: {},
    create: {
      userId: user.id
    }
  });
}

function buildBaseProfileUpdateData(body, user, options) {
  const settings = Object.assign({
    includeLinkedin: false
  }, options || {});
  const profileUpdateData = {};

  if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    profileUpdateData.displayName = toNullableString(body.displayName);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    profileUpdateData.bio = toNullableString(body.bio);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'contactNumber')) {
    profileUpdateData.contactNumber = toNullableString(body.contactNumber);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'profilePageUrl')) {
    profileUpdateData.profilePageUrl = validateOptionalUrl(toNullableString(body.profilePageUrl), 'Profile page URL');
  }

  if (settings.includeLinkedin && Object.prototype.hasOwnProperty.call(body, 'linkedinUrl')) {
    profileUpdateData.linkedinUrl = validateOptionalUrl(toNullableString(body.linkedinUrl), 'LinkedIn URL');
  }

  if (isAlumnus(user) && Object.prototype.hasOwnProperty.call(body, 'firstName') && hasNonEmptyString(body.firstName)) {
    profileUpdateData.firstName = toNullableString(body.firstName);
  }

  if (isAlumnus(user) && Object.prototype.hasOwnProperty.call(body, 'lastName') && hasNonEmptyString(body.lastName)) {
    profileUpdateData.lastName = toNullableString(body.lastName);
  }

  return profileUpdateData;
}

function validateDegreeItem(item) {
  return {
    title: ensureRequired(toNullableString(item.title), 'Degree title'),
    institutionUrl: validateOptionalUrl(toNullableString(item.institutionUrl), 'Degree URL'),
    completionDate: toNullableDate(item.completionDate)
  };
}

function validateCertificationItem(item) {
  return {
    name: ensureRequired(toNullableString(item.name), 'Certification name'),
    issuerUrl: validateOptionalUrl(toNullableString(item.issuerUrl), 'Certification URL'),
    completionDate: toNullableDate(item.completionDate)
  };
}

function validateLicenceItem(item) {
  return {
    name: ensureRequired(toNullableString(item.name), 'Licence name'),
    issuerUrl: validateOptionalUrl(toNullableString(item.issuerUrl), 'Licence URL'),
    completionDate: toNullableDate(item.completionDate)
  };
}

function validateCourseItem(item) {
  return {
    name: ensureRequired(toNullableString(item.name), 'Course name'),
    courseUrl: validateOptionalUrl(toNullableString(item.courseUrl), 'Course URL'),
    completionDate: toNullableDate(item.completionDate)
  };
}

function validateEmploymentItem(item) {
  return {
    company: ensureRequired(toNullableString(item.company), 'Company'),
    role: ensureRequired(toNullableString(item.role), 'Role'),
    startDate: toNullableDate(item.startDate),
    endDate: toNullableDate(item.endDate)
  };
}

const collectionConfigs = {
  degrees: {
    delegate: 'degree',
    singular: 'degree',
    validate: validateDegreeItem
  },
  certifications: {
    delegate: 'certification',
    singular: 'certification',
    validate: validateCertificationItem
  },
  licences: {
    delegate: 'licence',
    singular: 'licence',
    validate: validateLicenceItem
  },
  courses: {
    delegate: 'course',
    singular: 'course',
    validate: validateCourseItem
  },
  employment: {
    delegate: 'employment',
    singular: 'employment record',
    validate: validateEmploymentItem
  }
};

function getCollectionConfig(section) {
  return collectionConfigs[section] || null;
}

async function getOwnedCollectionItem(tx, section, itemId, profileId) {
  const config = getCollectionConfig(section);

  if (!config) {
    return null;
  }

  return tx[config.delegate].findFirst({
    where: {
      id: itemId,
      profileId: profileId
    }
  });
}

function buildCompletionStatus(profile, user) {
  const checks = isAlumnus(user)
    ? [
        { key: 'firstName', complete: Boolean(profile && profile.firstName) },
        { key: 'lastName', complete: Boolean(profile && profile.lastName) },
        { key: 'bio', complete: Boolean(profile && profile.bio) },
        { key: 'contactNumber', complete: Boolean(profile && profile.contactNumber) },
        { key: 'linkedinUrl', complete: Boolean(profile && profile.linkedinUrl) },
        { key: 'profilePageUrl', complete: Boolean(profile && profile.profilePageUrl) },
        { key: 'profileImage', complete: Boolean(profile && profile.profileImage) },
        { key: 'degrees', complete: Boolean(profile && profile.degrees && profile.degrees.length) },
        { key: 'certifications', complete: Boolean(profile && profile.certifications && profile.certifications.length) },
        { key: 'licences', complete: Boolean(profile && profile.licences && profile.licences.length) },
        { key: 'courses', complete: Boolean(profile && profile.courses && profile.courses.length) },
        { key: 'employment', complete: Boolean(profile && profile.employment && profile.employment.length) }
      ]
    : [
        { key: 'displayName', complete: Boolean(profile && profile.displayName) },
        { key: 'bio', complete: Boolean(profile && profile.bio) },
        { key: 'contactNumber', complete: Boolean(profile && profile.contactNumber) },
        { key: 'linkedinUrl', complete: Boolean(profile && profile.linkedinUrl) },
        { key: 'profilePageUrl', complete: Boolean(profile && profile.profilePageUrl) },
        { key: 'profileImage', complete: Boolean(profile && profile.profileImage) }
      ];
  const completed = checks.filter(function (item) {
    return item.complete;
  }).length;
  const total = checks.length;

  return {
    role: user.role,
    completedItems: completed,
    totalItems: total,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    missingItems: checks.filter(function (item) {
      return !item.complete;
    }).map(function (item) {
      return item.key;
    })
  };
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

router.get('/me/completion-status', async function getMyProfileCompletionStatus(req, res, next) {
  try {
    const profile = await getProfileForCurrentUser(req.currentUser);

    res.json({
      user: {
        id: req.currentUser.id,
        email: req.currentUser.email,
        role: req.currentUser.role
      },
      completionStatus: buildCompletionStatus(profile, req.currentUser)
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/me/basic', async function updateMyBasicProfile(req, res, next) {
  try {
    const body = req.body || {};
    const updatedProfile = await prisma.$transaction(async function (tx) {
      const profile = await ensureProfileForCurrentUser(tx, req.currentUser);
      const profileUpdateData = buildBaseProfileUpdateData(body, req.currentUser);

      await tx.profile.update({
        where: {
          id: profile.id
        },
        data: profileUpdateData
      });

      return tx.profile.findUnique({
        where: {
          id: profile.id
        },
        include: buildProfileIncludeForRole(req.currentUser)
      });
    });

    res.json({
      message: 'Basic profile details updated successfully',
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

router.patch('/me/linkedin', async function updateMyLinkedinUrl(req, res, next) {
  try {
    const body = req.body || {};
    const linkedinUrl = validateOptionalUrl(toNullableString(body.linkedinUrl), 'LinkedIn URL');
    const updatedProfile = await prisma.$transaction(async function (tx) {
      const profile = await ensureProfileForCurrentUser(tx, req.currentUser);

      await tx.profile.update({
        where: {
          id: profile.id
        },
        data: {
          linkedinUrl: linkedinUrl
        }
      });

      return tx.profile.findUnique({
        where: {
          id: profile.id
        },
        include: buildProfileIncludeForRole(req.currentUser)
      });
    });

    res.json({
      message: 'LinkedIn URL updated successfully',
      profile: updatedProfile
    });
  } catch (error) {
    if (error.message && error.message.includes('URL')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

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

router.post('/me/:section(degrees|certifications|licences|courses|employment)', authorizeRoles('ALUMNUS'), async function createProfileCollectionItem(req, res, next) {
  try {
    const config = getCollectionConfig(req.params.section);

    if (!config) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Profile section not found'
      });
    }

    const body = req.body || {};
    const itemData = config.validate(body);
    const createdItem = await prisma.$transaction(async function (tx) {
      const profile = await ensureProfileForCurrentUser(tx, req.currentUser);

      return tx[config.delegate].create({
        data: Object.assign({ profileId: profile.id }, itemData)
      });
    });

    res.status(201).json({
      message: config.singular + ' created successfully',
      item: createdItem
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

router.patch('/me/:section(degrees|certifications|licences|courses|employment)/:itemId', authorizeRoles('ALUMNUS'), async function updateProfileCollectionItem(req, res, next) {
  try {
    const config = getCollectionConfig(req.params.section);

    if (!config) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Profile section not found'
      });
    }

    const body = req.body || {};
    const itemData = config.validate(body);
    const updatedItem = await prisma.$transaction(async function (tx) {
      const profile = await ensureProfileForCurrentUser(tx, req.currentUser);
      const existingItem = await getOwnedCollectionItem(tx, req.params.section, req.params.itemId, profile.id);

      if (!existingItem) {
        throw new Error(config.singular + ' not found');
      }

      return tx[config.delegate].update({
        where: {
          id: existingItem.id
        },
        data: itemData
      });
    });

    res.json({
      message: config.singular + ' updated successfully',
      item: updatedItem
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

    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    next(error);
  }
});

router.delete('/me/:section(degrees|certifications|licences|courses|employment)/:itemId', authorizeRoles('ALUMNUS'), async function deleteProfileCollectionItem(req, res, next) {
  try {
    const config = getCollectionConfig(req.params.section);

    if (!config) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Profile section not found'
      });
    }

    await prisma.$transaction(async function (tx) {
      const profile = await ensureProfileForCurrentUser(tx, req.currentUser);
      const existingItem = await getOwnedCollectionItem(tx, req.params.section, req.params.itemId, profile.id);

      if (!existingItem) {
        throw new Error(config.singular + ' not found');
      }

      await tx[config.delegate].delete({
        where: {
          id: existingItem.id
        }
      });
    });

    res.json({
      message: config.singular + ' deleted successfully'
    });
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
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
