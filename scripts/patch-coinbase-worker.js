const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../node_modules/@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js');

try {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const patched = content.replace(/export \{\};/g, '');
    if (patched !== content) {
      fs.writeFileSync(filePath, patched, 'utf8');
      console.log('Patched Coinbase HeartbeatWorker');
    }
  } else {
    console.warn('HeartbeatWorker file not found, skipping patch');
  }
} catch (err) {
  console.error('Error patching HeartbeatWorker:', err);
} 