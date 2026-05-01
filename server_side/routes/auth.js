'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const { prisma } = require('../db');
const {
  ALLOWED_ROLES,
  blacklistAccessTokenPayload,
  clearRefreshTokenCookie,
  createRefreshSession,
  decodeAccessToken,
  findRefreshSession,
  generateOpaqueToken,
  getBearerToken,
  getRequestBaseUrl,
  hashOpaqueToken,
  normalizeEmail,
  normalizeRole,
  revokeRefreshSession,
  setRefreshTokenCookie,
  signAccessToken,
  validateEmailForRole,
  validatePasswordStrength
} = require('../lib/auth');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../lib/mailer');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Try again later'
  }
});

router.use(authLimiter);

function buildUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    createdAt: user.createdAt,
    profile: user.profile || null
  };
}

function handleValidationErrors(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return null;
  }

  return res.status(400).json({
    error: 'Validation Error',
    details: errors.array().map(function (item) {
      return {
        field: item.path,
        message: item.msg
      };
    })
  });
}

async function verifyEmailToken(token) {
  const tokenHash = hashOpaqueToken(token);
  const pendingRegistration = await prisma.pendingRegistration.findFirst({
    where: {
      verificationToken: tokenHash,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!pendingRegistration) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: pendingRegistration.email
    }
  });

  if (existingUser) {
    await prisma.pendingRegistration.delete({
      where: {
        id: pendingRegistration.id
      }
    });

    return existingUser;
  }

  const createdUser = await prisma.$transaction(async function (tx) {
    const userData = {
      email: pendingRegistration.email,
      passwordHash: pendingRegistration.passwordHash,
      emailVerified: true,
      role: pendingRegistration.role
    };

    if (pendingRegistration.role === 'ALUMNUS') {
      userData.profile = {
        create: {
          firstName: pendingRegistration.firstName,
          lastName: pendingRegistration.lastName
        }
      };
    }

    const user = await tx.user.create({
      data: userData,
      include: {
        profile: true
      }
    });

    await tx.pendingRegistration.delete({
      where: {
        id: pendingRegistration.id
      }
    });

    return user;
  });

  return createdUser;
}

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().withMessage('Password is required'),
    body('role').optional().isString().withMessage('Role must be a string'),
    body('firstName').optional().isLength({ max: 100 }),
    body('lastName').optional().isLength({ max: 100 })
  ],
  async function register(req, res, next) {
    const validationResponse = handleValidationErrors(req, res);
    if (validationResponse) return;

    try {
      const email = normalizeEmail(req.body.email);
      const password = req.body.password;
      const role = normalizeRole(req.body.role || 'ALUMNUS');
      const passwordError = validatePasswordStrength(password);

      if (!validateEmailForRole(email, role)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: role + ' accounts must use a university email address'
        });
      }

      if (passwordError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: passwordError
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: email
        }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'An account with this email already exists'
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const verificationToken = generateOpaqueToken();
      const verificationTokenHash = hashOpaqueToken(verificationToken);
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const pendingRegistration = await prisma.pendingRegistration.upsert({
        where: {
          email: email,
        },
        update: {
          passwordHash: passwordHash,
          firstName: req.body.firstName || null,
          lastName: req.body.lastName || null,
          role: role,
          verificationToken: verificationTokenHash,
          expiresAt: verificationExpiresAt
        },
        create: {
          email: email,
          passwordHash: passwordHash,
          firstName: req.body.firstName || null,
          lastName: req.body.lastName || null,
          role: role,
          verificationToken: verificationTokenHash,
          expiresAt: verificationExpiresAt
        }
      });

      await prisma.emailVerificationToken.deleteMany({
        where: {
          user: {
            email: email
          }
        },
      });

      const mailResult = await sendVerificationEmail({
        to: email,
        token: verificationToken,
        baseUrl: getRequestBaseUrl(req)
      });

      return res.status(201).json({
        message: 'Registration successful. Please verify your email.',
        pendingRegistration: {
          id: pendingRegistration.id,
          email: pendingRegistration.email,
          role: pendingRegistration.role,
          expiresAt: pendingRegistration.expiresAt
        },
        devVerificationToken: mailResult.simulated ? verificationToken : undefined
      });
    } catch (error) {
      if (error.message && error.message.includes('role must be one of')) {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          allowedRoles: ALLOWED_ROLES
        });
      }

      next(error);
    }
  }
);

