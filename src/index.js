// =============================================================
//  Index — Entry point do bot
// =============================================================

const fs = require('fs');
const path = require('path');

// Carrega .env de múltiplos locais candidatos para suportar standalone e atalhos
const envCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'resources/app/.env'),
  path.resolve(path.dirname(process.execPath), '.env'),
  path.resolve(path.dirname(process.execPath), 'resources/app/.env'),
];
for (const cand of envCandidates) {
  if (cand && fs.existsSync(cand)) {
    require('dotenv').config({ path: cand });
    break;
  }
}

const { execSync } = require('child_process');
const logger = require('./logger');
const sheets = require('./sheets');
const gemini = require('./gemini');
const { createClient, cleanupStaleBrowserSession, scanGroupMessages } = require('./whatsapp');

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

  // ── Checar se outra instância do bot já está rodando ─────────
  const pidFile = path.resolve(__dirname, '../.bot.pid');
  const cmdFile = path.resolve(__dirname, '../.bot.cmd');

  if (fs.existsSync(pidFile)) {
    const oldPid = fs.readFileSync(pidFile, 'utf8').trim();
    if (oldPid && /^\d+$/.test(oldPid)) {
      let isAlreadyRunning = false;
      if (process.platform === 'win32') {
        try {
          const out = execSync(`tasklist /fi "PID eq ${oldPid}" /fo csv /nh`, {
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 3000,
          }).toString().toLowerCase();
          if ((out.includes('node.exe') || out.includes('guinchobot.exe') || out.includes('electron.exe')) && Number(oldPid) !== process.pid) {
            isAlreadyRunning = true;
          }
        } catch (_) {}
      } else {
        try {
          process.kill(Number(oldPid), 0);
          if (Number(oldPid) !== process.pid) isAlreadyRunning = true;
        } catch (_) {}
      }

      if (isAlreadyRunning) {
        logger.warn(`O WhatsApp Guincho Bot já está em execução (PID: ${oldPid})!`);
        logger.info('Para reiniciar, execute "parar-bot.bat" primeiro, ou gerencie pelo Painel de Controle (http://localhost:3000).');
        console.log('');
        process.exit(0);
      }
    }
  }

  // ── Gravar PID do Processo Atual ────────────────────────────
  try {
    fs.writeFileSync(pidFile, String(process.pid), 'utf8');
  } catch (e) {}

  // ── Inicializar Gemini AI ──────────────────────────────────
  gemini.init();

  // ── Validar variáveis de ambiente ──────────────────────────
  const groupId = process.env.WHATSAPP_GROUP_ID;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_TAB || 'Agendamentos';
  function getCredentialsPath() {
    const envPath = process.env.GOOGLE_CREDENTIALP_PATH || process.env.GOOGLE_CREDENTIALS_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidates = [
      path.join(__dirname, '../credentials.json'),
      path.join(__dirname, '../../credentials.json'),
      path.join(process.cwd(), 'credentials.json'),
      path.join(process.cwd(), 'resources/app/credentials.json'),
      path.join(path.dirname(process.execPath), 'credentials.json'),
      path.join(path.dirname(process.execPath), 'resources/app/credentials.json'),
    ];

    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return path.resolve(process.cwd(), 'credentials.json');
  }

  const credentialsPath = getCredentialsPath();

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
  let client = createClient({ groupId, spreadsheetId });
  let initialized = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (!initialized && attempts < maxAttempts) {
    attempts++;
    try {
      if (attempts > 1) {
        logger.info(`Tentativa ${attempts} de ${maxAttempts} para conectar ao WhatsApp...`);
        cleanupStaleBrowserSession();
        await new Promise((r) => setTimeout(r, 2500));
        client = createClient({ groupId, spreadsheetId });
      }
      await client.initialize();
      initialized = true;
    } catch (err) {
      logger.warn(`Falha na inicialização do WhatsApp (tentativa ${attempts}/${maxAttempts}): ${err.message}`);
      if (attempts >= maxAttempts) {
        throw err;
      }
      logger.info('Liberando travas do navegador e tentando reconectar...');
      cleanupStaleBrowserSession();
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

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

