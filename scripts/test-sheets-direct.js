const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');

async function run() {
  try {
    console.log('[1/3] Inicializando conexão com Google Sheets...');
    await sheets.init();
    console.log('✓ Google Sheets autenticado com sucesso!');

    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
    console.log('[2/3] Planilha ID:', spreadsheetId);

    const sheetTab = await sheets.resolveSheetTab(spreadsheetId);
    console.log('[3/3] Consultando dados da aba atual:', sheetTab);

    const data = await sheets.getMonthTransparencyData(spreadsheetId, sheetTab);
    console.log('✓ Dados de Transparência carregados com sucesso:');
    console.log('  - Aba:', data.sheetName);
    console.log('  - Total de registros:', data.records ? data.records.length : 0);
    console.log('  - Resumo de métricas:', data.summary);
    if (data.records && data.records.length > 0) {
      console.log('  - Exemplo do último registro:', data.records[data.records.length - 1]);
    }

    console.log('\n=============================================');
    console.log('  TESTE DE CONEXÃO COM A PLANILHA APROVADO!');
    console.log('=============================================');
  } catch (err) {
    console.error('❌ Falha no teste de conexão:', err);
    process.exit(1);
  }
}

run();
