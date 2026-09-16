// =============================================================
//  List Groups — Script auxiliar para descobrir o ID do grupo
// =============================================================
//
//  Rode com: npm run groups
//
//  Ele conecta ao WhatsApp, lista todos os grupos e exibe o ID
//  de cada um. Copie o ID do grupo desejado para o .env
// =============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('./logger');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  logger.info('Escaneie o QR Code abaixo com o WhatsApp:');
  console.log('');
  qrcode.generate(qr, { small: true });
  console.log('');
});

client.on('ready', async () => {
  logger.success('Conectado! Aguardando WhatsApp carregar...');

  // Aguarda o WhatsApp Web carregar completamente
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await delay(8000);

  logger.info('Buscando grupos...');
  console.log('');

  let chats = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      chats = await client.getChats();
      break;
    } catch (err) {
      logger.warn(`Tentativa ${attempt}/${maxRetries} falhou: ${err.message}`);
      if (attempt < maxRetries) {
        logger.info('Aguardando 5 segundos antes de tentar novamente...');
        await delay(5000);
      } else {
        logger.error('Não foi possível buscar os grupos. Tente novamente.');
        await client.destroy();
        process.exit(1);
      }
    }
  }

  const groups = chats.filter((chat) => chat.isGroup);

  if (groups.length === 0) {
    logger.warn('Nenhum grupo encontrado.');
  } else {
    console.log('══════════════════════════════════════════════════════════');
    console.log('  📋  Seus Grupos do WhatsApp');
    console.log('══════════════════════════════════════════════════════════');
    console.log('');

    groups.forEach((group, index) => {
      console.log(`  ${index + 1}. ${group.name}`);
      console.log(`     ID: ${group.id._serialized}`);
      console.log(`     Participantes: ${group.participants?.length || '?'}`);
      console.log('');
    });

    console.log('──────────────────────────────────────────────────────────');
    console.log('  Copie o ID do grupo desejado e cole no arquivo .env');
    console.log('  na variável WHATSAPP_GROUP_ID');
    console.log('──────────────────────────────────────────────────────────');
  }

  console.log('');
  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  logger.error('Falha na autenticação:', msg);
  process.exit(1);
});

logger.info('Conectando ao WhatsApp...');
client.initialize();

