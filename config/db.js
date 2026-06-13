const mongoose = require('mongoose');

// Only treat it as a real URI if it uses a valid Mongo scheme — guards
// against leftover placeholders like "your-mongodb-uri-here".
function validMongoUri(uri) {
  return typeof uri === 'string' && /^mongodb(\+srv)?:\/\//.test(uri.trim());
}

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!validMongoUri(uri)) {
    console.warn('⚠️  MONGO_URI is missing or not a valid mongodb:// connection string.');
    console.warn('    The app will run, but scans won\'t persist until it\'s set in .env');
    return false;
  }
  // Fail fast instead of buffering queries for 10s+ when Mongo is unreachable.
  mongoose.set('bufferCommands', false);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('🗄️  MongoDB connected');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

module.exports = connectDB;
module.exports.validMongoUri = validMongoUri;
