const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Client, LocalAuth } = require('whatsapp-web.js');

async function testWA() {
  console.log('Testing WhatsApp Web connection...');
  const authDir = path.resolve(__dirname, '../.wwebjs_auth');
  console.log('Auth dir:', authDir, 'exists:', fs.existsSync(authDir));

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', () => {
    console.log('QR code emitted! (Session not saved or expired)');
  });

  client.on('authenticated', () => {
    console.log('✓ WhatsApp Authenticated successfully!');
  });

  client.on('ready', async () => {
    console.log('✓ WhatsApp Client is READY!');
    await client.destroy();
    process.exit(0);
  });

  client.on('auth_failure', (m) => {
    console.error('Auth failure:', m);
  });

  try {
    console.log('Initializing client...');
    await client.initialize();
    console.log('client.initialize() completed.');
  } catch (err) {
    console.error('Error in client.initialize():', err);
    process.exit(1);
  }
}

testWA();
