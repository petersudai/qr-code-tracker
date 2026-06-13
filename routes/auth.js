const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');

// GET: Register Page
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

// POST: Register User
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser) return res.send('User already exists');

  const hashed = await bcrypt.hash(password, 10);
  const newUser = new User({ name, email, password: hashed });
  await newUser.save();

  req.session.userId = newUser._id;
  res.redirect('/dashboard');
});

// GET: Login Page
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

// POST: Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.send('Invalid email or password');

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.send('Invalid email or password');

  req.session.userId = user._id;
  res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
