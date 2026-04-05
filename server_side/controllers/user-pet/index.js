'use strict'

/**
 * Module dependencies.
 */

var db = require('../../db');

exports.name = 'pet';
exports.prefix = '/user/:user_id';

exports.create = function(req, res, next){
  var id = req.params.user_id;
  var user = db.users[id];
  var body = req.body;
  if (!user) return next('route');
  var name = body.name || (body.pet && body.pet.name);

  if (!name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Pet name is required'
    });
  }

  var pet = { name: name };
  pet.id = db.pets.push(pet) - 1;
  user.pets.push(pet);
  res.status(201).json({
    message: 'Pet added successfully',
    user: user,
    pet: pet
  });
};
