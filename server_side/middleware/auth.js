'use strict';

const { prisma } = require('../db');
const { getBearerToken, verifyAccessToken } = require('../lib/auth');

exports.authenticate = async function authenticate(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token is required'
      });
    }

    const payload = verifyAccessToken(token);
    const blacklistedToken = await prisma.jwtBlacklist.findUnique({
      where: {
        jti: payload.jti
      }
    });

    if (blacklistedToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has been revoked'
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      include: {
        profile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User does not exist'
      });
    }

    req.auth = payload;
    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};
