const mongoose = require('mongoose');
const User = require('../models/User');

// A session can outlive the account it points to (e.g. the account was
// deleted but the browser still holds a valid session cookie). Treat that
// as logged-out rather than trusting userId blindly.
//
// Without a live connection this must NOT touch a Mongoose model — with
// bufferCommands still at its default, a query issued before any connection
// exists gets silently buffered and only rejects after Mongoose's ~10s
// default timeout, stalling every single navigation. Skip the existence
// check entirely when disconnected and just trust the session instead.
async function sessionUserExists(req) {
  if (!req.session.userId) return false;
  if (mongoose.connection.readyState !== 1) return true;
  return !!(await User.exists({ _id: req.session.userId }).catch(() => null));
}

function clearStaleSession(req) {
  delete req.session.userId;
  delete req.session.userName;
}

// Gate a route behind a logged-in session, remembering where the visitor
// was headed so login can redirect them back afterwards.
async function requireAuth(req, res, next) {
  if (await sessionUserExists(req)) return next();
  clearStaleSession(req);
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

// Keep already-logged-in visitors away from /login and /register.
async function redirectIfAuthed(req, res, next) {
  if (!req.session.userId) return next();
  if (await sessionUserExists(req)) return res.redirect('/dashboard');
  clearStaleSession(req);
  next();
}

module.exports = { requireAuth, redirectIfAuthed };
