// =============================================================
//  Index — Entry point do bot
// =============================================================

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const sheets = require('./sheets');
const gemini = require('./gemini');
const { createClient, scanGroupMessages } = require('./whatsapp');

process.on('uncaughtException', (err) => {
  logger.error('Exceção não tratada:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Rejeição de Promise não tratada:', reason?.stack || reason);
});

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🚛  Bot WhatsApp → Google Sheets (Agendamento Guincho)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // ── Gravar PID do Processo Imediatamente ────────────────────
  const pidFile = path.resolve(__dirname, '../.bot.pid');
  const cmdFile = path.resolve(__dirname, '../.bot.cmd');
  try {
    fs.writeFileSync(pidFile, String(process.pid), 'utf8');
  } catch (e) {}

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
  await sheets.ensureHeaders(spreadsheetId);

  // ── Inicializar WhatsApp ───────────────────────────────────
  logger.info('Iniciando conexão com WhatsApp...');
  const client = createClient({ groupId, spreadsheetId });
  await client.initialize();

  // ── Listener de Comandos IPC (ex: Releitura disparada pelo Painel) ──
  // ── Listener de Comandos IPC (Releitura disparada pelo Painel) ──
  const processCommandFile = async () => {
    if (!fs.existsSync(cmdFile)) return;
    try {
      const content = fs.readFileSync(cmdFile, 'utf8').trim();
      try { fs.unlinkSync(cmdFile); } catch (_) {}
      if (!content) return;

      const cmdData = JSON.parse(content);
      if (cmdData.cmd === 'rescan') {
        logger.info('Comando de RELEITURA recebido do Painel de Controle! 🔄');
        let cutoff = null;
        if (cmdData.since) {
          const parts = String(cmdData.since).split(/[-/]/).map(Number);
          if (parts.length === 3 && parts[0] > 1000) {
            cutoff = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
          } else {
            cutoff = new Date(cmdData.since);
          }
        }
        await scanGroupMessages(cutoff);
      }
    } catch (e) {
      logger.debug(`Aviso no processamento do .bot.cmd: ${e.message}`);
    }
  };

  fs.watchFile(cmdFile, { interval: 1000 }, processCommandFile);
  const cmdInterval = setInterval(processCommandFile, 1500);

  const cleanup = async () => {
    try {
      clearInterval(cmdInterval);
      fs.unwatchFile(cmdFile);
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      if (fs.existsSync(cmdFile)) fs.unlinkSync(cmdFile);
    } catch (e) {}
    try {
      await client.destroy();
    } catch (e) {}
  };

  // ── Graceful shutdown ──────────────────────────────────────
  process.on('SIGINT', async () => {
    console.log('');
    logger.info('Encerrando bot...');
    await client.destroy();
    await cleanup();
    logger.success('Bot encerrado. Até mais! 👋');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Encerrando bot (SIGTERM)...');
    await cleanup();
    process.exit(0);
  });

  process.on('exit', () => {
    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch (e) {}
  });

}

main().catch((err) => {
  logger.error('Erro fatal:', err.message);
  console.error(err);
  process.exit(1);
});

