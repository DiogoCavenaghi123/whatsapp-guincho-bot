// =============================================================
//  Dashboard Server — Servidor HTTP nativo do Painel de Controle
// =============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync, spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const history = require('../history');
const sheets = require('../sheets');

const PORT = process.env.DASHBOARD_PORT || 3000;
const PROJ_ROOT = path.resolve(__dirname, '../..');
const PID_FILE = path.join(PROJ_ROOT, '.bot.pid');
const CMD_FILE = path.join(PROJ_ROOT, '.bot.cmd');
const LOG_FILE = path.join(PROJ_ROOT, 'logs/bot.log');
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * Checa se o bot está rodando e retorna info do processo
 */
function getBotProcessInfo() {
  if (!fs.existsSync(PID_FILE)) {
    return { running: false, pid: null, startedAt: null };
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(pidStr);
  if (!pid || isNaN(pid)) {
    return { running: false, pid: null, startedAt: null };
  }

  // 1. Checagem nativa ultra-rápida (0.01ms) sem invocar processos externos
  try {
    process.kill(pid, 0);
  } catch (e) {
    // Processo definitivamente não existe
    return { running: false, pid: null, startedAt: null };
  }

  // 2. Se o PID respondeu ao sinal, confirma que é o node.exe
  try {
    const out = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).toString();

    if (out.includes('node.exe')) {
      return { running: true, pid };
    }
  } catch (e) {}

  return { running: false, pid: null, startedAt: null };
}

process.on('uncaughtException', (err) => {
  console.error('[Dashboard Exception]:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Dashboard Rejection]:', reason?.stack || reason);
});

/**
 * Roteamento de Requisições
 */
const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const parsedUrl = { query: Object.fromEntries(reqUrl.searchParams.entries()) };

    // Habilita CORS para requisições locais
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── API: STATUS ────────────────────────────────────────────
    if (pathname === '/api/status' && req.method === 'GET') {
      const proc = getBotProcessInfo();
      const stats = history.getStats();
      const cycleInfo = sheets.getTargetMonthInfo();
      const mem = process.memoryUsage();
      const sheetIdVal = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          running: proc.running,
          pid: proc.pid,
          stats,
          activeTab: cycleInfo.expectedTabName,
          cycleRange: `24/${String(cycleInfo.monthIndex === 0 ? 12 : cycleInfo.monthIndex).padStart(2, '0')} até 23/${String(cycleInfo.monthIndex + 1).padStart(2, '0')}`,
          system: {
            memoryRssMB: Math.round(mem.rss / (1024 * 1024)),
            memoryHeapMB: Math.round(mem.heapUsed / (1024 * 1024)),
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
          },
          config: {
            botSchedule: '07:00 às 19:00 (Diário)',
            groupId: process.env.WHATSAPP_GROUP_ID
              ? (process.env.WHATSAPP_GROUP_ID.substring(0, 16) + '...')
              : 'Não configurado',
            groupConfigured: !!process.env.WHATSAPP_GROUP_ID,
            sheetConfigured: !!sheetIdVal,
            sheetId: sheetIdVal ? (sheetIdVal.substring(0, 14) + '...***') : 'Não configurado',
            geminiConfigured: !!process.env.GEMINI_API_KEY,
            geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
            port: PORT,
          },
        })
      );
      return;
    }

    // ── API: LIMPAR LOGS ───────────────────────────────────────
    if (pathname === '/api/clear-logs' && req.method === 'POST') {
      try {
        if (fs.existsSync(LOG_FILE)) {
          fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] [INFO] Logs limpos via Painel de Controle.\n`, 'utf8');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Logs limpos com sucesso.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
      return;
    }

    // ── API: TESTAR / SINCRONIZAR PLANILHA ─────────────────────
    if (pathname === '/api/sync-sheets' && req.method === 'POST') {
      try {
        const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
        const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
        await sheets.init(credsPath);
        await sheets.ensureHeaders(sheetId);
        const cycleInfo = sheets.getTargetMonthInfo();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            message: `Conexão com Google Sheets bem-sucedida! Aba ativa: "${cycleInfo.expectedTabName}".`,
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Erro ao sincronizar: ' + err.message }));
      }
      return;
    }

    // ── API: INICIAR BOT ───────────────────────────────────────
    if (pathname === '/api/start' && req.method === 'POST') {
      const proc = getBotProcessInfo();
      if (proc.running) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'O bot já está em execução!' }));
        return;
      }

      try {
        const startScript = path.join(PROJ_ROOT, 'src/start-bg.js');
        const child = spawn(process.execPath, [startScript], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          cwd: PROJ_ROOT,
        });
        child.unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Bot iniciado em segundo plano com sucesso!' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
      return;
    }

    // ── API: PARAR BOT ─────────────────────────────────────────
    if (pathname === '/api/stop' && req.method === 'POST') {
      try {
        const stopScript = path.join(PROJ_ROOT, 'src/stop.js');
        execSync(`node "${stopScript}"`, { stdio: 'ignore', timeout: 8000, cwd: PROJ_ROOT });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Bot finalizado com sucesso!' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
      return;
    }

    // ── API: RELEITURA (RE-SCAN) ───────────────────────────────
    if (pathname === '/api/rescan' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let sinceDate = null;
        try {
          if (body) {
            const parsed = JSON.parse(body);
            sinceDate = parsed.sinceDate || null;
          }
        } catch (e) {}

        const proc = getBotProcessInfo();
        if (!proc.running) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'O bot precisa estar em execução para realizar a releitura do grupo!',
            })
          );
          return;
        }

        try {
          fs.writeFileSync(CMD_FILE, JSON.stringify({ cmd: 'rescan', since: sinceDate }), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              message: 'Comando de releitura enviado ao bot com sucesso! Acompanhe nos logs.',
            })
          );
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // ── API: HISTÓRICO DE MENSAGENS ────────────────────────────
    if (pathname === '/api/history' && req.method === 'GET') {
      const status = parsedUrl.query.status || 'TODOS';
      const search = parsedUrl.query.search || '';
      const limit = parseInt(parsedUrl.query.limit) || 50;
      const offset = parseInt(parsedUrl.query.offset) || 0;

      const result = history.getHistory({ status, search, limit, offset });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    // ── API: ÚLTIMOS LOGS ──────────────────────────────────────
    if (pathname === '/api/logs' && req.method === 'GET') {
      let lines = [];
      if (fs.existsSync(LOG_FILE)) {
        try {
          const content = fs.readFileSync(LOG_FILE, 'utf8');
          lines = content
            .trim()
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0)
            .slice(-60);
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ lines }));
      return;
    }

    // ── ARQUIVOS ESTÁTICOS DO FRONTEND ─────────────────────────
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Previne Directory Traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Acesso negado');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Página não encontrada');
  } catch (err) {
    console.error('[Dashboard Request Error]:', err);
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    } catch (_) {}
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Dashboard] A porta ${PORT} já está em uso.`);
  } else {
    console.error('[Dashboard Error]:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`  📊 Painel de Controle do Bot Guincho Ativo!`);
  console.log(`  Acesse no navegador: http://localhost:${PORT}`);
  console.log(`============================================================\n`);
});

module.exports = server;
