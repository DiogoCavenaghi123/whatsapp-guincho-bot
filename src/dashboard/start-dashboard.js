// =============================================================
//  Start Dashboard — Inicia o servidor e abre no navegador
// =============================================================

const { exec } = require('child_process');
const server = require('./server');

const PORT = process.env.DASHBOARD_PORT || 3000;
const URL = `http://localhost:${PORT}`;

// Abre automaticamente o navegador padrão
const startCmd = process.platform === 'win32' ? `start "" "${URL}"` : `open "${URL}"`;
exec(startCmd, () => {});
function openBrowser() {
  const startCmd = process.platform === 'win32' ? `start "" "${URL}"` : `open "${URL}"`;
  exec(startCmd, () => {});
}

// Abre o navegador somente quando a porta estiver realmente escutando
if (server.listening) {
  setTimeout(openBrowser, 500);
} else {
  server.once('listening', () => {
    setTimeout(openBrowser, 500);
  });
}
