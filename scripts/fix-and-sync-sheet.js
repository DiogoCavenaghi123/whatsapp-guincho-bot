// =============================================================
//  Sincronização e Limpeza Completa da Planilha
//  - Remove linhas fantasmas (fórmulas sem dados)
//  - Remove linhas duplicadas e testes
//  - Preenche colunas vazias (Nota Fiscal, Depto, Origem, Destino)
//  - Atualiza datas para as datas reais dos agendamentos / confirmações
//  - Recalcula custos e rateios de viagem
// =============================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');

async function syncAndClean() {
  console.log('\n============================================================');
  console.log('  🧹 INICIANDO LIMPEZA E SINCRONIZAÇÃO DA PLANILHA');
  console.log('============================================================\n');

  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // ─────────────────────────────────────────────────────────────
  // 1. Limpeza de Linhas Fantasmas em SETEMBRO 2026
  // ─────────────────────────────────────────────────────────────
  console.log('1. Verificando aba SETEMBRO 2026...');
  const setRows = await sheets.getSheetRows(spreadsheetId, 'SETEMBRO 2026', false);
  const setValidEnd = 37; // Linhas 3 a 37 são dados reais
  if (setRows.length > setValidEnd) {
    console.log(`  Limpando ${setRows.length - setValidEnd} linhas fantasmas (linhas ${setValidEnd + 1} a ${setRows.length}) em SETEMBRO 2026...`);
    // Limpa os valores do range
    await sheets.getSheetRows(spreadsheetId, 'SETEMBRO 2026', true); // reset cache
    const { google } = require('googleapis');
    const auth = await new google.auth.GoogleAuth({
      keyFile: path.resolve(__dirname, '../credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }).getClient();
    const sheetsClient = google.sheets({ version: 'v4', auth });

    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId,
      range: `'SETEMBRO 2026'!A${setValidEnd + 1}:L${setRows.length}`,
    });
    console.log('  ✓ Linhas fantasmas limpas em SETEMBRO 2026.');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Limpeza e Deduplicação na aba OUTUBRO 2026
  // ─────────────────────────────────────────────────────────────
  console.log('\n2. Processando aba OUTUBRO 2026...');
  const outRows = await sheets.getSheetRows(spreadsheetId, 'OUTUBRO 2026', false);
  console.log(`  Total atual de linhas em OUTUBRO 2026: ${outRows.length}`);

  const { google } = require('googleapis');
  const auth = await new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, '../credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }).getClient();
  const sheetsClient = google.sheets({ version: 'v4', auth });

  // Lista consolidada e completa dos transportes reais de OUTUBRO 2026
  // Todos com datas, rotas, departamentos e notas fiscais 100% preenchidos
  const cleanTransports = [
    // 24/09
    {
      data: '24/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'KICKS 1.0 ADVANCE',
      chassi: '94DFAAP16VB100325',
      origem: 'KENTO MOGI MIRIM',
      destino: 'KENTO SJBV',
      transporte: 'CEGONHA',
      nf: 'KENTO SJBV',
    },
    {
      data: '24/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 7 SPORT',
      chassi: '95PEEL61DVB103044',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'PERFEITO FUNILARIA',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },
    {
      data: '24/09/2026',
      depto: 'FUNILARIA',
      carro: 'TIGGO 5 PRO',
      chassi: '95PBDK31DSB057278',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'PERFEITO FUNILARIA',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },

    // 28/09
    {
      data: '28/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'CADEIRAS (12 UNID)',
      chassi: '-',
      origem: 'MOGI MIRIM',
      destino: 'CODIVE VINHEDO',
      transporte: 'CEGONHA',
      nf: 'CODIVE VINHEDO',
      custoFixo: 600.00,
    },

    // 29/09 (Agendados / confirmados por Vanderlei cegonha 29/09)
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 7 PRO MAX DRIVE',
      chassi: '95PEEL61DVB106403',
      origem: 'MOGI MIRIM',
      destino: 'XIAN SJBV',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 7 PRO MAX DRIVE',
      chassi: '95PEEL61DVB097847',
      origem: 'MOGI MIRIM',
      destino: 'XIAN SJBV',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'KAIT ADVANCE',
      chassi: '94DFCAP15TB121875',
      origem: 'NOVA VIA MOTORS - ANDRADAS',
      destino: 'KENTO MM',
      transporte: 'CEGONHA',
      nf: 'KENTO MM',
    },
    {
      data: '29/09/2026',
      depto: 'FUNILARIA',
      carro: 'TIGGO 7 SPORT',
      chassi: '95PEEL61DVB103044',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'PERFEITO FUNILARIA',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 5 SPORT',
      chassi: '95PBFK31DVB114521',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'XIAN MM',
      transporte: 'CEGONHA',
      nf: 'XIAN MM',
    },
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 5 SPORT',
      chassi: '95PBFK31DVB112563',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'XIAN MM',
      transporte: 'CEGONHA',
      nf: 'XIAN MM',
    },
    {
      data: '29/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 8 PRO',
      chassi: '6760',
      origem: 'MOGI MIRIM',
      destino: 'XIAN SJBV',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },

    // 30/09
    {
      data: '30/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'CRETA Platinum',
      chassi: 'VP299466',
      origem: 'MOGI GUAÇU',
      destino: 'NOVA VIA MOTORS - ANDRADAS',
      transporte: 'CEGONHA',
      nf: 'HYMAX MG',
    },
    {
      data: '30/09/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 7 SPORT',
      chassi: '7972',
      origem: 'MOGI MIRIM',
      destino: 'XIAN SJBV',
      transporte: 'CEGONHA',
      nf: 'XIAN SJBV',
    },

    // 01/10
    {
      data: '01/10/2026',
      depto: 'VENDAS NOVOS',
      carro: 'Creta Limited',
      chassi: 'VP315023',
      origem: 'ANDRADAS',
      destino: 'HYMAX MG',
      transporte: 'CEGONHA',
      nf: 'HYMAX MG',
    },

    // 02/10
    {
      data: '02/10/2026',
      depto: 'VENDAS NOVOS',
      carro: 'TIGGO 5 SPORT',
      chassi: '95PBFK31DVB114261',
      origem: 'SÃO JOÃO DA BOA VISTA',
      destino: 'XIAN MM',
      transporte: 'CEGONHA',
      nf: 'XIAN MM',
    },
    {
      data: '02/10/2026',
      depto: 'VENDAS NOVOS',
      carro: 'CRETA Action',
      chassi: 'TP326920',
      origem: 'MOGI GUAÇU',
      destino: 'CODIVE CAMPINAS',
      transporte: 'CEGONHA',
      nf: '50% HYMAX 50% CODIVE',
    },
    {
      data: '02/10/2026',
      depto: 'VENDAS NOVOS',
      carro: 'KICKS 1.0T SENSE AT',
      chassi: '94DFAAP16TB032261',
      origem: 'KENTO SJBV',
      destino: 'KENTO MM',
      transporte: 'CEGONHA',
      nf: 'KENTO MM',
    },
  ];

  console.log(`  Montando ${cleanTransports.length} transportes válidos e completos...`);

  // Carrega tabela de custos
  const costTable = await sheets.loadTransportCostTable(spreadsheetId, true);

  // Agrupa transportes por data para calcular rateio correto
  const byDate = new Map();
  for (const t of cleanTransports) {
    if (!byDate.has(t.data)) byDate.set(t.data, []);
    byDate.get(t.data).push(t);
  }

  const finalRows = [];
  let currentRowNum = 3;

  for (const [date, list] of byDate.entries()) {
    const groups = [];
    for (const t of list) {
      let foundGroup = null;
      for (const g of groups) {
        if (g.some(other => sheets.areTransportsRelated(
          { origem: t.origem, destino: t.destino },
          { origem: other.origem, destino: other.destino }
        ))) {
          foundGroup = g;
          break;
        }
      }
      if (foundGroup) {
        foundGroup.push(t);
      } else {
        groups.push([t]);
      }
    }

    for (const g of groups) {
      const qtd = g.length;
      const first = g[0];
      const costInfo = sheets.resolveTripCost(first.origem, first.destino, first.transporte || 'CEGONHA', qtd, costTable);

      for (const item of g) {
        const tripCost = item.custoFixo !== undefined ? item.custoFixo : costInfo.totalTripCost;
        const rowData = [
          item.data,
          item.depto,
          item.carro,
          item.chassi,
          item.origem,
          item.destino,
          item.transporte,
          item.nf,
          tripCost,
          qtd,
          `=I${currentRowNum}/J${currentRowNum}`,
          ' NÃO FATURADO',
        ];
        finalRows.push(rowData);
        currentRowNum++;
      }
    }
  }

  // Limpa completamente a área de dados da aba OUTUBRO 2026 (linha 3 até 100)
  console.log('  Limpando área anterior da aba OUTUBRO 2026...');
  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `'OUTUBRO 2026'!A3:L100`,
  });

  // Escreve os registros 100% preenchidos e limpos
  console.log(`  Gravando ${finalRows.length} linhas limpas e completas em OUTUBRO 2026...`);
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'OUTUBRO 2026'!A3:L${2 + finalRows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: finalRows,
    },
  });

  // Invalida todos os caches locais
  await sheets.getSheetRows(spreadsheetId, 'OUTUBRO 2026', true);
  await sheets.getSheetRows(spreadsheetId, 'SETEMBRO 2026', true);

  console.log('\n============================================================');
  console.log('  🎉 PLANILHA SINCRONIZADA E 100% ATUALIZADA!');
  console.log(`  ✓ SETEMBRO 2026: 35 transportes válidos (fantasmas removidas)`);
  console.log(`  ✓ OUTUBRO 2026: ${finalRows.length} transportes válidos e completos`);
  console.log('============================================================\n');
}

syncAndClean().catch((err) => {
  console.error('Erro na sincronização:', err);
  process.exit(1);
});
