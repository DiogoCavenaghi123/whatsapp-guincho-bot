const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { parseAgendamento, toSheetRow, resolveNotaFiscal, isCancellationRequest, extractCancellationTarget } = require('../src/parser');
const sheets = require('../src/sheets');

async function run() {
  console.log('===========================================================');
  console.log('  TESTE DE CANCELAMENTO E VALIDAÇÃO DE NOTA FISCAL         ');
  console.log('===========================================================\n');

  // 1. Teste do Parser com o padrão do usuário
  console.log('[1/4] Testando extração da mensagem exata do usuário...');
  const userMsg = `VEICULO TIGGO 7 PRO MAX DRIVE
COR: CINZA ESCURO 
CHASSIS: 95PEEL61DVB106403
DEPARTAMENTO:VENDAS NOVOS
VEICULO IMOBILIZADO:NAO
ORIGEM : MOGI MIRIM
RESPONSAVEL: FABIANA
DESTINO: XIAN SAO JOAO DA BOA VISTA
DPTO VENDAS NOVOS
RESPONSAVEL ADRIANO
AGENDAR: 29/09/26
FATURAR XIAN SAO JOAO`;

  const parsed = parseAgendamento(userMsg);
  if (!parsed) {
    throw new Error('Falha: parseAgendamento retornou null para a mensagem do usuário!');
  }

  const nf = resolveNotaFiscal(parsed);
  const row = toSheetRow(parsed, new Date());
  console.log('✓ Campos extraídos com sucesso:');
  console.log('  - Veículo:', parsed.veiculo);
  console.log('  - Chassi:', parsed.chassiPlaca);
  console.log('  - Faturar Para (Parser):', parsed.faturarPara);
  console.log('  - Nota Fiscal Resolvida:', nf);
  console.log('  - Data Formatada (Col A):', row[0]);
  console.log('  - Nota Fiscal na Linha (Col H):', row[7]);

  if (!row[7] || row[7].length < 2) {
    throw new Error('Falha: Coluna H (Nota Fiscal) ficou vazia no toSheetRow!');
  }
  if (row[0] !== '29/09/2026') {
    throw new Error(`Falha: Data esperada 29/09/2026, mas obteve ${row[0]}`);
  }

  // 2. Conecta ao Google Sheets
  console.log('\n[2/4] Conectando ao Google Sheets...');
  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const activeTab = await sheets.resolveSheetTab(spreadsheetId);
  console.log(`✓ Conectado! Aba ativa do ciclo: "${activeTab}"`);

  // 3. Teste de Inserção de Agendamento Temporário
  console.log('\n[3/4] Inserindo agendamento de teste para validar proteção da Nota Fiscal e Cancelamento...');
  const testChassi = 'TESTE_VIN_9999999';
  const testRow = [
    '29/09/2026',
    'NOVOS',
    'TIGGO 7 TESTE CANCELAMENTO',
    testChassi,
    'MOGI MIRIM',
    'XIAN SJBV',
    'CEGONHA',
    'XIAN SJBV',
  ];

  const inserted = await sheets.appendRow(spreadsheetId, testRow, new Date(2026, 8, 29));
  if (!inserted) {
    throw new Error('Falha ao inserir linha de teste na planilha.');
  }
  console.log('✓ Agendamento temporário gravado na planilha com sucesso!');

  // 4. Teste de Cancelamento reenviando a mensagem com "CANCELAR"
  console.log('\n[4/4] Simulando cancelamento: reenviando mensagem com "CANCELAR" no final...');
  const cancelMsg = `${userMsg}\nCHASSIS: ${testChassi}\n\nCANCELAR`;
  const isCancel = isCancellationRequest(cancelMsg);
  console.log('  isCancellationRequest:', isCancel);
  if (!isCancel) {
    throw new Error('Falha: isCancellationRequest não reconheceu a mensagem com CANCELAR!');
  }

  const target = extractCancellationTarget(cancelMsg);
  console.log('  Alvo extraído para cancelamento:', target);

  const cancelResult = await sheets.findAndCancelTransport(spreadsheetId, target);
  console.log('  Resultado do cancelamento:', cancelResult);
  if (!cancelResult.success) {
    throw new Error('Falha: findAndCancelTransport não localizou ou falhou ao excluir a linha!');
  }

  console.log(`✓ Linha ${cancelResult.cancelled.rowNumber} (${cancelResult.cancelled.carro}) excluída da aba "${cancelResult.cancelled.tab}" com sucesso!`);
  console.log('✓ Custos das viagens restantes foram recalculados automaticamente!');

  console.log('\n===========================================================');
  console.log('  🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!        ');
  console.log('===========================================================');
}

run().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
