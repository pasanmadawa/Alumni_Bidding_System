'use strict'

/**
 * Module dependencies.
 */

var express = require('express');
var logger = require('morgan');
var path = require('node:path');
var cookieParser = require('cookie-parser');
var methodOverride = require('method-override');
var db = require('./db');
var bidding = require('./lib/bidding');

var app = module.exports = express();

// log
if (!module.parent) app.use(logger('dev'));

// serve static files
app.use(express.static(path.join(__dirname, 'public')));

// parse request bodies (req.body)
app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(cookieParser());

// allow overriding methods in query (?_method=put)
app.use(methodOverride('_method'));

app.use('/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/bids', require('./routes/bidding'));
app.use('/api/alumni', require('./routes/alumni'));
app.use('/api/trends', require('./routes/trends'));

bidding.startBiddingScheduler();

// load controllers
require('./lib/boot')(app, { verbose: !module.parent });

app.use(function(err, req, res, next){
  // log it
  if (!module.parent) console.error(err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: err && err.message ? err.message : 'Unexpected server error'
  });
});

// assume 404 since no middleware responded
app.use(function(req, res, next){
  res.status(404).json({
    error: 'Not Found',
    message: 'Route not found',
    url: req.originalUrl
  });
});

/* istanbul ignore next */
if (!module.parent) {
  var port = Number(process.env.PORT || 3000);

  db.testConnection()
    .then(function () {
      var server = app.listen(port, function () {
        console.log('Express started on port ' + port);
      });

      server.on('error', function (err) {
        if (err.code === 'EADDRINUSE') {
          console.error('Port ' + port + ' is already in use. Stop the existing server or set PORT to another value.');
          process.exit(1);
        }

        console.error('Failed to start server:', err.message);
        process.exit(1);
      });
    })
    .catch(function (err) {
      console.error('Failed to connect to database:', err.message);
      process.exit(1);
    });
}
