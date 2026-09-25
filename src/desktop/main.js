// =============================================================
//  Main Electron Controller — Grupo Hazul WhatsApp Guincho Bot
// =============================================================

const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
const LOG_FILE = path.join(LOGS_DIR, 'electron.log');
function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

log('Electron main starting...');

process.on('uncaughtException', (err) => {
  log('Uncaught exception: ' + (err.stack || err.message));
});

// Garante instância única (não abre várias janelas duplicadas)
const gotSingleLock = app.requestSingleInstanceLock();
log('Got single instance lock: ' + gotSingleLock);
if (!gotSingleLock) {
  log('Another instance is running. Quitting.');
  app.quit();
  process.exit(0);
}

// Configura o AppUserModelId no Windows para a Barra de Tarefas (Taskbar)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.grupohazul.guinchobot');
}

let mainWindow = null;
let tray = null;
let serverInstance = null;
let isQuitting = false;

const PORT = process.env.DASHBOARD_PORT || 3000;
const ICON_PATH = fs.existsSync(path.join(__dirname, '../dashboard/public/assets/logo.ico'))
  ? path.join(__dirname, '../dashboard/public/assets/logo.ico')
  : path.join(__dirname, '../dashboard/public/assets/logo.png');

function startInternalServer() {
  const http = require('http');
  const req = http.get(`http://localhost:${PORT}/api/status`, (res) => {
    log('[Electron] Servidor HTTP já está ativo na porta ' + PORT);
  });
  req.on('error', () => {
    try {
      serverInstance = require('../dashboard/server');
      log('[Electron] Servidor interno HTTP inicializado na porta ' + PORT);
    } catch (err) {
      log('[Electron] Erro ao carregar servidor interno: ' + (err.stack || err.message));
    }
  });
}

function createWindow() {
  const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 980,
    minHeight: 650,
    title: 'Grupo Hazul — Bot WhatsApp & Painel Logístico',
    backgroundColor: '#090d16',
    icon,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (icon) {
    mainWindow.setIcon(icon);
  }

  // Remove o menu padrão para aparência limpa de aplicativo moderno
  Menu.setApplicationMenu(null);

  const appUrl = `http://localhost:${PORT}`;

  const loadApp = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    log(`Carregando aplicativo em: ${appUrl}`);
    mainWindow.loadURL(appUrl).then(() => {
      log('Aplicativo carregado com sucesso na tela!');
    }).catch((err) => {
      log(`Aguardando servidor HTTP responder (${err.message}). Retentando em 500ms...`);
      setTimeout(loadApp, 500);
    });
  };

  loadApp();

  // Limpa o cache para sempre carregar os arquivos mais recentes
  mainWindow.webContents.session.clearCache();

  // Habilita atalho F5 e Ctrl+R para recarregamento forçado da interface
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      log('Recarregamento forçado acionado pelo usuário (F5 / Ctrl+R)');
      mainWindow.webContents.session.clearCache().then(() => {
        mainWindow.webContents.reloadIgnoringCache();
      });
    }
  });

  mainWindow.show();
  mainWindow.focus();

  // Intercepta fechamento da janela: minimiza para a bandeja em vez de encerrar o bot
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (Notification.isSupported()) {
        try {
          new Notification({
            title: 'Bot Guincho Hazul em Segundo Plano',
            body: 'O aplicativo continua ativo na barra de tarefas para processar agendamentos.',
            icon,
          }).show();
        } catch (_) {}
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const TRAY_ICON_PATH = fs.existsSync(path.join(__dirname, '../dashboard/public/assets/logo.png'))
  ? path.join(__dirname, '../dashboard/public/assets/logo.png')
  : ICON_PATH;

function createTray() {
  try {
    const icon = fs.existsSync(TRAY_ICON_PATH)
      ? nativeImage.createFromPath(TRAY_ICON_PATH).resize({ width: 16, height: 16 })
      : (fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : nativeImage.createEmpty());

    tray = new Tray(icon);
    tray.setToolTip('Grupo Hazul — Bot WhatsApp Guincho');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Painel Principal',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Recarregar Painel (F5)',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.session.clearCache().then(() => {
              mainWindow.webContents.reloadIgnoringCache();
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Abrir no Navegador Web',
        click: () => {
          const { shell } = require('electron');
          shell.openExternal(`http://localhost:${PORT}`);
        },
      },
      { type: 'separator' },
      {
        label: 'Fechar Aplicativo Completamente',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createWindow();
      }
    });

    tray.on('click', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    log('Falha ao inicializar Tray (bandeja): ' + (err.stack || err.message));
  }
}

// Segunda instância foca na janela já existente e recarrega os dados
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.webContents.reloadIgnoringCache();
    });
  }
});

app.whenReady().then(() => {
  log('app.whenReady fired successfully!');
  try {
    createWindow();
    log('Window created.');
    createTray();
    log('Tray created.');
    startInternalServer();
    log('Internal server checked.');
  } catch (err) {
    log('Error in app.whenReady: ' + err.stack);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  log('app before-quit fired');
  isQuitting = true;
});

app.on('will-quit', () => {
  log('app will-quit fired');
});

app.on('quit', (event, exitCode) => {
  log(`app quit fired with exitCode: ${exitCode}`);
});

process.on('exit', (code) => {
  log(`process exit fired with code: ${code}`);
});

app.on('window-all-closed', () => {
  log(`window-all-closed fired (isQuitting: ${isQuitting}, platform: ${process.platform})`);
  if (process.platform !== 'win32' || isQuitting) {
    app.quit();
  }
});

// IPC Handlers
ipcMain.on('app:minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('app:notify', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined;
    new Notification({ title, body, icon }).show();
  }
});

ipcMain.handle('app:version', () => app.getVersion());
