const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n============================================================');
console.log('  STATUS DO WHATSAPP GUINCHO BOT');
console.log('============================================================\n');

console.log('Verificando processos ativos...\n');
let running = false;

// Use WMIC which doesn't have the PowerShell $ escaping issues
try {
  const out = execSync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine,CreationDate /format:csv',
    { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 }
  )
    .toString()
    .trim();

  const lines = out.split(/\r?\n/).filter(l => l.trim().length > 0);
  for (const line of lines) {
    if (line.includes('src/index.js') || line.includes('src\\index.js')) {
      running = true;
      // CSV format: Node,CommandLine,CreationDate,ProcessId
      const parts = line.split(',');
      const pid = parts[parts.length - 1];
      const createdRaw = parts[parts.length - 2] || '';
      // Format WMIC date: 20260918134354.123456-180 -> 18/09/2026 13:43:54
      let created = createdRaw;
      if (createdRaw.length >= 14) {
        const y = createdRaw.substring(0, 4);
        const m = createdRaw.substring(4, 6);
        const d = createdRaw.substring(6, 8);
        const h = createdRaw.substring(8, 10);
        const mi = createdRaw.substring(10, 12);
        const s = createdRaw.substring(12, 14);
        created = `${d}/${m}/${y} ${h}:${mi}:${s}`;
      }
      console.log('\x1b[32m[ ATIVO ] O bot esta rodando em segundo plano!\x1b[0m');
      console.log(`  PID do Processo : ${pid}`);
      console.log(`  Iniciado em     : ${created}`);
    }
  }
} catch (e) {
  // WMIC failed, try tasklist fallback
  try {
    const out = execSync('tasklist /fi "imagename eq node.exe" /v /fo csv', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000,
    })
      .toString()
      .trim();
    if (out.includes('node.exe')) {
      // Can't filter by CommandLine with tasklist, just report nodes are running
      console.log('\x1b[33m[INFO] Processos node.exe detectados (nao foi possivel filtrar por index.js).\x1b[0m');
    }
  } catch (e2) {}
}

if (!running) {
  // Also check PID file as fallback
  const pidPath = path.resolve(__dirname, '../.bot.pid');
  if (fs.existsSync(pidPath)) {
    const pid = fs.readFileSync(pidPath, 'utf8').trim();
    if (pid) {
      try {
        // Check if PID is alive
        execSync(`tasklist /fi "PID eq ${pid}" /nh`, {
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        const tl = execSync(`tasklist /fi "PID eq ${pid}" /nh`, {
          stdio: ['ignore', 'pipe', 'ignore'],
        }).toString();
        if (tl.includes('node.exe')) {
          running = true;
          console.log('\x1b[32m[ ATIVO ] O bot esta rodando em segundo plano!\x1b[0m');
          console.log(`  PID do Processo : ${pid} (via arquivo .bot.pid)`);
        }
      } catch (e) {}
    }
  }
}

if (!running) {
  console.log('\x1b[31m[ PARADO ] O bot NAO esta em execucao no momento.\x1b[0m');
}

console.log('\n------------------------------------------------------------');
console.log('  Ultimas 15 linhas do registro (logs/bot.log):');
console.log('------------------------------------------------------------');
const logFile = path.resolve(__dirname, '../logs/bot.log');
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8').trim();
  if (content.length > 0) {
    const lines = content.split(/\r?\n/);
    const tail = lines.slice(-15);
    console.log(tail.join('\n'));
  } else {
    console.log('  Arquivo de log vazio.');
  }
} else {
  console.log('  Nenhum registro gravado ainda.');
}
console.log('------------------------------------------------------------\n');
