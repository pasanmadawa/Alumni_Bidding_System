'use strict';

const cron = require('node-cron');

const { prisma } = require('../db');

const DEFAULT_MONTHLY_FEATURE_LIMIT = Number(process.env.MONTHLY_FEATURE_LIMIT || 3);
const DEFAULT_SELECTION_CRON = process.env.BID_SELECTION_CRON || '0 18 * * *';
const DEFAULT_SELECTION_TIMEZONE = process.env.BID_SELECTION_TIMEZONE || 'Asia/Colombo';

let schedulerStarted = false;

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const values = {};

  parts.forEach(function (part) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function parseDateOnly(value, fieldName) {
  const label = fieldName || 'targetFeaturedDate';
  const input = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);

  if (!match) {
    throw new Error(label + ' must be in YYYY-MM-DD format');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(label + ' is invalid');
  }

  return parsed;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function buildAlumnusDisplayName(user) {
  if (!user) return null;
  const profile = user.profile || {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();

  return fullName || profile.displayName || user.email || null;
}

function buildWinnerItems(profile) {
  const items = [];

  (profile && Array.isArray(profile.certifications) ? profile.certifications : []).forEach(function (item) {
    items.push({
      type: 'CERTIFICATION',
      name: item.name
    });
  });

  (profile && Array.isArray(profile.courses) ? profile.courses : []).forEach(function (item) {
    items.push({
      type: 'COURSE',
      name: item.name
    });
  });

  return items;
}

function buildWinnerRevealPayload(featured) {
  if (!featured || !featured.user) {
    return null;
  }

  return {
    alumnusName: buildAlumnusDisplayName(featured.user),
    featuredDate: featured.featuredDate,
    items: buildWinnerItems(featured.user.profile)
  };
}

function getTodayDate(timeZone) {
  const parts = getDatePartsInTimeZone(new Date(), timeZone || DEFAULT_SELECTION_TIMEZONE);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function addDays(date, days) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days
  ));
}

function getDateRange(date) {
  return {
    gte: date,
    lt: addDays(date, 1)
  };
}

function getMonthRange(date) {
  return {
    start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
    end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  };
}

function parseMoney(value, fieldName) {
  const label = fieldName || 'amount';
  const normalized = String(value || '').trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(label + ' must be a positive number with up to 2 decimal places');
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(label + ' must be greater than zero');
  }

  return amount.toFixed(2);
}

async function getMonthlyLimitSnapshot(tx, userId, targetDate) {
  const monthRange = getMonthRange(targetDate);
  const month = targetDate.getUTCMonth() + 1;
  const year = targetDate.getUTCFullYear();
  const winsCount = await tx.featuredAlumni.count({
    where: {
      userId: userId,
      featuredDate: {
        gte: monthRange.start,
        lt: monthRange.end
      }
    }
  });
  const credit = await tx.alumniMonthEventCredit.findFirst({
    where: {
      userId: userId,
      year: year,
      month: month
    }
  });
  const extraWinsAllowed = credit ? credit.extraWinsAllowed : 0;
  const totalAllowed = DEFAULT_MONTHLY_FEATURE_LIMIT + extraWinsAllowed;

  return {
    year: year,
    month: month,
    winsCount: winsCount,
    extraWinsAllowed: extraWinsAllowed,
    totalAllowed: totalAllowed,
    remainingWins: Math.max(totalAllowed - winsCount, 0)
  };
}

async function ensureUserCanBidThisMonth(tx, userId, targetDate) {
  const summary = await getMonthlyLimitSnapshot(tx, userId, targetDate);

  if (summary.winsCount >= summary.totalAllowed) {
    throw new Error(
      'Monthly feature limit reached for ' +
      summary.year +
      '-' +
      String(summary.month).padStart(2, '0')
    );
  }

  return summary;
}

async function findExistingBid(tx, userId, targetDate) {
  return tx.bid.findFirst({
    where: {
      userId: userId,
      targetFeaturedDate: getDateRange(targetDate)
    },
    orderBy: {
      bidDate: 'asc'
    }
  });
}

async function getOrderedBids(tx, targetDate) {
  return tx.bid.findMany({
    where: {
      targetFeaturedDate: getDateRange(targetDate)
    },
    orderBy: [
      { amount: 'desc' },
      { bidDate: 'asc' },
      { id: 'asc' }
    ]
  });
}

async function refreshLiveStatuses(tx, targetDate) {
  const bids = await getOrderedBids(tx, targetDate);

  if (!bids.length) {
    return null;
  }

  const leader = bids[0];

  await tx.bid.updateMany({
    where: {
      targetFeaturedDate: getDateRange(targetDate)
    },
    data: {
      status: 'OUTBID'
    }
  });

  await tx.bid.update({
    where: {
      id: leader.id
    },
    data: {
      status: 'WINNING'
    }
  });

  return leader;
}

