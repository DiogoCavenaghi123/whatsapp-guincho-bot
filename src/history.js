// =============================================================
//  History — Gerenciador e Persistência do Histórico de Mensagens
// =============================================================

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const LOGS_DIR = path.resolve(__dirname, '../logs');
const HISTORY_FILE = path.join(LOGS_DIR, 'messages_history.json');
const MAX_HISTORY_ENTRIES = 2000;

let memoryCache = null;

function ensureHistoryFile() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]), 'utf8');
  }
}

function loadHistory() {
  if (memoryCache !== null) return memoryCache;
  ensureHistoryFile();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    memoryCache = JSON.parse(raw);
    if (!Array.isArray(memoryCache)) memoryCache = [];
  } catch (err) {
    logger.warn(`Erro ao ler histórico de mensagens: ${err.message}. Criando novo.`);
    memoryCache = [];
  }
  return memoryCache;
}

function saveHistory() {
  ensureHistoryFile();
  try {
    // Mantém no máximo as MAX_HISTORY_ENTRIES mais recentes
    if (memoryCache && memoryCache.length > MAX_HISTORY_ENTRIES) {
      memoryCache = memoryCache.slice(-MAX_HISTORY_ENTRIES);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(memoryCache || [], null, 2), 'utf8');
  } catch (err) {
    logger.error(`Erro ao salvar histórico de mensagens: ${err.message}`);
  }
}

/**
 * Registra uma mensagem processada no histórico persistente.
 *
 * @param {object} entry
 * @param {string} entry.messageId
 * @param {Date|number|string} [entry.timestamp]
 * @param {string} [entry.author]
 * @param {string} entry.body
 * @param {'AGENDAMENTO'|'DUPLICADO'|'DESCARTADO'} entry.status
 * @param {string} [entry.reason]
 * @param {object} [entry.extractedData]
 * @param {number} [entry.sheetRow]
 * @param {string} [entry.sheetTab]
 */
function recordMessage(entry) {
  const history = loadHistory();

  const formattedDate = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');

  const record = {
    id: entry.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    date: formattedDate,
    rawTimestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
    author: entry.author || 'Desconhecido',
    body: (entry.body || '').trim(),
    texto: (entry.texto || entry.body || '').trim(),
    status: entry.status || 'DESCARTADO', // 'AGENDAMENTO', 'DUPLICADO', 'DESCARTADO', 'PENDENTE_APROVACAO'
    reason: entry.reason || '',
    tipoMensagem: entry.tipoMensagem || '',
    dadosExtraidos: entry.dadosExtraidos || entry.extractedData || null,
    extractedData: entry.extractedData || entry.dadosExtraidos || null,
    sheetRow: entry.sheetRow || null,
    sheetTab: entry.sheetTab || null,
  };

  // Se já existe uma entrada com esse id, atualiza; senão adiciona
  const idx = history.findIndex((h) => h.id === record.id);
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...record };
  } else {
    history.push(record);
  }

  saveHistory();
  return record;
}

/**
 * Consulta mensagens no histórico com filtros, busca e paginação.
 */
function getHistory({ status, search, limit = 50, offset = 0 } = {}) {
  let list = [...loadHistory()];

  // Ordem decrescente (mais recente primeiro)
  list.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));

  if (status && status !== 'TODOS') {
    list = list.filter((item) => item.status === status);
  }

  if (search && search.trim().length > 0) {
    const s = search.trim().toLowerCase();
    list = list.filter(
      (item) =>
        item.body.toLowerCase().includes(s) ||
        (item.author && item.author.toLowerCase().includes(s)) ||
        (item.extractedData && JSON.stringify(item.extractedData).toLowerCase().includes(s)) ||
        (item.reason && item.reason.toLowerCase().includes(s))
    );
  }

  const total = list.length;
  const paginated = list.slice(offset, offset + limit);

  return {
    total,
    offset,
    limit,
    items: paginated,
  };
}

/**
 * Retorna estatísticas gerais das mensagens lidas.
 */
function getStats() {
  const list = loadHistory();
  const agendamentos = list.filter((i) => i.status === 'AGENDAMENTO' || i.status === 'APROVADO').length;
  const duplicados = list.filter((i) => i.status === 'DUPLICADO').length;
  const descartados = list.filter((i) => i.status === 'DESCARTADO').length;
  const pendentesAprovacao = list.filter((i) => i.status === 'PENDENTE_APROVACAO').length;

  return {
    totalLidas: list.length,
    agendamentos,
    duplicados,
    descartados,
    pendentesAprovacao,
  };
}

/**
 * Retorna as mensagens que aguardam aprovação operacional.
 */
function getPendingApprovals() {
  const list = loadHistory();
  return list
    .filter((i) => i.status === 'PENDENTE_APROVACAO')
    .sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
}

/**
 * Atualiza os dados ou status de uma mensagem específica no histórico.
 */
function updateMessage(id, patch) {
  const history = loadHistory();
  const idx = history.findIndex((h) => h.id === id);
  if (idx === -1) return null;

  history[idx] = { ...history[idx], ...patch };
  saveHistory();
  return history[idx];
}

module.exports = {
  recordMessage,
  getHistory,
  getStats,
  getPendingApprovals,
  updateMessage,
};


