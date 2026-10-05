const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');
const dealerships = require('../src/dealerships');
const { resolveNotaFiscal, parseAgendamento } = require('../src/parser');
const fs = require('fs');

async function analyze() {
  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const historyFile = path.resolve(__dirname, '../logs/messages_history.json');
  const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : [];

  console.log(`Carregados ${history.length} registros de histórico de mensagens.\n`);

  for (const tab of ['OUTUBRO 2026', 'SETEMBRO 2026']) {
    console.log(`============================================================`);
    console.log(`  ANALISANDO ABA: ${tab}`);
    console.log(`============================================================`);

    const rows = await sheets.getSheetRows(spreadsheetId, tab, false);
    console.log(`Total de linhas brutas na planilha: ${rows.length}`);

    const validRows = [];
    const phantomRows = [];

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const rowNum = i + 1;
      const data = (r[0] || '').trim();
      const depto = (r[1] || '').trim();
      const carro = (r[2] || '').trim();
      const chassi = (r[3] || '').trim();
      const coleta = (r[4] || '').trim();
      const entrega = (r[5] || '').trim();
      const modalidade = (r[6] || '').trim();
      const nf = (r[7] || '').trim();
      const custoViagem = (r[8] || '').trim();
      const qtd = (r[9] || '').trim();
      const custoUnit = (r[10] || '').trim();
      const faturado = (r[11] || '').trim();

      // Linha fantasma: se não tem data nem carro nem chassi
      if (!data && !carro && !chassi) {
        if (custoUnit.includes('#DIV') || faturado) {
          phantomRows.push(rowNum);
        }
        continue;
      }

      validRows.push({
        rowNum,
        data,
        depto,
        carro,
        chassi,
        coleta,
        entrega,
        modalidade,
        nf,
        custoViagem,
        qtd,
        custoUnit,
        faturado,
        raw: r,
      });
    }

    console.log(`Linhas válidas com dados de transporte: ${validRows.length}`);
    console.log(`Linhas fantasmas (fórmulas sem dados): ${phantomRows.length} (linhas ${phantomRows[0]} até ${phantomRows[phantomRows.length - 1]})`);

    // Analisa cada linha válida para conferir se conseguimos preencher colunas vazias via histórico
    for (const row of validRows) {
      const emptyCols = [];
      if (!row.depto) emptyCols.push('DEPTO');
      if (!row.coleta) emptyCols.push('ORIGEM');
      if (!row.entrega) emptyCols.push('DESTINO');
      if (!row.modalidade) emptyCols.push('MODALIDADE');
      if (!row.nf) emptyCols.push('NOTA_FISCAL');

      let matchInHistory = null;
      if (row.chassi && row.chassi.length >= 4) {
        matchInHistory = history.find(h => {
          const body = (h.body || '').toUpperCase();
          const extChassi = (h.extractedData?.chassiPlaca || h.extractedData?.chassi || '').toUpperCase();
          return extChassi.includes(row.chassi) || body.includes(row.chassi);
        });
      }

      if (!matchInHistory && row.carro && row.carro.length >= 3) {
        matchInHistory = history.find(h => {
          const body = (h.body || '').toUpperCase();
          const extCarro = (h.extractedData?.veiculo || h.extractedData?.carro || '').toUpperCase();
          return extCarro.includes(row.carro) || body.includes(row.carro);
        });
      }

      let recoveredNF = null;
      let recoveredOrigem = null;
      let recoveredDestino = null;
      let recoveredDepto = null;

      if (matchInHistory) {
        const ext = matchInHistory.extractedData || {};
        const parsed = parseAgendamento(matchInHistory.body) || {};

        recoveredNF = resolveNotaFiscal(parsed) || resolveNotaFiscal(ext) || ext.faturarPara || ext.notaFiscal || '';
        if (recoveredNF) recoveredNF = dealerships.standardizeDealershipName(recoveredNF, recoveredNF);

        recoveredOrigem = parsed.origem || ext.origem || '';
        if (recoveredOrigem) recoveredOrigem = dealerships.standardizeDealershipName(recoveredOrigem, recoveredOrigem);

        recoveredDestino = parsed.destino || ext.destino || '';
        if (recoveredDestino) recoveredDestino = dealerships.standardizeDealershipName(recoveredDestino, recoveredDestino);

        recoveredDepto = parsed.departamento || ext.departamento || parsed.deptoEntrega || '';
      }

      console.log(`\nLinha ${row.rowNum}: [${row.data}] ${row.carro} | Chassi: ${row.chassi || '-'} | NF atual: "${row.nf}"`);
      if (emptyCols.length > 0) {
        console.log(`  -> Colunas vazias: ${emptyCols.join(', ')}`);
        if (matchInHistory) {
          console.log(`  -> Match no Histórico! Dados recuperáveis:`);
          if (!row.nf && recoveredNF) console.log(`     * NOTA FISCAL: "${recoveredNF}"`);
          if (!row.coleta && recoveredOrigem) console.log(`     * ORIGEM: "${recoveredOrigem}"`);
          if (!row.entrega && recoveredDestino) console.log(`     * DESTINO: "${recoveredDestino}"`);
          if (!row.depto && recoveredDepto) console.log(`     * DEPTO: "${recoveredDepto}"`);
        } else {
          console.log(`  -> Sem match direto no histórico de mensagens.`);
        }
      }
    }
  }
}

analyze().catch(console.error);