async function getFeaturedRecordByDate(tx, targetDate) {
  return tx.featuredAlumni.findFirst({
    where: {
      featuredDate: getDateRange(targetDate)
    },
    include: {
      user: {
        include: {
          profile: true
        }
      }
    }
  });
}

async function buildBidFeedback(tx, userId, targetDate) {
  const existingBid = await findExistingBid(tx, userId, targetDate);
  const featuredRecord = await getFeaturedRecordByDate(tx, targetDate);
  const monthlyLimit = await getMonthlyLimitSnapshot(tx, userId, targetDate);

  if (!existingBid) {
    return {
      targetFeaturedDate: formatDateOnly(targetDate),
      bid: null,
      blindStatus: 'NOT_BIDDING',
      featuredSelected: Boolean(featuredRecord && featuredRecord.winningBidId),
      monthlyLimit: monthlyLimit
    };
  }

  let blindStatus = existingBid.status || 'PENDING';

  if (!featuredRecord || !featuredRecord.winningBidId) {
    blindStatus = blindStatus === 'WINNING' ? 'WINNING' : 'LOSING';
  }

  return {
    targetFeaturedDate: formatDateOnly(targetDate),
    bid: {
      id: existingBid.id,
      amount: Number(existingBid.amount),
      status: existingBid.status,
      bidDate: existingBid.bidDate
    },
    blindStatus: blindStatus,
    featuredSelected: Boolean(featuredRecord && featuredRecord.winningBidId),
    monthlyLimit: monthlyLimit
  };
}

async function placeOrUpdateBid(userId, payload) {
  const body = payload || {};
  const targetDate = parseDateOnly(body.targetFeaturedDate, 'targetFeaturedDate');
  const today = getTodayDate(DEFAULT_SELECTION_TIMEZONE);

  if (targetDate < today) {
    throw new Error('Bids can only be placed for today or a future date');
  }

  const amount = parseMoney(body.amount, 'amount');

  return prisma.$transaction(async function (tx) {
    const existingFeatured = await getFeaturedRecordByDate(tx, targetDate);

    if (existingFeatured && existingFeatured.winningBidId) {
      throw new Error('Bidding is already closed for this featured date');
    }

    const monthlyLimit = await ensureUserCanBidThisMonth(tx, userId, targetDate);
    const existingBid = await findExistingBid(tx, userId, targetDate);

    if (existingBid) {
      throw new Error('A bid already exists for this featured date. Use the increase bid endpoint');
    }

    await tx.bid.create({
      data: {
        userId: userId,
        amount: amount,
        bidDate: new Date(),
        bidMonth: targetDate.getUTCMonth() + 1,
        bidYear: targetDate.getUTCFullYear(),
        targetFeaturedDate: targetDate,
        status: 'PENDING'
      }
    });

    await refreshLiveStatuses(tx, targetDate);

    const feedback = await buildBidFeedback(tx, userId, targetDate);
    feedback.monthlyLimit = monthlyLimit;
    return feedback;
  });
}

async function increaseBid(userId, payload) {
  const body = payload || {};
  const targetDate = parseDateOnly(body.targetFeaturedDate, 'targetFeaturedDate');
  const today = getTodayDate(DEFAULT_SELECTION_TIMEZONE);

  if (targetDate < today) {
    throw new Error('Bids can only be increased for today or a future date');
  }

  const amount = parseMoney(body.amount, 'amount');

  return prisma.$transaction(async function (tx) {
    const existingFeatured = await getFeaturedRecordByDate(tx, targetDate);

    if (existingFeatured && existingFeatured.winningBidId) {
      throw new Error('Bidding is already closed for this featured date');
    }

    const monthlyLimit = await ensureUserCanBidThisMonth(tx, userId, targetDate);
    const existingBid = await findExistingBid(tx, userId, targetDate);

    if (!existingBid) {
      throw new Error('No existing bid found for this featured date');
    }

    if (Number(amount) <= Number(existingBid.amount)) {
      throw new Error('New bid amount must be higher than your current bid');
    }

    await tx.bid.update({
      where: {
        id: existingBid.id
      },
      data: {
        amount: amount
      }
    });

    await refreshLiveStatuses(tx, targetDate);

    const feedback = await buildBidFeedback(tx, userId, targetDate);
    feedback.monthlyLimit = monthlyLimit;
    return feedback;
  });
}

