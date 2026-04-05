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
  db.testConnection()
    .then(function () {
      app.listen(3000);
      console.log('Express started on port 3000');
    })
    .catch(function (err) {
      console.error('Failed to connect to database:', err.message);
      process.exit(1);
    });
}
