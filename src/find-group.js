// =============================================================
//  Find Specific Group — Captura quando você mandar "guincho"
// =============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('./logger');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('ready', () => {
  logger.success('Conectado! 🚀');
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  AGORA: Abra o WhatsApp no celular, vá no grupo');
  console.log('  "Agenda guincho" e envie exatamente a palavra:');
  console.log('');
  console.log('  👉  guincho');
  console.log('');
  console.log('  (Qualquer outra mensagem de outros grupos será ignorada)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
});

client.on('message_create', async (message) => {
  const text = (message.body || '').trim().toLowerCase();
  const chatId = message.to || message.from;

  // Verifica se a mensagem é "guincho" e vem de um grupo
  if (text === 'guincho') {
    const id = message.from.endsWith('@g.us') ? message.from : (message.to.endsWith('@g.us') ? message.to : null);
    
    if (id) {
      console.log('');
      console.log('══════════════════════════════════════════════════════════');
      console.log('  🎯 GRUPO "Agenda guincho" IDENTIFICADO COM SUCESSO!');
      console.log('');
      console.log(`  ID: ${id}`);
      console.log('');
      console.log('  Copie esse ID e mande aqui!');
      console.log('══════════════════════════════════════════════════════════');
      console.log('');

      await client.destroy();
      process.exit(0);
    }
  }
});

client.on('auth_failure', (msg) => {
  logger.error('Falha na autenticação:', msg);
  process.exit(1);
});

logger.info('Conectando ao WhatsApp...');
client.initialize();