async function cancelBid(userId, targetDateInput) {
  const targetDate = parseDateOnly(targetDateInput, 'targetFeaturedDate');
  const today = getTodayDate(DEFAULT_SELECTION_TIMEZONE);

  if (targetDate < today) {
    throw new Error('Bids can only be cancelled for today or a future date');
  }

  return prisma.$transaction(async function (tx) {
    const existingFeatured = await getFeaturedRecordByDate(tx, targetDate);

    if (existingFeatured && existingFeatured.winningBidId) {
      throw new Error('Bidding is already closed for this featured date');
    }

    const existingBid = await findExistingBid(tx, userId, targetDate);

    if (!existingBid) {
      throw new Error('No existing bid found for this featured date');
    }

    await tx.bid.delete({
      where: {
        id: existingBid.id
      }
    });

    await refreshLiveStatuses(tx, targetDate);

    return {
      targetFeaturedDate: formatDateOnly(targetDate),
      cancelledBidId: existingBid.id
    };
  });
}

async function getMyBidFeedback(userId, targetDateInput) {
  const targetDate = parseDateOnly(targetDateInput, 'targetFeaturedDate');

  return prisma.$transaction(async function (tx) {
    return buildBidFeedback(tx, userId, targetDate);
  });
}

async function getBidHistory(userId) {
  const bids = await prisma.bid.findMany({
    where: {
      userId: userId
    },
    orderBy: [
      { targetFeaturedDate: 'desc' },
      { bidDate: 'desc' }
    ]
  });

  return {
    bids: bids.map(function (bid) {
      return {
        id: bid.id,
        amount: Number(bid.amount),
        status: bid.status,
        bidDate: bid.bidDate,
        bidMonth: bid.bidMonth,
        bidYear: bid.bidYear,
        targetFeaturedDate: bid.targetFeaturedDate
      };
    })
  };
}

async function getFeaturedProfile(targetDateInput) {
  const targetDate = targetDateInput
    ? parseDateOnly(targetDateInput, 'targetFeaturedDate')
    : getTodayDate(DEFAULT_SELECTION_TIMEZONE);

  const featured = await prisma.featuredAlumni.findFirst({
    where: {
      featuredDate: getDateRange(targetDate)
    },
    include: {
      user: {
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
      }
    }
  });

  if (!featured || !featured.user) {
    return {
      targetFeaturedDate: formatDateOnly(targetDate),
      featured: null
    };
  }

  return {
    targetFeaturedDate: formatDateOnly(targetDate),
    featured: buildWinnerRevealPayload(featured)
  };
}

async function getCurrentBidReveal(targetDateInput) {
  const targetDate = targetDateInput
    ? parseDateOnly(targetDateInput, 'targetFeaturedDate')
    : getTodayDate(DEFAULT_SELECTION_TIMEZONE);

  const featured = await prisma.featuredAlumni.findFirst({
    where: {
      featuredDate: getDateRange(targetDate)
    },
    include: {
      user: {
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
      }
    }
  });

  if (!featured || !featured.user || !featured.winningBidId) {
    return {
      targetFeaturedDate: formatDateOnly(targetDate),
      revealed: false,
      message: 'Winning alumnus has not been revealed yet for this date',
      winner: null
    };
  }

  return {
    targetFeaturedDate: formatDateOnly(targetDate),
    revealed: true,
    winner: buildWinnerRevealPayload(featured)
  };
}

async function selectWinnerForDate(targetDateInput) {
  const targetDate = parseDateOnly(targetDateInput, 'targetFeaturedDate');

  return prisma.$transaction(async function (tx) {
    const existingFeatured = await getFeaturedRecordByDate(tx, targetDate);

    if (existingFeatured && existingFeatured.winningBidId) {
      return {
        targetFeaturedDate: formatDateOnly(targetDate),
        selected: true,
        winnerUserId: existingFeatured.userId,
        winningBidId: existingFeatured.winningBidId
      };
    }

    const bids = await getOrderedBids(tx, targetDate);

    if (!bids.length) {
      return {
        targetFeaturedDate: formatDateOnly(targetDate),
        selected: false,
        winnerUserId: null,
        winningBidId: null,
        message: 'No bids found for this featured date'
      };
    }

    let winner = null;
    for (const bid of bids) {
      if (!bid.userId) continue;

      const monthlyLimit = await getMonthlyLimitSnapshot(tx, bid.userId, targetDate);
      if (monthlyLimit.winsCount < monthlyLimit.totalAllowed) {
        winner = bid;
        break;
      }
    }

    if (!winner) {
      await tx.bid.updateMany({
        where: {
          targetFeaturedDate: getDateRange(targetDate)
        },
        data: {
          status: 'LOST'
        }
      });

      return {
        targetFeaturedDate: formatDateOnly(targetDate),
        selected: false,
        winnerUserId: null,
        winningBidId: null,
        message: 'No eligible bidder met the monthly feature rules'
      };
    }

    await tx.bid.updateMany({
      where: {
        targetFeaturedDate: getDateRange(targetDate)
      },
      data: {
        status: 'LOST'
      }
    });

    await tx.bid.update({
      where: {
        id: winner.id
      },
      data: {
        status: 'WON'
      }
    });

    const featured = existingFeatured
      ? await tx.featuredAlumni.update({
          where: {
            id: existingFeatured.id
          },
          data: {
            userId: winner.userId,
            winningBidId: winner.id,
            alumniPayoutAmount: winner.amount
          }
        })
      : await tx.featuredAlumni.create({
          data: {
            userId: winner.userId,
            featuredDate: targetDate,
            winningBidId: winner.id,
            alumniPayoutAmount: winner.amount
          }
        });

    await tx.user.update({
      where: {
        id: winner.userId
      },
      data: {
        appearanceCount: {
          increment: 1
        }
      }
    });

    return {
      targetFeaturedDate: formatDateOnly(targetDate),
      selected: true,
      winnerUserId: featured.userId,
      winningBidId: featured.winningBidId
    };
  });
}

