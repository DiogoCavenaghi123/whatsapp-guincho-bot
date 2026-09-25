// =============================================================
//  Reports — Módulo de Relatórios Mensais e Anuais de Transportes
//  Grupo Hazul — WhatsApp Guincho & Cegonha Bot
// =============================================================

const sheets = require('./sheets');
const distance = require('./distance');

const MONTH_NAMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

function formatBRL(val) {
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cleanNum(val) {
  if (typeof val === 'number') return val;
  const s = String(val || '').replace(/[^\d,\.]/g, '');
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.')) || 0;
  if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  return parseFloat(s) || 0;
}

/**
 * Obtém os dados consolidados para o relatório (mensal ou anual).
 *
 * @param {string} spreadsheetId
 * @param {Object} options
 * @param {'month'|'year'} options.type
 * @param {string} options.period - Ex: 'SETEMBRO 2026' ou '2026'
 */
async function getReportData(spreadsheetId, options = {}) {
  const type = options.type || 'month';
  const meta = await sheets.getSpreadsheetMetadata(spreadsheetId);
  const allTitles = meta.sheetTitles || [];

  // Filtra apenas abas de meses válidos (ex: "SETEMBRO 2026", "JANEIRO 2025")
  const validMonthTabs = allTitles.filter((t) =>
    /^(JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+\d{4}$/i.test(t.trim())
  );

  let targetTabs = [];
  let reportTitle = '';
  let periodSubtitle = '';

  if (type === 'year') {
    const targetYear = String(options.period || new Date().getFullYear()).trim();
    targetTabs = validMonthTabs.filter((t) => t.endsWith(targetYear));
    
    // Ordena as abas cronologicamente pelo mês
    targetTabs.sort((a, b) => {
      const mA = MONTH_NAMES.findIndex((m) => a.toUpperCase().startsWith(m));
      const mB = MONTH_NAMES.findIndex((m) => b.toUpperCase().startsWith(m));
      return mA - mB;
    });

    reportTitle = `Relatório Anual Consolidado — Ano ${targetYear}`;
    periodSubtitle = `Consolidado de ${targetTabs.length} ciclos mensais de faturamento (${targetYear})`;
  } else {
    // Relatório Mensal
    let targetMonthTab = options.period;
    if (!targetMonthTab || !validMonthTabs.includes(targetMonthTab)) {
      targetMonthTab = 'SETEMBRO 2026';
      if (!validMonthTabs.includes(targetMonthTab) && validMonthTabs.length > 0) {
        targetMonthTab = validMonthTabs[validMonthTabs.length - 1];
      }
    }
    targetTabs = [targetMonthTab];
    reportTitle = `Relatório Mensal de Transportes — ${targetMonthTab}`;
    periodSubtitle = `Ciclo de faturamento: ${targetMonthTab}`;
  }

  const allItems = [];
  const monthlyBreakdownMap = new Map();
  const deptoMap = new Map();
  const routeMap = new Map();

  let totalCostSum = 0;
  let singleTripCount = 0;
  let sharedTripCount = 0;

  for (const tabName of targetTabs) {
    const rows = await sheets.getSheetRows(spreadsheetId, tabName);
    if (!rows || rows.length < 3) continue;

    let tabCostSum = 0;
    let tabCarsCount = 0;

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const data = (r[0] || '').trim();
      const depto = (r[1] || '').trim() || 'GERAL';
      const carro = (r[2] || '').trim();
      const chassi = (r[3] || '').trim();
      const coleta = (r[4] || '').trim();
      const entrega = (r[5] || '').trim();
      const veicTransp = (r[6] || '').trim() || 'CEGONHA';
      const nf = (r[7] || '').trim();
      const custoViagem = (r[8] || '').trim();
      const veicPorViagem = parseInt(r[9]) || 1;
      const custoUnit = (r[10] || '').trim();
      const faturado = (r[11] || '').trim() || 'NÃO FATURADO';

      if (!data && !carro && !chassi) continue;

      const numCustoViagem = cleanNum(custoViagem);
      const numCustoUnit = cleanNum(custoUnit) || (numCustoViagem / Math.max(1, veicPorViagem));

      const highway = distance.getHighwayDistance(coleta, entrega);
      const distanciaKm = highway.distanceKm;

      const item = {
        tabName,
        rowNumber: i + 1,
        data,
        depto,
        carro: carro || 'Veículo não informado',
        chassi: chassi || '--',
        coleta: coleta || '--',
        entrega: entrega || '--',
        distanciaKm,
        distanciaTexto: highway.distanceText,
        modalidade: veicTransp,
        nf,
        custoViagem: formatBRL(numCustoViagem),
        numCustoViagem,
        veicPorViagem,
        custoUnit: formatBRL(numCustoUnit),
        numCustoUnit,
        faturado,
        isGrouped: veicPorViagem > 1,
      };

      allItems.push(item);
      totalCostSum += numCustoUnit;
      tabCostSum += numCustoUnit;
      tabCarsCount++;

      if (veicPorViagem > 1) {
        sharedTripCount++;
      } else {
        singleTripCount++;
      }

      // Agrupamento por Departamento
      const deptoKey = (depto || 'GERAL').toUpperCase();
      if (!deptoMap.has(deptoKey)) {
        deptoMap.set(deptoKey, { depto: deptoKey, name: deptoKey, count: 0, costSum: 0 });
      }
      const dEntry = deptoMap.get(deptoKey);
      dEntry.count++;
      dEntry.costSum += numCustoUnit;

      // Agrupamento por Rota
      const oCity = sheets.extractCity(coleta) || (coleta || 'MOGI MIRIM').toUpperCase();
      const dCity = sheets.extractCity(entrega) || (entrega || 'DESTINO').toUpperCase();
      let routeLabel;
      if (oCity === dCity) {
        routeLabel = `INTERNO ${oCity}`;
      } else if (oCity === 'MOGI MIRIM' || dCity === 'MOGI MIRIM') {
        const other = oCity === 'MOGI MIRIM' ? dCity : oCity;
        routeLabel = `MOGI MIRIM ⇄ ${other}`;
      } else {
        routeLabel = `${oCity} ⇄ ${dCity}`;
      }

      if (!routeMap.has(routeLabel)) {
        routeMap.set(routeLabel, {
          rota: routeLabel,
          origem: oCity,
          destino: dCity,
          count: 0,
          costSum: 0,
        });
      }
      const rEntry = routeMap.get(routeLabel);
      rEntry.count++;
      rEntry.costSum += numCustoUnit;
    }

    monthlyBreakdownMap.set(tabName, {
      tabName,
      name: tabName,
      carsCount: tabCarsCount,
      totalVeiculos: tabCarsCount,
      costSum: tabCostSum,
      costFormatted: formatBRL(tabCostSum),
      avgPerCar: tabCarsCount > 0 ? formatBRL(tabCostSum / tabCarsCount) : 'R$ 0,00',
    });
  }

  const totalVeiculos = allItems.length;
  const avgCostPerVehicle = totalVeiculos > 0 ? totalCostSum / totalVeiculos : 0;
  const taxaCompartilhamento = totalVeiculos > 0 ? Math.round((sharedTripCount / totalVeiculos) * 100) : 0;

  // Calcula economia estimada por agrupamento (se cada um pagasse frete exclusivo integral)
  const custoTeoricoExclusivo = allItems.reduce((acc, it) => acc + (it.numCustoViagem || it.numCustoUnit), 0);
  const economiaEstimada = Math.max(0, custoTeoricoExclusivo - totalCostSum);

  const departamentos = Array.from(deptoMap.values())
    .sort((a, b) => b.costSum - a.costSum)
    .map(d => ({
      ...d,
      depto: d.depto,
      name: d.depto,
      costFormatted: formatBRL(d.costSum),
      percentual: totalCostSum > 0 ? Math.round((d.costSum / totalCostSum) * 100) : 0,
    }));

  const rotas = Array.from(routeMap.values())
    .sort((a, b) => b.count - a.count)
    .map(r => ({
      ...r,
      rota: r.rota,
      origem: r.origem,
      destino: r.destino,
      costFormatted: formatBRL(r.costSum),
      percentual: totalVeiculos > 0 ? Math.round((r.count / totalVeiculos) * 100) : 0,
    }));

  const meses = Array.from(monthlyBreakdownMap.values());

  // Extrai lista de anos únicos disponíveis
  const availableYears = Array.from(
    new Set(
      validMonthTabs.map(t => {
        const m = t.match(/\d{4}/);
        return m ? m[0] : null;
      }).filter(Boolean)
    )
  ).sort().reverse();

  return {
    type,
    reportTitle,
    periodSubtitle,
    period: options.period,
    generatedAt: new Date().toLocaleString('pt-BR'),
    availableMonthTabs: validMonthTabs,
    availableYears,
    kpis: {
      totalVeiculos,
      totalCost: totalCostSum,
      totalCostFormatted: formatBRL(totalCostSum),
      avgCostPerVehicle: formatBRL(avgCostPerVehicle),
      sharedTripCount,
      singleTripCount,
      taxaCompartilhamento: `${taxaCompartilhamento}%`,
      economiaEstimada: formatBRL(economiaEstimada),
    },
    departamentos,
    rotas,
    meses,
    items: allItems,
  };
}

/**
 * Gera arquivo CSV com formatação brasileira (separador ponto e vírgula e UTF-8 BOM).
 */
function generateCSV(report) {
  const BOM = '\uFEFF';
  const lines = [];

  // Cabeçalho institucional
  lines.push(`"GRUPO HAZUL — RELATÓRIO DE TRANSPORTES DE VEÍCULOS"`);
  lines.push(`"${report.reportTitle}"`);
  lines.push(`"Emitido em: ${report.generatedAt}";"Total de Veículos: ${report.kpis.totalVeiculos}";"Custo Total: ${report.kpis.totalCostFormatted}";"Economia de Rateio: ${report.kpis.economiaEstimada}"`);
  lines.push('');

  // Tabela de resumo por Departamento
  lines.push('"RESUMO POR DEPARTAMENTO"');
  lines.push('"Departamento";"Qtd Veículos";"Custo Total (R$)";"Participação (%)"');
  for (const d of report.departamentos) {
    lines.push(`"${d.depto}";${d.count};"${d.costSum.toFixed(2).replace('.', ',')}";"${d.percentual}%"`);
  }
  lines.push('');

  // Tabela de resumo por Rota
  lines.push('"RESUMO POR DESTINO / ROTA"');
  lines.push('"Rota";"Qtd Veículos";"Custo Total (R$)";"Participação (%)"');
  for (const r of report.rotas) {
    lines.push(`"${r.rota}";${r.count};"${r.costSum.toFixed(2).replace('.', ',')}";"${r.percentual}%"`);
  }
  lines.push('');

  if (report.type === 'year') {
    lines.push('"EVOLUÇÃO MENSAL"');
    lines.push('"Mês / Aba";"Qtd Veículos";"Custo Total (R$)";"Média / Carro (R$)"');
    for (const m of report.meses) {
      lines.push(`"${m.tabName}";${m.carsCount};"${m.costSum.toFixed(2).replace('.', ',')}";"${m.avgPerCar}"`);
    }
    lines.push('');
  }

  // Tabela Detalhada das Viagens
  lines.push('"DETALHAMENTO DE TRANSPORTES"');
  lines.push('"Ciclo / Aba";"Linha";"Data";"Veículo";"Chassi / Placa";"Departamento";"Origem (Coleta)";"Destino (Entrega)";"Distância (KM)";"Modalidade";"Nota Fiscal";"Custo Viagem (R$)";"Veíc. Agrupados";"Custo Unitário (R$)";"Status Faturamento"');

  for (const it of report.items) {
    const row = [
      `"${it.tabName}"`,
      it.rowNumber,
      `"${it.data}"`,
      `"${it.carro.replace(/"/g, '""')}"`,
      `"${it.chassi.replace(/"/g, '""')}"`,
      `"${it.depto.replace(/"/g, '""')}"`,
      `"${it.coleta.replace(/"/g, '""')}"`,
      `"${it.entrega.replace(/"/g, '""')}"`,
      it.distanciaKm,
      `"${it.modalidade}"`,
      `"${it.nf}"`,
      `"${it.numCustoViagem.toFixed(2).replace('.', ',')}"`,
      it.veicPorViagem,
      `"${it.numCustoUnit.toFixed(2).replace('.', ',')}"`,
      `"${it.faturado}"`,
    ];
    lines.push(row.join(';'));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Gera documento HTML corporativo otimizado para Impressão e exportação direta em PDF.
 */
function generatePrintHTML(report) {
  const deptoRows = report.departamentos.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.depto)}</strong></td>
      <td style="text-align: center;">${d.count}</td>
      <td style="text-align: right; font-family: monospace;">${d.costFormatted}</td>
      <td style="text-align: right;">${d.percentual}%</td>
    </tr>
  `).join('');

  const rotaRows = report.rotas.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.rota)}</strong></td>
      <td style="text-align: center;">${r.count}</td>
      <td style="text-align: right; font-family: monospace;">${r.costFormatted}</td>
      <td style="text-align: right;">${r.percentual}%</td>
    </tr>
  `).join('');

  const monthlySection = report.type === 'year' ? `
    <div class="report-section">
      <h3 class="section-title">Evolução Mensal dos Custos (${report.period})</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ciclo de Faturamento</th>
            <th style="text-align: center;">Veículos</th>
            <th style="text-align: right;">Investimento Total</th>
            <th style="text-align: right;">Custo Médio / Carro</th>
          </tr>
        </thead>
        <tbody>
          ${report.meses.map(m => `
            <tr>
              <td><strong>${escapeHtml(m.tabName)}</strong></td>
              <td style="text-align: center;">${m.carsCount}</td>
              <td style="text-align: right; font-family: monospace;"><strong>${m.costFormatted}</strong></td>
              <td style="text-align: right; font-family: monospace;">${m.avgPerCar}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const detailRows = report.items.map(it => `
    <tr>
      <td style="text-align: center; color: #64748b;">#${it.rowNumber}</td>
      <td>${escapeHtml(it.data)}</td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(it.carro)}</div>
        <div style="font-size: 0.72rem; color: #64748b; font-family: monospace;">${escapeHtml(it.chassi)}</div>
      </td>
      <td>${escapeHtml(it.depto)}</td>
      <td>${escapeHtml(it.coleta)}</td>
      <td>${escapeHtml(it.entrega)}</td>
      <td style="text-align: center;">${it.distanciaKm} km</td>
      <td><span class="badge ${it.isGrouped ? 'badge-success' : 'badge-neutral'}">${it.modalidade} (${it.veicPorViagem}x)</span></td>
      <td style="text-align: right; font-family: monospace; font-weight: 700;">${it.custoUnit}</td>
      <td style="text-align: center; font-size: 0.75rem;">${escapeHtml(it.faturado)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.reportTitle)} — Grupo Hazul</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      font-size: 0.8125rem;
      line-height: 1.4;
      padding: 24px;
    }
    .print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-outline {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-outline:hover {
      background: rgba(255,255,255,0.2);
    }
    .report-sheet {
      background: #fff;
      padding: 32px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      max-width: 1400px;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      background: #2563eb;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    .report-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }
    .report-meta {
      font-size: 0.78rem;
      color: #64748b;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      border-left: 4px solid #2563eb;
    }
    .kpi-card.green { border-left-color: #10b981; }
    .kpi-card.purple { border-left-color: #8b5cf6; }
    .kpi-card.amber { border-left-color: #f59e0b; }
    .kpi-title {
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
    .kpi-sub {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 2px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      margin-bottom: 12px;
    }
    .data-table th {
      background: #f1f5f9;
      color: #475569;
      text-align: left;
      padding: 8px 10px;
      font-weight: 600;
      border-bottom: 1px solid #cbd5e1;
    }
    .data-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    .data-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .badge-success {
      background: #dcfce7;
      color: #15803d;
    }
    .badge-neutral {
      background: #f1f5f9;
      color: #475569;
    }
    .footer-note {
      margin-top: 24px;
      text-align: center;
      font-size: 0.72rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
      .report-sheet {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>

  <!-- Barra de Ferramentas Web (Oculta na Impressão) -->
  <div class="print-bar">
    <div>
      <strong>Visualização de Impressão & Exportação PDF</strong> • Grupo Hazul
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Imprimir / Salvar como PDF
      </button>
      <button class="btn btn-outline" onclick="window.close()">
        Fechar
      </button>
    </div>
  </div>

  <div class="report-sheet">
    <table class="header-table">
      <tr>
        <td>
          <div class="brand-title">
            <span>GRUPO HAZUL</span>
            <span class="brand-badge">LOGÍSTICA</span>
          </div>
          <div class="report-name">${escapeHtml(report.reportTitle)}</div>
          <div class="report-meta">${escapeHtml(report.periodSubtitle)}</div>
        </td>
        <td style="text-align: right; vertical-align: bottom;">
          <div class="report-meta">Data de Emissão: <strong>${escapeHtml(report.generatedAt)}</strong></div>
          <div class="report-meta">Sistema Automatizado WhatsApp Guincho Bot</div>
        </td>
      </tr>
    </table>

    <!-- Quadro de KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total de Veículos</div>
        <div class="kpi-val">${report.kpis.totalVeiculos}</div>
        <div class="kpi-sub">Carros transportados no período</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-title">Investimento em Fretes</div>
        <div class="kpi-val">${report.kpis.totalCostFormatted}</div>
        <div class="kpi-sub">Custo total consolidado</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-title">Custo Médio / Carro</div>
        <div class="kpi-val">${report.kpis.avgCostPerVehicle}</div>
        <div class="kpi-sub">Média unitária por transporte</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-title">Economia por Rateio</div>
        <div class="kpi-val">${report.kpis.economiaEstimada}</div>
        <div class="kpi-sub">${report.kpis.taxaCompartilhamento} de fretes compartilhados</div>
      </div>
    </div>

    <!-- Distribuições: Departamento e Rota -->
    <div class="summary-grid">
      <div>
        <h3 class="section-title">Distribuição por Departamento</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Departamento</th>
              <th style="text-align: center;">Veículos</th>
              <th style="text-align: right;">Custo Total</th>
              <th style="text-align: right;">%</th>
            </tr>
          </thead>
          <tbody>
            ${deptoRows}
          </tbody>
        </table>
      </div>

      <div>
        <h3 class="section-title">Principais Rotas & Destinos</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Destino / Rota</th>
              <th style="text-align: center;">Veículos</th>
              <th style="text-align: right;">Custo Total</th>
              <th style="text-align: right;">%</th>
            </tr>
          </thead>
          <tbody>
            ${rotaRows}
          </tbody>
        </table>
      </div>
    </div>

    ${monthlySection}

    <!-- Detalhamento de Viagens -->
    <div class="report-section page-break" style="margin-top: 24px;">
      <h3 class="section-title">Relação Completa dos Transportes Realizados (${report.items.length} registros)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th style="width: 80px;">Data</th>
            <th>Veículo / Chassi</th>
            <th>Departamento</th>
            <th>Coleta (Origem)</th>
            <th>Entrega (Destino)</th>
            <th style="text-align: center;">Dist.</th>
            <th>Modalidade</th>
            <th style="text-align: right;">Custo Unit.</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
        </tbody>
      </table>
    </div>

    <div class="footer-note">
      Documento gerado automaticamente pelo Painel Operacional WhatsApp Guincho Bot — Grupo Hazul. Todos os direitos reservados.
    </div>
  </div>

</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  getReportData,
  generateCSV,
  generatePrintHTML,
};
