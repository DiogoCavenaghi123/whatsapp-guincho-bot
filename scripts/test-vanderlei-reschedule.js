// =============================================================
//  Teste de Reagendamento / Confirmação de Data por Vanderlei G
// =============================================================

require('dotenv').config();
const { extractRescheduleDate } = require('../src/parser');
const sheets = require('../src/sheets');

async function runTest() {
  console.log('\n============================================================');
  console.log('  🧪 TESTE DE VALIDAÇÃO: Resposta de Vanderlei G');
  console.log('============================================================\n');

  // 1. Testa extração de data do texto
  console.log('1. Testando extractRescheduleDate...');
  const cases = [
    { text: 'Agendado 29/09 cegonha', expected: '29/09/2026' },
    { text: 'Agendado 29/09', expected: '29/09/2026' },
    { text: 'Agendado para 05/10/26', expected: '05/10/2026' },
    { text: 'Confirmado 30/09', expected: '30/09/2026' },
    { text: '29/09 cegonha', expected: '29/09/2026' },
    { text: 'Bom dia pessoal', expected: null },
    { text: 'Ok, fechado', expected: null },
  ];

  for (const c of cases) {
    const res = extractRescheduleDate(c.text, new Date(2026, 8, 28)); // ref: 28/09/2026
    const ok = res === c.expected;
    console.log(`  [${ok ? 'OK' : 'FAIL'}] "${c.text}" => ${res} (esperado: ${c.expected})`);
    if (!ok) throw new Error(`Falha no teste de parser: ${c.text}`);
  }

  // 1.1. Testa isVanderleiSender
  console.log('\n1.1. Testando identificação exclusiva de Vanderlei G...');
  const { isVanderleiSender } = require('../src/whatsapp');
  const vanderleiTests = [
    { msg: { author: '5519999241783@c.us' }, contact: null, sender: '', expected: true, desc: 'JID oficial com 9 dígitos' },
    { msg: { author: '551999241783@c.us' }, contact: null, sender: '', expected: true, desc: 'JID oficial sem 9º dígito' },
    { msg: { author: '551988887777@c.us' }, contact: { number: '5519999241783', name: 'Vanderlei' }, sender: '', expected: true, desc: 'Contato com número e nome' },
    { msg: { author: '551988887777@c.us', _data: { notifyName: 'Vanderlei G' } }, contact: null, sender: '', expected: true, desc: 'NotifyName Vanderlei G' },
    { msg: { author: '551988887777@c.us' }, contact: null, sender: 'Vanderlei G', expected: true, desc: 'SenderName Vanderlei G' },
    { msg: { author: '551988887777@c.us' }, contact: null, sender: 'Adriano Vendas', expected: false, desc: 'Outro remetente (Adriano)' },
    { msg: { author: '5511999999999@c.us' }, contact: { number: '5511999999999', name: 'Fabiana' }, sender: 'Fabiana', expected: false, desc: 'Outro remetente (Fabiana)' },
  ];

  for (const vt of vanderleiTests) {
    const isV = isVanderleiSender(vt.msg, vt.contact, vt.sender);
    const ok = isV === vt.expected;
    console.log(`  [${ok ? 'OK' : 'FAIL'}] ${vt.desc}: ${isV} (esperado: ${vt.expected})`);
    if (!ok) throw new Error(`Falha na validação do remetente Vanderlei: ${vt.desc}`);
  }

  // 2. Inicializa Sheets
  console.log('\n2. Conectando ao Google Sheets...');
  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SPREADSHEET_ID;

  // 3. Insere transporte de teste com data 28/09/2026 e modalidade 'PLATAFORMA'
  const testChassi = 'TESTEVDL987654321';
  console.log(`\n3. Inserindo agendamento teste com Chassi: ${testChassi}, Data: 28/09/2026, Modalidade: PLATAFORMA...`);
  const initialRow = [
    '28/09/2026',
    'VENDAS NOVOS',
    'TIGGO 7 SPORT TESTE',
    testChassi,
    'MOGI MIRIM',
    'XIAN SAO JOAO DA BOA VISTA',
    'PLATAFORMA',
    'XIAN SJBV',
  ];

  await sheets.appendRow(spreadsheetId, initialRow, new Date(2026, 8, 28));

  // 4. Executa a alteração de data para 29/09/2026 solicitada por Vanderlei G
  console.log(`\n4. Executando findAndUpdateTransportDate para ${testChassi} -> Nova data: 29/09/2026...`);
  const updateResult = await sheets.findAndUpdateTransportDate(
    spreadsheetId,
    { chassi: testChassi, veiculo: 'TIGGO 7 SPORT TESTE' },
    '29/09/2026'
  );

  console.log('Resultado da alteração:', updateResult);
  if (!updateResult.success) {
    throw new Error('Falha ao atualizar a data do transporte!');
  }

  // 5. Verifica se a linha foi realmente atualizada mantendo a modalidade PLATAFORMA
  console.log('\n5. Verificando dados atualizados na planilha...');
  const rows = await sheets.getSheetRows(spreadsheetId, updateResult.updated.tab, false);
  const found = rows.find(r => (r[3] || '').includes(testChassi));

  if (!found) {
    throw new Error('Transporte não encontrado após atualização!');
  }

  console.log(`  ✓ Data na Coluna A: "${found[0]}" (esperado: 29/09/2026)`);
  console.log(`  ✓ Modalidade na Coluna G: "${found[6]}" (esperado: PLATAFORMA)`);
  console.log(`  ✓ Nota Fiscal na Coluna H: "${found[7]}" (esperado: XIAN SJBV)`);

  if (found[0] !== '29/09/2026') {
    throw new Error(`Data incorreta: ${found[0]}`);
  }
  if (found[6] !== 'PLATAFORMA') {
    throw new Error(`Modalidade foi alterada indevidamente: ${found[6]}`);
  }

  // 6. Limpeza: remove a linha de teste da planilha
  console.log('\n6. Limpando linha de teste com findAndCancelTransport...');
  const cancelResult = await sheets.findAndCancelTransport(spreadsheetId, { chassi: testChassi });
  console.log('Resultado da limpeza:', cancelResult);

  console.log('\n============================================================');
  console.log('  🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
  console.log('============================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ Erro durante o teste:', err);
  process.exit(1);
});
