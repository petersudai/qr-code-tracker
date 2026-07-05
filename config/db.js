const mongoose = require('mongoose');

// Only treat it as a real URI if it uses a valid Mongo scheme — guards
// against leftover placeholders like "your-mongodb-uri-here".
function validMongoUri(uri) {
  return typeof uri === 'string' && /^mongodb(\+srv)?:\/\//.test(uri.trim());
}

// Caches the in-flight connect promise so repeated calls (e.g. the
// per-request middleware in app.js, or warm serverless invocations on
// Vercel) don't each try to open a new connection to Atlas.
let connectingPromise = null;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!validMongoUri(uri)) {
    console.warn('⚠️  MONGO_URI is missing or not a valid mongodb:// connection string.');
    console.warn('    The app will run, but scans won\'t persist until it\'s set in .env');
    return false;
  }

  // Already connected (e.g. a warm Vercel invocation reusing the container).
  if (mongoose.connection.readyState === 1) return true;

  // A connection attempt is already in flight — reuse it instead of racing.
  if (connectingPromise) return connectingPromise;

  // Fail fast instead of buffering queries for 10s+ when Mongo is unreachable.
  mongoose.set('bufferCommands', false);
  connectingPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log('🗄️  MongoDB connected');
      return true;
    })
    .catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      connectingPromise = null; // allow a retry on the next call
      return false;
    });

  return connectingPromise;
}

module.exports = connectDB;
module.exports.validMongoUri = validMongoUri;
