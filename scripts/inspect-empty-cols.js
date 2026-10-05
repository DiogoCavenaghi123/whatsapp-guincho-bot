const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');

async function inspect() {
  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await sheets.getSpreadsheetMetadata(spreadsheetId);
  console.log('Abas disponíveis:', meta.sheetTitles);

  for (const tab of ['OUTUBRO 2026', 'SETEMBRO 2026']) {
    if (!meta.sheetTitles.includes(tab)) continue;
    const rows = await sheets.getSheetRows(spreadsheetId, tab, false);
    console.log(`\n============================================================`);
    console.log(`  ABA: ${tab} (Total Linhas: ${rows.length})`);
    console.log(`============================================================`);
    console.log('Cabeçalho (Linha 2):', rows[1]);

    const emptyReport = [];

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const hasContent = r.some(c => c && String(c).trim());
      if (!hasContent) continue;

      const rowNum = i + 1;
      const data = r[0] || '';
      const depto = r[1] || '';
      const carro = r[2] || '';
      const chassi = r[3] || '';
      const coleta = r[4] || '';
      const entrega = r[5] || '';
      const modalidade = r[6] || '';
      const nf = r[7] || '';
      const custoViagem = r[8] || '';
      const qtd = r[9] || '';
      const custoUnit = r[10] || '';
      const faturado = r[11] || '';

      const missing = [];
      if (!data) missing.push('DATA (A)');
      if (!depto) missing.push('DEPTO (B)');
      if (!carro) missing.push('VEICULO (C)');
      if (!chassi) missing.push('CHASSI (D)');
      if (!coleta) missing.push('ORIGEM (E)');
      if (!entrega) missing.push('DESTINO (F)');
      if (!modalidade) missing.push('MODALIDADE (G)');
      if (!nf) missing.push('NOTA FISCAL (H)');
      if (!custoViagem) missing.push('CUSTO VIAGEM (I)');
      if (!qtd) missing.push('QTD (J)');
      if (!custoUnit) missing.push('CUSTO UNIT (K)');
      if (!faturado) missing.push('FATURADO (L)');

      if (missing.length > 0) {
        emptyReport.push({
          rowNum,
          carro,
          chassi,
          data,
          missing: missing.join(', '),
          raw: r,
        });
      }
    }

    console.log(`Linhas com campos vazios: ${emptyReport.length}`);
    for (const item of emptyReport) {
      console.log(`Linha ${item.rowNum} [${item.data}] ${item.carro || 'SEM NOME'} (${item.chassi || 'SEM CHASSI'}): FALTANDO -> ${item.missing}`);
    }
  }
}

inspect().catch(console.error);
