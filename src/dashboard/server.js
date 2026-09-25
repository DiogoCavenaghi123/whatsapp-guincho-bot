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
const settings = require('../settings');
const dealerships = require('../dealerships');

const PORT = process.env.DASHBOARD_PORT || 3000;
const PROJ_ROOT = path.resolve(__dirname, '../..');
const PID_FILE = path.join(PROJ_ROOT, '.bot.pid');
const CMD_FILE = path.join(PROJ_ROOT, '.bot.cmd');
const LOG_FILE = path.join(PROJ_ROOT, 'logs/bot.log');
const PUBLIC_DIR = path.join(__dirname, 'public');

function getNodeExecutable() {
  if (process.execPath && path.basename(process.execPath).toLowerCase().startsWith('node')) {
    return process.execPath;
  }
  const defaultNode = 'C:\\Program Files\\nodejs\\node.exe';
  if (fs.existsSync(defaultNode)) return defaultNode;
  try {
    const out = execSync('where.exe node', { encoding: 'utf8', timeout: 2000 }).trim().split(/\r?\n/)[0];
    if (out && fs.existsSync(out)) return out;
  } catch (_) {}
  return 'node';
}

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
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
    return { running: false, pid: null, startedAt: null };
  }

  // 1. Checagem nativa ultra-rápida (0.01ms) sem invocar processos externos
  try {
    process.kill(pid, 0);
  } catch (e) {
    // Processo definitivamente não existe
    // Processo definitivamente não existe - limpa o arquivo stale
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
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
    } else {
      try { fs.unlinkSync(PID_FILE); } catch (_) {}
      return { running: false, pid: null, startedAt: null };
    }
  } catch (e) {}

  return { running: false, pid: null, startedAt: null };
  } catch (e) {
    return { running: true, pid };
  }
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

      let logSizeMB = 0;
      if (fs.existsSync(LOG_FILE)) {
        try {
          const st = fs.statSync(LOG_FILE);
          logSizeMB = Math.round((st.size / (1024 * 1024)) * 10) / 10;
        } catch (e) {}
      }

      const targetMonth = cycleInfo.monthIndex;
      const targetYear = cycleInfo.year;
      const prevDate = new Date(targetYear, targetMonth - 1, 24);
      const endDate = new Date(targetYear, targetMonth, 23);
      const cycleStartStr = `${String(prevDate.getDate()).padStart(2, '0')}/${String(prevDate.getMonth() + 1).padStart(2, '0')}/${prevDate.getFullYear()}`;
      const cycleEndStr = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;
      const lastSyncTime = new Date().toLocaleTimeString('pt-BR');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          running: proc.running,
          pid: proc.pid,
          stats,
          groupRepliesEnabled: settings.isGroupRepliesEnabled(),
          activeTab: cycleInfo.expectedTabName,
          cycleRange: `24/${String(cycleInfo.monthIndex === 0 ? 12 : cycleInfo.monthIndex).padStart(2, '0')} até 23/${String(cycleInfo.monthIndex + 1).padStart(2, '0')}`,
          sheetName: 'Guincho',
          lastSyncTime,
          cycleStart: cycleStartStr,
          cycleEnd: cycleEndStr,
          cycleRange: `${cycleStartStr} → ${cycleEndStr}`,
          logSizeMB,
          system: {
            memoryRssMB: Math.round(mem.rss / (1024 * 1024)),
            memoryHeapMB: Math.round(mem.heapUsed / (1024 * 1024)),
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
          },
          config: {
            botSchedule: '07:00 às 19:00 (Diário)',
            groupRepliesEnabled: settings.isGroupRepliesEnabled(),
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

    // ── API: TOGGLE RESPOSTAS NO GRUPO ─────────────────────────
    if (pathname === '/api/settings/toggle-replies' && req.method === 'POST') {
      try {
        const nextState = settings.toggleGroupReplies();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            groupRepliesEnabled: nextState,
            message: nextState
              ? 'Mensagens de resposta no grupo do WhatsApp ATIVADAS com sucesso!'
              : 'Modo Silencioso ATIVADO: Mensagens no grupo desativadas. O bot continua salvando na planilha normalmente.',
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
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

    // ── API: RECALCULAR CUSTOS E VEÍCULOS DE UMA ABA ───────────
    if (pathname === '/api/recalculate-month' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
          const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
          await sheets.init(credsPath);

          let targetTab = 'SETEMBRO 2026';
          if (body) {
            try {
              const parsed = JSON.parse(body);
              if (parsed.tab) targetTab = parsed.tab;
            } catch (_) {}
          }

          const result = await sheets.recalculateMonthTransportCosts(sheetId, targetTab);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              success: true,
              message: `Recálculo concluído com sucesso! ${result.updatedCount} linhas atualizadas na aba "${targetTab}".`,
              updatedCount: result.updatedCount,
            })
          );
        } catch (err) {
          console.error('[Dashboard /api/recalculate-month Error]:', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: 'Erro ao recalcular: ' + err.message }));
        }
      });
      return;
    }

    // ── API: DADOS DO PAINEL DE TRANSPARÊNCIA ──────────────────
    if (pathname === '/api/transparency' && req.method === 'GET') {
      try {
        const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
        const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
        await sheets.init(credsPath);

        let targetTab = parsedUrl.query.tab;
        if (!targetTab) {
          targetTab = 'SETEMBRO 2026';
        }

        const data = await sheets.getMonthTransparencyData(sheetId, targetTab);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, ...data }));
      } catch (err) {
        console.error('[Dashboard /api/transparency Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: 'Erro ao carregar dados de transparência: ' + err.message }));
      }
      return;
    }

    // ── API: ATUALIZAR ROTA DE AGENDAMENTO (ORIGEM/DESTINO) ────
    if (pathname === '/api/transports/update-route' && req.method === 'POST') {
      let bodyData = '';
      req.on('data', (chunk) => (bodyData += chunk));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyData || '{}');
          const sheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
          const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
          await sheets.init(credsPath);

          const sheetName = payload.tab || 'SETEMBRO 2026';
          const rowNumber = parseInt(payload.rowNumber);
          const novaOrigem = payload.origem || '';
          const novoDestino = payload.destino || '';

          if (!rowNumber || isNaN(rowNumber)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Número da linha inválido.' }));
            return;
          }

          if (!novaOrigem || !novoDestino) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Origem e destino são obrigatórios.' }));
            return;
          }

          const result = await sheets.updateRowRoute(sheetId, sheetName, rowNumber, novaOrigem, novoDestino);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: `Linha ${rowNumber} atualizada com sucesso na planilha "${sheetName}"!`,
            ...result,
          }));
        } catch (err) {
          console.error('[Dashboard /api/transports/update-route Error]:', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: 'Erro ao atualizar rota na planilha: ' + err.message }));
        }
      });
      return;
    }

    // ── API: INICIAR BOT ───────────────────────────────────────
    if (pathname === '/api/start' && req.method === 'POST') {
      const proc = getBotProcessInfo();
      if (proc.running) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'O bot já está em execução!' }));
        res.end(JSON.stringify({ success: false, message: `O bot já está em execução (PID: ${proc.pid})!` }));
        return;
      }

      // Garante remoção de arquivo PID stale
      if (fs.existsSync(PID_FILE)) {
        try { fs.unlinkSync(PID_FILE); } catch (_) {}
      }

      try {
        const startScript = path.join(PROJ_ROOT, 'src/start-bg.js');
        const child = spawn(process.execPath, [startScript], {
        const nodeExe = getNodeExecutable();
        const indexScript = path.join(PROJ_ROOT, 'src/index.js');
        const logOut = fs.openSync(LOG_FILE, 'a');
        const errLogFile = path.join(PROJ_ROOT, 'logs/bot.err.log');
        const logErr = fs.openSync(errLogFile, 'a');

        const cleanEnv = { ...process.env };
        delete cleanEnv.ELECTRON_RUN_AS_NODE;

        const child = spawn(nodeExe, [indexScript], {
          detached: true,
          stdio: 'ignore',
          stdio: ['ignore', logOut, logErr],
          windowsHide: true,
          cwd: PROJ_ROOT,
          env: cleanEnv,
        });

        child.unref();

        if (child.pid) {
          fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Bot iniciado em segundo plano com sucesso!' }));
        res.end(JSON.stringify({ success: true, message: `Bot iniciado com sucesso! (PID: ${child.pid})` }));
      } catch (err) {
        console.error('[Dashboard /api/start Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
        res.end(JSON.stringify({ success: false, message: 'Erro ao iniciar bot: ' + err.message }));
      }
      return;
    }

    // ── API: PARAR BOT ─────────────────────────────────────────
    if (pathname === '/api/stop' && req.method === 'POST') {
      try {
        const nodeExe = getNodeExecutable();
        const stopScript = path.join(PROJ_ROOT, 'src/stop.js');
        execSync(`node "${stopScript}"`, { stdio: 'ignore', timeout: 8000, cwd: PROJ_ROOT });
        execSync(`"${nodeExe}" "${stopScript}"`, { stdio: 'ignore', timeout: 8000, cwd: PROJ_ROOT });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Bot finalizado com sucesso!' }));
      } catch (err) {
        console.error('[Dashboard /api/stop Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
        res.end(JSON.stringify({ success: false, message: 'Erro ao parar bot: ' + err.message }));
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

    // ── API: LISTAGEM DE CONCESSIONÁRIAS ──────────────────────
    if (pathname === '/api/dealerships' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, dealerships: dealerships.getAllDealerships() }));
      return;
    }

    // ── API: FILA DE APROVAÇÕES ────────────────────────────────
    if (pathname === '/api/approvals' && req.method === 'GET') {
      const items = history.getPendingApprovals();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, items }));
      return;
    }

    // ── API: APROVAR E LANÇAR NA PLANILHA ──────────────────────
    if (pathname === '/api/approvals/approve' && req.method === 'POST') {
      let bodyData = '';
      req.on('data', (chunk) => (bodyData += chunk));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyData || '{}');
          if (!payload.id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'ID da solicitação é obrigatório.' }));
            return;
          }

          const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
          const credsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
          await sheets.init(credsPath);

          const finalData = payload.data || new Date().toLocaleDateString('pt-BR');
          const finalDepto = (payload.departamento || 'NOVOS').trim().toUpperCase();
          const finalCarro = (payload.veiculo || 'VIAGEM GUINCHO').trim().toUpperCase();
          const finalChassi = (payload.chassiPlaca || '-').trim().toUpperCase();
          const finalOrigem = dealerships.standardizeDealershipName(payload.origem, (payload.origem || '').trim().toUpperCase());
          const finalDestino = dealerships.standardizeDealershipName(payload.destino, (payload.destino || '').trim().toUpperCase());
          const finalTransporte = (payload.transporte || 'PLATAFORMA').trim().toUpperCase();
          const finalFaturar = dealerships.standardizeDealershipName(payload.faturarPara, (payload.faturarPara || '').trim().toUpperCase());

          const rowData = [
            finalData,
            finalDepto,
            finalCarro,
            finalChassi,
            finalOrigem,
            finalDestino,
            finalTransporte,
            finalFaturar,
          ];

          if (payload.custoViagem) {
            let cStr = String(payload.custoViagem).replace(/R\$\s*/i, '').trim();
            if (cStr.includes(',') && !cStr.includes('.')) {
              cStr = cStr.replace(',', '.');
            } else if (cStr.includes('.') && cStr.includes(',')) {
              cStr = cStr.replace(/\./g, '').replace(',', '.');
            }
            const n = parseFloat(cStr);
            if (!isNaN(n) && n > 0) {
              rowData[8] = 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          }
          if (payload.veiculosPorViagem && Number(payload.veiculosPorViagem) > 0) {
            rowData[9] = String(payload.veiculosPorViagem);
          }

          let msgDate = new Date();
          if (payload.msgTimestamp) {
            msgDate = new Date(payload.msgTimestamp);
          } else if (payload.data) {
            const parts = payload.data.split(/[\/\-]/);
            if (parts.length === 3) {
              msgDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          }

          await sheets.appendRow(spreadsheetId, rowData, msgDate);

          history.updateMessage(payload.id, {
            status: 'AGENDAMENTO',
            approved: true,
            approvedAt: new Date().toISOString(),
            extractedData: {
              ...(payload.extractedData || {}),
              veiculo: finalCarro,
              chassiPlaca: finalChassi,
              origem: finalOrigem,
              destino: finalDestino,
              departamento: finalDepto,
              transporte: finalTransporte,
              faturarPara: finalFaturar,
              agendarPara: finalData,
            },
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: 'Viagem aprovada e lançada na planilha com sucesso!' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: 'Erro ao aprovar viagem: ' + err.message }));
        }
      });
      return;
    }

    // ── API: REJEITAR / DESCARTAR SOLICITAÇÃO ──────────────────
    if (pathname === '/api/approvals/reject' && req.method === 'POST') {
      let bodyData = '';
      req.on('data', (chunk) => (bodyData += chunk));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyData || '{}');
          if (!payload.id) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'ID da solicitação é obrigatório.' }));
            return;
          }

          history.updateMessage(payload.id, {
            status: 'DESCARTADO',
            reason: payload.reason || 'Descartado manualmente pelo operador no painel',
            rejectedAt: new Date().toISOString(),
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: 'Solicitação descartada com sucesso.' }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
      return;
    }

    // ── API: ESTIMATIVA DE CUSTO DA ROTA ───────────────────────
    if (pathname === '/api/costs/estimate' && req.method === 'GET') {
      try {
        const origem = parsedUrl.query.origem || '';
        const destino = parsedUrl.query.destino || '';
        const transporte = parsedUrl.query.transporte || 'PLATAFORMA';
        const qtd = parseInt(parsedUrl.query.qtd) || 1;

        const cost = sheets.resolveTripCost(origem, destino, transporte, qtd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, cost }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
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
<<<<<<< HEAD
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
=======
>>>>>>> c8e4980 (fix(dashboard): adiciona headers no-cache e suporte a requisicoes HEAD para prevencao de travamento)
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
<<<<<<< HEAD
=======
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
>>>>>>> c8e4980 (fix(dashboard): adiciona headers no-cache e suporte a requisicoes HEAD para prevencao de travamento)
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
