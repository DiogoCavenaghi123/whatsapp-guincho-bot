const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n============================================================');
console.log('  Parando WhatsApp Guincho Bot...');
console.log('============================================================\n');

let killed = false;

// 1. Try PID file first
const pidPath = path.resolve(__dirname, '../.bot.pid');
if (fs.existsSync(pidPath)) {
  try {
    const pid = fs.readFileSync(pidPath, 'utf8').trim();
    if (pid) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      killed = true;
      console.log(`Processo PID ${pid} encerrado (via .bot.pid).`);
    }
    fs.unlinkSync(pidPath);
  } catch (e) {}
}

// 2. Fallback: find and kill any node process running src/index.js via WMIC
try {
  const out = execSync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv',
    { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }
  )
    .toString()
    .trim();

  const lines = out.split(/\r?\n/).filter(l => l.trim().length > 0);
  for (const line of lines) {
    if (line.includes('src/index.js') || line.includes('src\\index.js')) {
      const parts = line.split(',');
      const pid = parts[parts.length - 1].trim();
      if (pid && /^\d+$/.test(pid)) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
          killed = true;
          console.log(`Processo PID ${pid} encerrado (via WMIC).`);
        } catch (e) {}
      }
    }
  }
} catch (e) {}

// 3. Matar processos chrome.exe órfãos da sessão do WhatsApp
if (process.platform === 'win32') {
  try {
    const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name LIKE '%chrome%'\\" | Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
    execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
  } catch (_) {}
}

// 4. Limpar travas órfãs do Chromium para o próximo início
const sessionDir = path.resolve(__dirname, '../.wwebjs_auth/session');
if (fs.existsSync(sessionDir)) {
  const lockFiles = [
    'lockfile',
    'DevToolsActivePort',
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
  ];
  for (const f of lockFiles) {
    try {
      const p = path.join(sessionDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
  }
}

// 5. Limpar arquivo .bot.cmd residual
const cmdPath = path.resolve(__dirname, '../.bot.cmd');
try {
  if (fs.existsSync(cmdPath)) fs.unlinkSync(cmdPath);
} catch (_) {}

if (killed) {
  console.log('\n\x1b[32m[ OK ] O bot foi finalizado com sucesso!\x1b[0m\n');
} else {
  console.log('\n\x1b[33m[INFO] Nenhum processo do bot encontrado em execucao (travas limpas).\x1b[0m\n');
}
