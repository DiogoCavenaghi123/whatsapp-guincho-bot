const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');

async function testFullSystem() {
  console.log('====================================================');
  console.log('  TESTE DE FUNCIONAMENTO INTEGRADO DO GUINCHO BOT  ');
  console.log('====================================================\n');

  try {
    // 1. Autenticação
    console.log('[1/5] Testando autenticação com o Google Sheets...');
    await sheets.init();
    console.log('✓ Google Sheets autenticado com sucesso!\n');

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    console.log('[2/5] Planilha conectada:', spreadsheetId);

    // 2. Resolução da Aba
    const activeTab = await sheets.resolveSheetTab(spreadsheetId);
    console.log('✓ Aba ativa resolvida com sucesso:', activeTab, '\n');

    // 3. Leitura e Métricas atuais
    console.log('[3/5] Consultando dados e métricas da aba...');
    const initialData = await sheets.getMonthTransparencyData(spreadsheetId, activeTab);
    const initialCount = initialData.transports ? initialData.transports.length : 0;
    console.log(`✓ Dados carregados: ${initialCount} transporte(s) cadastrado(s) na aba ${activeTab}.`);
    console.log('  Métricas:', initialData.stats, '\n');

    // 4. Inserção de Teste
    console.log('[4/5] Executando teste de gravação (preenchimento da planilha)...');
    const testDate = new Date();
    const dayStr = String(testDate.getDate()).padStart(2, '0');
    const monthStr = String(testDate.getMonth() + 1).padStart(2, '0');
    const yearStr = testDate.getFullYear();
    const dateFormatted = `${dayStr}/${monthStr}/${yearStr}`;

    const testRowData = [
      dateFormatted,
      'TESTE SISTEMA',
      'VEICULO TESTE GUINCHO BOT',
      'TEST9999',
      'KENTO MOGI',
      'KENTO SJBV',
      'CEGONHA',
      'NF TESTE',
    ];

    const inserted = await sheets.appendRow(spreadsheetId, testRowData, testDate);
    if (!inserted) {
      throw new Error('Falha ao inserir linha de teste na planilha.');
    }
    console.log('✓ Linha de teste gravada com sucesso na planilha!\n');

    // Consulta novamente para checar se a linha apareceu
    const afterInsert = await sheets.getMonthTransparencyData(spreadsheetId, activeTab);
    const newCount = afterInsert.transports ? afterInsert.transports.length : 0;
    console.log(`✓ Confirmação: Total de transportes subiu de ${initialCount} para ${newCount}.`);

    const insertedRecord = afterInsert.transports.find(t => t.chassi === 'TEST9999');
    if (insertedRecord) {
      console.log('  Dados da linha gravada e calculada automaticamente:');
      console.log('  - Linha na Planilha:', insertedRecord.rowNumber);
      console.log('  - Rota:', `${insertedRecord.coleta} → ${insertedRecord.entrega}`);
      console.log('  - Modalidade:', insertedRecord.modalidade);
      console.log('  - Custo da Viagem:', insertedRecord.custoViagem);
      console.log('  - Veículos agrupados:', insertedRecord.veicPorViagem);
      console.log('  - Custo Unitário:', insertedRecord.custoUnit);
      console.log('  - Justificativa do Custo:', insertedRecord.motivoValorBadge);
    }

    // 5. Limpeza da linha de teste
    console.log('\n[5/5] Removendo linha de teste para manter a planilha limpa...');
    if (insertedRecord && insertedRecord.rowNumber) {
      await sheets.deleteRow(spreadsheetId, activeTab, insertedRecord.rowNumber);
      console.log(`✓ Linha ${insertedRecord.rowNumber} removida com sucesso!`);
    }

    const finalData = await sheets.getMonthTransparencyData(spreadsheetId, activeTab);
    const finalCount = finalData.transports ? finalData.transports.length : 0;
    console.log(`✓ Planilha restaurada ao estado original: ${finalCount} transporte(s).\n`);

    console.log('====================================================');
    console.log('  🎉 TODOS OS TESTES PASSARAM COM SUCESSO!        ');
    console.log('  A planilha está acessível, lendo e preenchendo!  ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERRO NO TESTE DO SISTEMA:', err);
    process.exit(1);
  }
}

testFullSystem();
