const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const connectDB = require('./config/db');
const { validMongoUri } = connectDB;
const { localIP, isProduction } = require('./services/net');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Behind a proxy (e.g. Render/Heroku) so req.protocol + IPs are correct.
if (isProduction) app.set('trust proxy', 1);

// Core middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (kept for future accounts). Only use the Mongo-backed store when a
// real connection string is present; otherwise fall back to the in-memory store
// so a missing/placeholder MONGO_URI never crashes the app.
const sessionOpts = {
  secret: process.env.SESSION_SECRET || 'ziplockSecret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
};
if (validMongoUri(process.env.MONGO_URI)) {
  sessionOpts.store = MongoStore.create({ mongoUrl: process.env.MONGO_URI });
}
app.use(session(sessionOpts));

// Shared view locals
app.locals.brand = 'ZipLock';
app.locals.year = new Date().getFullYear();

// Routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/campaigns'));
app.use('/', require('./routes/scan'));
app.use('/', require('./routes/dashboard'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { page: 'error', message: 'Page not found.' });
});

// Start
connectDB().finally(() => {
  app.listen(PORT, () => {
    console.log('🚀 ZipLock running:');
    console.log(`   → Local:   http://localhost:${PORT}`);
    console.log(`   → Network: http://${localIP}:${PORT}`);
  });
});
