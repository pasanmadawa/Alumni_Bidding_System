'use strict'

/**
 * Module dependencies.
 */

var db = require('../../db');

exports.before = function(req, res, next){
  var pet = db.pets[req.params.pet_id];
  if (!pet) return next('route');
  req.pet = pet;
  next();
};

exports.show = function(req, res, next){
  res.json({
    pet: req.pet
  });
};

exports.update = function(req, res, next){
  var body = req.body;
  var name = body.name || (body.pet && body.pet.name);

  if (!name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Pet name is required'
    });
  }

  req.pet.name = name;

  res.json({
    message: 'Pet updated successfully',
    pet: req.pet
  });
};
