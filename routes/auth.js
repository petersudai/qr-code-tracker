const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const store = require('../services/store');
const { redirectIfAuthed } = require('../services/authMiddleware');

function dbUnavailable(res) {
  return res.status(503).render('error', {
    page: 'error',
    message: 'Accounts require a database connection. Please try again shortly.'
  });
}

// GET: Register Page
router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('register', { page: 'register', error: null, values: {} });
});

// POST: Register User
router.post('/register', redirectIfAuthed, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return dbUnavailable(res);

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 8) {
    return res.status(400).render('register', {
      page: 'register',
      error: 'Please fill in your name, email, and a password of at least 8 characters.',
      values: { name, email }
    });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).render('register', {
        page: 'register',
        error: 'An account with that email already exists.',
        values: { name, email }
      });
    }

    const user = await User.create({ name, email, password });

    // The very first person to sign up inherits any campaigns that were
    // created before accounts existed (e.g. CBD, Kisamis from the demo phase).
    const userCount = await User.countDocuments();
    if (userCount === 1) {
      await store.assignUnownedCampaignsToUser(user._id);
    }

    req.session.userId = user._id;
    req.session.userName = user.name;
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo || '/dashboard');
  } catch (err) {
    console.error('register failed:', err);
    res.status(500).render('register', {
      page: 'register',
      error: 'Something went wrong creating your account. Please try again.',
      values: { name, email }
    });
  }
});

// GET: Login Page
router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', { page: 'login', error: null, values: {} });
});

// POST: Login User
router.post('/login', redirectIfAuthed, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return dbUnavailable(res);

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  try {
    const user = await User.findOne({ email });
    const match = user && (await user.comparePassword(password));
    if (!match) {
      return res.status(401).render('login', {
        page: 'login',
        error: 'Invalid email or password.',
        values: { email }
      });
    }

    req.session.userId = user._id;
    req.session.userName = user.name;
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo || '/dashboard');
  } catch (err) {
    console.error('login failed:', err);
    res.status(500).render('login', {
      page: 'login',
      error: 'Something went wrong signing you in. Please try again.',
      values: { email }
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
