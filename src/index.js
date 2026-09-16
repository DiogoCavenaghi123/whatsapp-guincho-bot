// =============================================================
//  Index — Entry point do bot
// =============================================================

require('dotenv').config();

const logger = require('./logger');
const sheets = require('./sheets');
const gemini = require('./gemini');
const { createClient } = require('./whatsapp');

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🚛  Bot WhatsApp → Google Sheets (Agendamento Guincho)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // ── Inicializar Gemini AI ──────────────────────────────────
  gemini.init();

  // ── Validar variáveis de ambiente ──────────────────────────
  const groupId = process.env.WHATSAPP_GROUP_ID;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_TAB || 'Agendamentos';
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';

  if (!groupId) {
    logger.error('WHATSAPP_GROUP_ID não definido no .env');
    logger.info('Rode "npm run groups" para descobrir o ID do grupo');
    process.exit(1);
  }

  if (!spreadsheetId) {
    logger.error('GOOGLE_SHEET_ID não definido no .env');
    logger.info(
      'Copie o ID da URL da planilha: https://docs.google.com/spreadsheets/d/ESTE_ID_AQUI/edit'
    );
    process.exit(1);
  }

  // ── Inicializar Google Sheets ──────────────────────────────
  logger.info('Conectando ao Google Sheets...');
  await sheets.init(credentialsPath);
  await sheets.ensureHeaders(spreadsheetId, sheetName);

  // ── Inicializar WhatsApp ───────────────────────────────────
  logger.info('Iniciando conexão com WhatsApp...');
  const client = createClient({ groupId, spreadsheetId, sheetName });
  await client.initialize();

  // ── Graceful shutdown ──────────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('');
    logger.info('Encerrando bot...');
    await client.destroy();
    logger.success('Bot encerrado. Até mais! 👋');
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Erro fatal:', err.message);
  console.error(err);
  process.exit(1);
});

