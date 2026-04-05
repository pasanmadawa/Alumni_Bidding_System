'use strict';

function authorizeRoles() {
  const allowedRoles = Array.prototype.slice.call(arguments);

  return function authorizeByRole(req, res, next) {
    if (!req.currentUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required'
      });
    }

    if (!allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This role cannot access the requested resource'
      });
    }

    next();
  };
}

module.exports = {
  authorizeRoles: authorizeRoles
};
