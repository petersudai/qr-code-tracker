const app = require('./app');
const { localIP } = require('./services/net');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 ZipLock running:');
  console.log(`   → Local:   http://localhost:${PORT}`);
  console.log(`   → Network: http://${localIP}:${PORT}`);
});
