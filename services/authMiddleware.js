// Gate a route behind a logged-in session, remembering where the visitor
// was headed so login can redirect them back afterwards.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

// Keep already-logged-in visitors away from /login and /register.
function redirectIfAuthed(req, res, next) {
  if (req.session.userId) return res.redirect('/dashboard');
  next();
}

module.exports = { requireAuth, redirectIfAuthed };
