const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projDir = path.resolve(__dirname, '..');
const desktopDir = path.resolve(process.env.USERPROFILE || 'C:\\Users\\Grupo Hazul', 'Desktop');
const botFolder = path.join(desktopDir, 'BOT DO WHATSAPP');

console.log('Pasta do projeto:', projDir);
console.log('Pasta da Área de Trabalho:', desktopDir);
console.log('Pasta BOT DO WHATSAPP:', botFolder);

if (!fs.existsSync(botFolder)) {
  fs.mkdirSync(botFolder, { recursive: true });
}

// 1. Limpar atalhos antigos dentro de BOT DO WHATSAPP
const oldFiles = fs.readdirSync(botFolder);
for (const f of oldFiles) {
  if (f.endsWith('.lnk')) {
    try {
      fs.unlinkSync(path.join(botFolder, f));
      console.log('Removido atalho antigo:', f);
    } catch (e) {
      console.error('Erro ao remover', f, e.message);
    }
  }
}

// 2. Limpar atalhos soltos na Área de Trabalho principal criados anteriormente
const desktopLoose = [
  'Painel de Controle Guincho.lnk',
  'Iniciar Bot + Painel.lnk',
  'Parar Bot.lnk',
  'Painel do Bot.lnk',
  'Iniciar Bot Guincho.lnk',
];
for (const f of desktopLoose) {
  const p = path.join(desktopDir, f);
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      console.log('Removido atalho solto da Área de Trabalho:', f);
    } catch (e) {}
  }
}

// 3. Criar os 4 atalhos essenciais e definitivos dentro de BOT DO WHATSAPP
const shortcuts = [
  {
    name: '1. Iniciar Bot (Segundo Plano).lnk',
    target: path.join(projDir, 'iniciar-segundo-plano.vbs'),
    desc: 'Inicia o WhatsApp Guincho Bot silenciosamente em segundo plano',
  },
  {
    name: '2. Painel de Controle (Dashboard).lnk',
    target: path.join(projDir, 'iniciar-painel.bat'),
    desc: 'Abre o Painel de Controle no navegador (http://localhost:3000)',
  },
  {
    name: '3. Iniciar Bot + Painel (Completo).lnk',
    target: path.join(projDir, 'iniciar-tudo.bat'),
    desc: 'Inicia o Bot do WhatsApp e abre o Painel de Controle juntos',
  },
  {
    name: '4. Parar Bot.lnk',
    target: path.join(projDir, 'parar-bot.bat'),
    desc: 'Encerra o WhatsApp Guincho Bot com segurança e libera travas',
  },
];

for (const sc of shortcuts) {
  const scPath = path.join(botFolder, sc.name);
  const psCmd = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${scPath.replace(/'/g, "''")}'); $s.TargetPath = '${sc.target.replace(/'/g, "''")}'; $s.WorkingDirectory = '${projDir.replace(/'/g, "''")}'; $s.Description = '${sc.desc.replace(/'/g, "''")}'; $s.Save()"`;
  try {
    execSync(psCmd, { stdio: 'ignore' });
    console.log('[OK] Criado:', sc.name);
  } catch (err) {
    console.error('Erro ao criar atalho', sc.name, err.message);
  }
}

console.log('\nAtalhos atualizados com sucesso na pasta BOT DO WHATSAPP!');

