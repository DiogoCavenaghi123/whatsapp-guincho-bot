const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pidFile = path.resolve(__dirname, '../.bot.pid');
if (fs.existsSync(pidFile)) {
  const oldPid = fs.readFileSync(pidFile, 'utf8').trim();
  if (oldPid) {
    try {
      process.kill(Number(oldPid), 0);
      console.log('\x1b[33m[AVISO] O bot já está rodando em segundo plano (PID: ' + oldPid + ').\x1b[0m');
      process.exit(0);
    } catch (e) {
      // Processo anterior não está mais ativo, limpa o arquivo stale
      try {
        fs.unlinkSync(pidFile);
      } catch (err) {}
    }
  }
}

console.log('\n============================================================');
console.log('  🚀 Iniciando WhatsApp Guincho Bot em Segundo Plano...');
console.log('============================================================\n');

const logOut = fs.openSync(path.resolve(__dirname, '../logs/bot.log'), 'a');
const logErr = fs.openSync(path.resolve(__dirname, '../logs/bot.err.log'), 'a');

function getNodeExecutable() {
  if (process.execPath && path.basename(process.execPath).toLowerCase().startsWith('node')) {
    return process.execPath;
  }
  const defaultNode = 'C:\\Program Files\\nodejs\\node.exe';
  if (fs.existsSync(defaultNode)) return defaultNode;
  return 'node';
}

const nodeExe = getNodeExecutable();
const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(nodeExe, [path.resolve(__dirname, 'index.js')], {
  detached: true,
  stdio: ['ignore', logOut, logErr],
  windowsHide: true,
  cwd: path.resolve(__dirname, '..'),
  env: cleanEnv,
});

child.unref();

console.log('\x1b[32m[ OK ] Bot iniciado com sucesso em segundo plano! (PID: ' + child.pid + ')\x1b[0m');
console.log('Para acompanhar as atividades, use o atalho "Ver Status do Bot" na Área de Trabalho.\n');
