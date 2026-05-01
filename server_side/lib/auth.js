'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

const REFRESH_COOKIE_NAME = 'refreshToken';
const ALLOWED_ROLES = ['ALUMNUS', 'ADMIN', 'SPONSOR', 'STUDENT'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAllowedEmailDomains() {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS || 'my.westminster.ac.uk,iit.ac.lk';

  return raw
    .split(',')
    .map(function (domain) {
      return domain.trim().toLowerCase();
    })
    .filter(Boolean);
}

function isUniversityEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const emailParts = normalizedEmail.split('@');

  if (emailParts.length !== 2) {
    return false;
  }

  const domain = emailParts[1];

  return getAllowedEmailDomains().some(function (allowedDomain) {
    return domain === allowedDomain || domain.endsWith('.' + allowedDomain);
  });
}

function normalizeRole(role) {
  const normalizedRole = String(role || 'ALUMNUS').trim().toUpperCase();

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw new Error('role must be one of ALUMNUS, ADMIN, SPONSOR, STUDENT');
  }

  return normalizedRole;
}

function validateEmailForRole(email, role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'SPONSOR') {
    return true;
  }

  return isUniversityEmail(email);
}

function validatePasswordStrength(password) {
  const value = String(password || '');

  if (value.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }

  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }

  if (!/[0-9]/.test(value)) {
    return 'Password must include at least one number';
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include at least one special character';
  }

  return null;
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getAccessTokenSecret() {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      jti: crypto.randomUUID()
    },
    getAccessTokenSecret(),
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getAccessTokenSecret());
}

function decodeAccessToken(token) {
  return jwt.decode(token);
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice(7);
}

async function createRefreshSession(userId) {
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashOpaqueToken(refreshToken);
  const refreshExpiresDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);
  const expiresAt = new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: userId,
      tokenHash: refreshTokenHash,
      expiresAt: expiresAt
    }
  });

  return {
    refreshToken: refreshToken,
    expiresAt: expiresAt
  };
}

async function findRefreshSession(refreshToken) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash: hashOpaqueToken(refreshToken),
      revoked: false,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });
}

async function revokeRefreshSession(refreshToken) {
  return prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashOpaqueToken(refreshToken)
    },
    data: {
      revoked: true
    }
  });
}

function setRefreshTokenCookie(res, refreshToken) {
  const refreshExpiresDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: refreshExpiresDays * 24 * 60 * 60 * 1000
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}

async function blacklistAccessTokenPayload(payload) {
  if (!payload || !payload.jti || !payload.exp) {
    return;
  }

  await prisma.jwtBlacklist.upsert({
    where: {
      jti: payload.jti
    },
    update: {},
    create: {
      jti: payload.jti,
      userId: payload.sub || null,
      expiresAt: new Date(payload.exp * 1000)
    }
  });
}

function getRequestBaseUrl(req) {
  return process.env.APP_BASE_URL || (req.protocol + '://' + req.get('host'));
}

module.exports = {
  ALLOWED_ROLES: ALLOWED_ROLES,
  REFRESH_COOKIE_NAME: REFRESH_COOKIE_NAME,
  blacklistAccessTokenPayload: blacklistAccessTokenPayload,
  clearRefreshTokenCookie: clearRefreshTokenCookie,
  createRefreshSession: createRefreshSession,
  decodeAccessToken: decodeAccessToken,
  findRefreshSession: findRefreshSession,
  generateOpaqueToken: generateOpaqueToken,
  getBearerToken: getBearerToken,
  getRequestBaseUrl: getRequestBaseUrl,
  hashOpaqueToken: hashOpaqueToken,
  isUniversityEmail: isUniversityEmail,
  normalizeRole: normalizeRole,
  normalizeEmail: normalizeEmail,
  revokeRefreshSession: revokeRefreshSession,
  setRefreshTokenCookie: setRefreshTokenCookie,
  signAccessToken: signAccessToken,
  validateEmailForRole: validateEmailForRole,
  validatePasswordStrength: validatePasswordStrength,
  verifyAccessToken: verifyAccessToken
};