async function selectDueWinners(referenceDateInput) {
  const cutoffDate = referenceDateInput
    ? parseDateOnly(referenceDateInput, 'referenceDate')
    : getTodayDate(DEFAULT_SELECTION_TIMEZONE);
  const dueDates = await prisma.bid.findMany({
    where: {
      targetFeaturedDate: {
        not: null,
        lte: cutoffDate
      }
    },
    select: {
      targetFeaturedDate: true
    },
    distinct: ['targetFeaturedDate'],
    orderBy: {
      targetFeaturedDate: 'asc'
    }
  });
  const results = [];

  for (const entry of dueDates) {
    const result = await selectWinnerForDate(entry.targetFeaturedDate);
    results.push(result);
  }

  return results;
}

async function grantMonthlyEventCredit(payload) {
  const body = payload || {};
  const year = Number(body.year);
  const month = Number(body.month);
  const extraWinsAllowed = body.extraWinsAllowed === undefined ? 1 : Number(body.extraWinsAllowed);

  if (!body.userId) {
    throw new Error('userId is required');
  }

  if (!Number.isInteger(year) || year < 2000) {
    throw new Error('year must be a valid number');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('month must be between 1 and 12');
  }

  if (!Number.isInteger(extraWinsAllowed) || extraWinsAllowed < 0) {
    throw new Error('extraWinsAllowed must be zero or a positive integer');
  }

  const existingCredit = await prisma.alumniMonthEventCredit.findFirst({
    where: {
      userId: body.userId,
      year: year,
      month: month
    }
  });

  if (existingCredit) {
    await prisma.alumniMonthEventCredit.updateMany({
      where: {
        userId: body.userId,
        year: year,
        month: month
      },
      data: {
        extraWinsAllowed: extraWinsAllowed
      }
    });

    return prisma.alumniMonthEventCredit.findFirst({
      where: {
        userId: body.userId,
        year: year,
        month: month
      }
    });
  }

  return prisma.alumniMonthEventCredit.create({
    data: {
      userId: body.userId,
      year: year,
      month: month,
      extraWinsAllowed: extraWinsAllowed
    }
  });
}

function startBiddingScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  cron.schedule(
    DEFAULT_SELECTION_CRON,
    function () {
      selectDueWinners().catch(function (error) {
        console.error('Bidding winner selection failed:', error.message);
      });
    },
    {
      timezone: DEFAULT_SELECTION_TIMEZONE
    }
  );
}

module.exports = {
  DEFAULT_MONTHLY_FEATURE_LIMIT: DEFAULT_MONTHLY_FEATURE_LIMIT,
  DEFAULT_SELECTION_CRON: DEFAULT_SELECTION_CRON,
  DEFAULT_SELECTION_TIMEZONE: DEFAULT_SELECTION_TIMEZONE,
  cancelBid: cancelBid,
  getCurrentBidReveal: getCurrentBidReveal,
  getBidHistory: getBidHistory,
  getFeaturedProfile: getFeaturedProfile,
  increaseBid: increaseBid,
  getMyBidFeedback: getMyBidFeedback,
  grantMonthlyEventCredit: grantMonthlyEventCredit,
  placeOrUpdateBid: placeOrUpdateBid,
  selectDueWinners: selectDueWinners,
  selectWinnerForDate: selectWinnerForDate,
  startBiddingScheduler: startBiddingScheduler
};
