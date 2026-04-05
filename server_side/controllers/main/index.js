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
      getMyProfileCompletionStatus: 'GET /api/profile/me/completion-status',
      updateMyBasicProfile: 'PATCH /api/profile/me/basic',
      updateMyLinkedinUrl: 'PATCH /api/profile/me/linkedin',
      addProfileSectionItem: 'POST /api/profile/me/{degrees|certifications|licences|courses|employment}',
      updateProfileSectionItem: 'PATCH /api/profile/me/{section}/:itemId',
      deleteProfileSectionItem: 'DELETE /api/profile/me/{section}/:itemId',
      updateMyProfileLegacy: 'PUT /api/profile/me',
      uploadProfileImage: 'POST /api/profile/me/image',
      getCurrentFeatured: 'GET /api/bids/featured/current',
      getCurrentBidReveal: 'GET /api/bids/reveal/current',
      getMyBidStatus: 'GET /api/bids/me?targetFeaturedDate=YYYY-MM-DD',
      getMyBidHistory: 'GET /api/bids/history',
      placeBid: 'POST /api/bids/me',
      increaseBid: 'PUT /api/bids/me/increase',
      cancelBid: 'DELETE /api/bids/me?targetFeaturedDate=YYYY-MM-DD',
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
