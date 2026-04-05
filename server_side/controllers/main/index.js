'use strict'

exports.index = function(req, res){
  res.json({
    message: 'Alumni bidding system API is running',
    pages: {
      auth: '/auth.html',
      profileEditor: '/profile.html'
    },
    endpoints: {
      register: 'POST /auth/register',
      verifyEmail: 'GET or POST /auth/verify-email',
      login: 'POST /auth/login',
      refresh: 'POST /auth/refresh',
      logout: 'POST /auth/logout',
      me: 'GET /auth/me',
      forgotPassword: 'POST /auth/forgot-password',
      resetPassword: 'POST /auth/reset-password',
      getMyProfile: 'GET /api/profile/me',
      updateMyProfile: 'PUT /api/profile/me',
      uploadProfileImage: 'POST /api/profile/me/image',
      getCurrentFeatured: 'GET /api/bids/featured/current',
      getCurrentBidReveal: 'GET /api/bids/reveal/current',
      getMyBidStatus: 'GET /api/bids/me?targetFeaturedDate=YYYY-MM-DD',
      placeBid: 'POST /api/bids/me',
      increaseBid: 'PUT /api/bids/me/increase',
      selectWinnerAdmin: 'POST /api/bids/select-winner',
      addEventCreditAdmin: 'POST /api/bids/event-credit',
      listAlumniForSponsorOrAdmin: 'GET /api/alumni',
      getAlumnusForSponsorOrAdmin: 'GET /api/alumni/:userId',
      deleteAlumnusAdmin: 'DELETE /api/alumni/:userId',
      users: 'GET /users',
      user: 'GET /user/:user_id',
      updateUser: 'PUT /user/:user_id',
      pet: 'GET /pet/:pet_id',
      updatePet: 'PUT /pet/:pet_id',
      createPetForUser: 'POST /user/:user_id/pet'
    }
  });
};
