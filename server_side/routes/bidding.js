'use strict';

const express = require('express');

const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');
const {
  getCurrentBidReveal,
  getFeaturedProfile,
  getMyBidFeedback,
  grantMonthlyEventCredit,
  increaseBid,
  placeOrUpdateBid,
  selectDueWinners,
  selectWinnerForDate
} = require('../lib/bidding');

const router = express.Router();
const requireAdmin = authorizeRoles('ADMIN');
const requireAlumnus = authorizeRoles('ALUMNUS');
const requireViewer = authorizeRoles('ALUMNUS', 'SPONSOR', 'ADMIN');

function isValidationError(error) {
  return Boolean(
    error &&
      error.message &&
      (
        error.message.includes('required') ||
        error.message.includes('must be') ||
        error.message.includes('higher than') ||
        error.message.includes('reached') ||
        error.message.includes('closed') ||
        error.message.includes('only be placed') ||
        error.message.includes('only be increased') ||
        error.message.includes('No existing bid found') ||
        error.message.includes('Use the increase bid endpoint')
      )
  );
}

router.get('/featured/current', async function getCurrentFeatured(req, res, next) {
  try {
    const result = await getFeaturedProfile(req.query.targetFeaturedDate || req.query.date);

    res.json(result);
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.use(authenticate);

router.get('/reveal/current', requireViewer, async function getCurrentReveal(req, res, next) {
  try {
    const result = await getCurrentBidReveal(req.query.targetFeaturedDate || req.query.date);

    res.json(result);
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.get('/me', requireAlumnus, async function getMyBid(req, res, next) {
  try {
    const targetDate = req.query.targetFeaturedDate || req.query.date;

    if (!targetDate) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'targetFeaturedDate query parameter is required'
      });
    }

    const feedback = await getMyBidFeedback(req.currentUser.id, targetDate);

    res.json(feedback);
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.post('/me', requireAlumnus, async function placeMyBid(req, res, next) {
  try {
    const feedback = await placeOrUpdateBid(req.currentUser.id, req.body);

    res.json({
      message: 'Bid saved successfully',
      bid: feedback.bid,
      blindStatus: feedback.blindStatus,
      targetFeaturedDate: feedback.targetFeaturedDate,
      featuredSelected: feedback.featuredSelected,
      monthlyLimit: feedback.monthlyLimit
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.put('/me/increase', requireAlumnus, async function increaseMyBid(req, res, next) {
  try {
    const feedback = await increaseBid(req.currentUser.id, req.body);

    res.json({
      message: 'Bid increased successfully',
      bid: feedback.bid,
      blindStatus: feedback.blindStatus,
      targetFeaturedDate: feedback.targetFeaturedDate,
      featuredSelected: feedback.featuredSelected,
      monthlyLimit: feedback.monthlyLimit
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.post('/select-winner', requireAdmin, async function selectWinner(req, res, next) {
  try {
    const targetDate = req.body && req.body.targetFeaturedDate;
    const result = targetDate
      ? await selectWinnerForDate(targetDate)
      : await selectDueWinners();

    res.json({
      message: 'Winner selection completed',
      result: result
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

router.post('/event-credit', requireAdmin, async function addEventCredit(req, res, next) {
  try {
    const credit = await grantMonthlyEventCredit(req.body);

    res.status(201).json({
      message: 'Monthly event credit saved successfully',
      credit: credit
    });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    next(error);
  }
});

module.exports = router;
