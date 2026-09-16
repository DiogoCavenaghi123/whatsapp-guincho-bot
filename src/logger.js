// =============================================================
//  Logger — Logs formatados com cores e timestamps
// =============================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatMsg(level, color, ...args) {
  const ts = `${COLORS.gray}[${timestamp()}]${COLORS.reset}`;
  const tag = `${color}[${level}]${COLORS.reset}`;
  console.log(ts, tag, ...args);
}

const logger = {
  info: (...args) => formatMsg('INFO', COLORS.blue, ...args),
  success: (...args) => formatMsg(' OK ', COLORS.green, ...args),
  warn: (...args) => formatMsg('WARN', COLORS.yellow, ...args),
  error: (...args) => formatMsg('ERRO', COLORS.red, ...args),
  debug: (...args) => formatMsg('DEBUG', COLORS.gray, ...args),
  bot: (...args) => formatMsg(' BOT', COLORS.cyan, ...args),
};

module.exports = logger;