router.get('/verify-email', async function verifyEmailGet(req, res, next) {
  try {
    const token = String(req.query.token || '');

    if (!token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Verification token is required'
      });
    }

    const result = await verifyEmailToken(token);

    if (!result) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Verification token is invalid or expired'
      });
    }

    return res.json({
      message: 'Email verified successfully',
      user: buildUserResponse(result)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async function verifyEmailPost(req, res, next) {
  try {
    const token = String(req.body.token || '');

    if (!token) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Verification token is required'
      });
    }

    const result = await verifyEmailToken(token);

    if (!result) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Verification token is invalid or expired'
      });
    }

    return res.json({
      message: 'Email verified successfully',
      user: buildUserResponse(result)
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isString().withMessage('Password is required')
  ],
  async function login(req, res, next) {
    const validationResponse = handleValidationErrors(req, res);
    if (validationResponse) return;

    try {
      const email = normalizeEmail(req.body.email);
      const password = req.body.password;
      const user = await prisma.user.findUnique({
        where: {
          email: email
        },
        include: {
          profile: true
        }
      });

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        });
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatches) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Please verify your email before logging in'
        });
      }

      const accessToken = signAccessToken(user);
      const refreshSession = await createRefreshSession(user.id);

      setRefreshTokenCookie(res, refreshSession.refreshToken);

      return res.json({
        message: 'Login successful',
        tokenType: 'Bearer',
        accessToken: accessToken,
        refreshToken: refreshSession.refreshToken,
        user: buildUserResponse(user)
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/refresh', async function refresh(req, res, next) {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token is required'
      });
    }

    const session = await findRefreshSession(refreshToken);

    if (!session || !session.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token is invalid or expired'
      });
    }

    await revokeRefreshSession(refreshToken);

    const nextRefreshSession = await createRefreshSession(session.user.id);
    const accessToken = signAccessToken(session.user);

    setRefreshTokenCookie(res, nextRefreshSession.refreshToken);

    return res.json({
      message: 'Token refreshed successfully',
      tokenType: 'Bearer',
      accessToken: accessToken,
      refreshToken: nextRefreshSession.refreshToken
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async function logout(req, res, next) {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    const accessToken = getBearerToken(req);

    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    if (accessToken) {
      const payload = decodeAccessToken(accessToken);
      await blacklistAccessTokenPayload(payload);
    }

    clearRefreshTokenCookie(res);

    return res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async function me(req, res) {
  return res.json({
    user: buildUserResponse(req.currentUser)
  });
});

router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Valid email is required')
  ],
  async function forgotPassword(req, res, next) {
    const validationResponse = handleValidationErrors(req, res);
    if (validationResponse) return;

    try {
      const email = normalizeEmail(req.body.email);
      const user = await prisma.user.findUnique({
        where: {
          email: email
        }
      });

      if (!user) {
        return res.json({
          message: 'If the email exists, a password reset message has been sent'
        });
      }

      const resetToken = generateOpaqueToken();
      const resetTokenHash = hashOpaqueToken(resetToken);
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          used: false
        },
        data: {
          used: true,
          usedAt: new Date()
        }
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetTokenHash,
          expiresAt: resetExpiresAt
        }
      });

      const mailResult = await sendPasswordResetEmail({
        to: user.email,
        token: resetToken
      });

      return res.json({
        message: 'If the email exists, a password reset message has been sent',
        devResetToken: mailResult.simulated ? resetToken : undefined
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reset-password',
  [
    body('token').isString().withMessage('Reset token is required'),
    body('newPassword').isString().withMessage('New password is required')
  ],
  async function resetPassword(req, res, next) {
    const validationResponse = handleValidationErrors(req, res);
    if (validationResponse) return;

    try {
      const passwordError = validatePasswordStrength(req.body.newPassword);

      if (passwordError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: passwordError
        });
      }

      const resetTokenHash = hashOpaqueToken(req.body.token);
      const resetRecord = await prisma.passwordResetToken.findFirst({
        where: {
          token: resetTokenHash,
          used: false,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (!resetRecord) {
        return res.status(400).json({
          error: 'Invalid Token',
          message: 'Reset token is invalid or expired'
        });
      }

      const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);

      await prisma.$transaction([
        prisma.passwordResetToken.update({
          where: {
            id: resetRecord.id
          },
          data: {
            used: true,
            usedAt: new Date()
          }
        }),
        prisma.passwordResetToken.updateMany({
          where: {
            userId: resetRecord.userId,
            used: false
          },
          data: {
            used: true,
            usedAt: new Date()
          }
        }),
        prisma.refreshToken.updateMany({
          where: {
            userId: resetRecord.userId,
            revoked: false
          },
          data: {
            revoked: true
          }
        }),
        prisma.user.update({
          where: {
            id: resetRecord.userId
          },
          data: {
            passwordHash: newPasswordHash
          }
        })
      ]);

      clearRefreshTokenCookie(res);

      return res.json({
        message: 'Password reset successful'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
