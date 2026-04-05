'use strict'

/**
 * Module dependencies.
 */

var db = require('../../db');

exports.before = function(req, res, next){
  var id = req.params.user_id;
  if (!id) return next();
  // pretend to query a database...
  process.nextTick(function(){
    req.user = db.users[id];
    // cant find that user
    if (!req.user) return next('route');
    // found it, move on to the routes
    next();
  });
};

exports.list = function(req, res, next){
  res.json({
    users: db.users
  });
};

exports.show = function(req, res, next){
  res.json({
    user: req.user
  });
};

exports.update = function(req, res, next){
  var body = req.body;
  var name = body.name || (body.user && body.user.name);

  if (!name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'User name is required'
    });
  }

  req.user.name = name;

  res.json({
    message: 'User updated successfully',
    user: req.user
  });
};
