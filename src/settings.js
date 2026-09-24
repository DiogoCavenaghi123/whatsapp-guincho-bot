// =============================================================
//  Settings — Gerenciador de Configurações e Modo Silencioso
// =============================================================

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const LOGS_DIR = path.resolve(__dirname, '../logs');
const SETTINGS_FILE = path.join(LOGS_DIR, 'bot_settings.json');

let cachedSettings = null;
let lastMtime = 0;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    } catch (_) {}
  }
}

function getDefaultSettings() {
  const envDefault = process.env.WHATSAPP_SEND_REPLIES !== 'false' &&
                     process.env.WHATSAPP_REPLY_ENABLED !== 'false';
  return {
    groupRepliesEnabled: envDefault, // true por padrão
    updatedAt: new Date().toISOString(),
  };
}

function loadSettings() {
  ensureLogsDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const stat = fs.statSync(SETTINGS_FILE);
      if (cachedSettings && stat.mtimeMs === lastMtime) {
        return cachedSettings;
      }
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cachedSettings = {
        ...getDefaultSettings(),
        ...parsed,
      };
      lastMtime = stat.mtimeMs;
      return cachedSettings;
    }
  } catch (err) {
    logger.warn(`Aviso ao ler configurações (${err.message}). Usando padrões.`);
  }

  cachedSettings = getDefaultSettings();
  saveSettings(cachedSettings);
  return cachedSettings;
}

function saveSettings(newSettings) {
  ensureLogsDir();
  try {
    cachedSettings = {
      ...getDefaultSettings(),
      ...newSettings,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cachedSettings, null, 2), 'utf8');
    try {
      lastMtime = fs.statSync(SETTINGS_FILE).mtimeMs;
    } catch (_) {}
    return cachedSettings;
  } catch (err) {
    logger.error(`Erro ao salvar configurações do bot: ${err.message}`);
    return cachedSettings || getDefaultSettings();
  }
}

/**
 * Retorna se o bot deve enviar respostas de confirmação no grupo do WhatsApp
 * @returns {boolean}
 */
function isGroupRepliesEnabled() {
  const s = loadSettings();
  return s.groupRepliesEnabled !== false;
}

/**
 * Define se o bot pode enviar respostas de confirmação no grupo
 * @param {boolean} enabled
 */
function setGroupRepliesEnabled(enabled) {
  const current = loadSettings();
  return saveSettings({
    ...current,
    groupRepliesEnabled: !!enabled,
  });
}

/**
 * Alterna (toggle) o envio de mensagens no grupo
 * @returns {boolean} Novo estado
 */
function toggleGroupReplies() {
  const current = loadSettings();
  const next = !current.groupRepliesEnabled;
  setGroupRepliesEnabled(next);
  return next;
}

module.exports = {
  getSettings: loadSettings,
  saveSettings,
  isGroupRepliesEnabled,
  setGroupRepliesEnabled,
  toggleGroupReplies,
};

