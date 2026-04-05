'use strict'

exports.index = function(req, res){
  res.json({
    message: 'Alumni bidding system API is running',
    endpoints: {
      register: 'POST /auth/register',
      verifyEmail: 'GET or POST /auth/verify-email',
      login: 'POST /auth/login',
      refresh: 'POST /auth/refresh',
      logout: 'POST /auth/logout',
      me: 'GET /auth/me',
      forgotPassword: 'POST /auth/forgot-password',
      resetPassword: 'POST /auth/reset-password',
      users: 'GET /users',
      user: 'GET /user/:user_id',
      updateUser: 'PUT /user/:user_id',
      pet: 'GET /pet/:pet_id',
      updatePet: 'PUT /pet/:pet_id',
      createPetForUser: 'POST /user/:user_id/pet'
    }
  });
};
