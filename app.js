const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const connectDB = require('./config/db');
const { validMongoUri } = connectDB;
const { isProduction } = require('./services/net');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Behind a proxy (Render, Vercel, etc.) so req.protocol + IPs are correct.
if (isProduction) app.set('trust proxy', 1);

// Core middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (Mongo-backed when a real connection string is present; otherwise
// falls back to the in-memory store so a missing/placeholder MONGO_URI never
// crashes the app — though accounts themselves still require Mongo to work).
const sessionOpts = {
  secret: process.env.SESSION_SECRET || 'ziplockSecret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
};
if (validMongoUri(process.env.MONGO_URI)) {
  // Reuse Mongoose's own connection instead of letting connect-mongo open a
  // second, independent one — halves the connection work on a cold start.
  sessionOpts.store = MongoStore.create({
    clientPromise: connectDB().then(ok => {
      if (!ok) throw new Error('MongoDB connection unavailable for session store');
      return mongoose.connection.getClient();
    })
  });
}
app.use(session(sessionOpts));

// Ensure the DB connection is established before any route touches it. Cheap
// no-op after the first successful connect (see config/db.js) — this is what
// makes the app work both as a long-lived process and as a Vercel serverless
// function invoked per-request.
app.use((req, res, next) => {
  connectDB().finally(next);
});

// Make the logged-in user (if any) available to every view without each
// route having to pass it explicitly.
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? { id: req.session.userId, name: req.session.userName } : null;
  next();
});

// Shared view locals
app.locals.brand = 'ZipLock';
app.locals.year = new Date().getFullYear();

// Routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/campaigns'));
app.use('/', require('./routes/scan'));
app.use('/', require('./routes/dashboard'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { page: 'error', message: 'Page not found.' });
});

module.exports = app;
