// =============================================================
//  Sheets — Integração com Google Sheets API
// =============================================================

const { google } = require('googleapis');
const logger = require('./logger');
const dealerships = require('./dealerships');
const distance = require('./distance');

let sheetsClient = null;
let authClient = null;

// Caches em memória para evitar estourar a cota de leitura da Google Sheets API (60 req/min)
let sheetMetadataCache = null; // { sheetTitles: string[], sheetIdByTitle: Map<string, number> }
const sheetRowsCache = new Map(); // tabName -> { rows: Array<Array<string>>, timestamp: number }

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

/**
 * Executa uma operação da API do Google com retry exponencial caso atinja cota (429/Quota exceeded).
 */
async function retryWithBackoff(fn, retries = 4, delayMs = 2500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isQuota =
        err.message &&
        (err.message.includes('Quota exceeded') ||
          err.message.includes('rate limit') ||
          err.message.includes('429'));
      if (isQuota && i < retries - 1) {
        logger.warn(
          `Cota do Google Sheets atingida. Aguardando ${delayMs / 1000}s para tentar novamente...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

/**
 * Inicializa a autenticação com a Service Account do Google.
 *
 * @param {string} credentialsPath — caminho para o credentials.json
 */
async function init(credentialsPath) {
  try {
    authClient = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    logger.success('Google Sheets API autenticada com sucesso');
  } catch (err) {
    logger.error('Falha ao autenticar Google Sheets:', err.message);
    throw err;
  }
}

/**
 * Carrega e armazena em cache os metadados das abas da planilha.
 */
async function getSpreadsheetMetadata(spreadsheetId, forceRefresh = false) {
  if (sheetMetadataCache && !forceRefresh) {
    return sheetMetadataCache;
  }

  return await retryWithBackoff(async () => {
    const metadata = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetTitles = (metadata.data.sheets || []).map((s) => s.properties.title);
    const sheetIdByTitle = new Map();
    for (const s of metadata.data.sheets || []) {
      sheetIdByTitle.set(s.properties.title, s.properties.sheetId);
    }

    sheetMetadataCache = { sheetTitles, sheetIdByTitle };
    return sheetMetadataCache;
  });
}

/**
 * Calcula qual é o mês alvo de faturamento baseado na regra de ciclo:
 * Do dia 24 do mês anterior até o dia 23 do mês atual pertence ao mês atual.
 * A partir do dia 24, passa a pertencer à aba do mês seguinte!
 *
 * Exemplo:
 * - 24/08 a 23/09 -> "SETEMBRO 2026"
 * - 24/09 a 23/10 -> "OUTUBRO 2026"
 *
 * @param {Date} [date=new Date()]
 * @returns {{ monthIndex: number, monthName: string, year: number, expectedTabName: string }}
 */
function getTargetMonthInfo(date = new Date()) {
  const day = date.getDate();
  let month = date.getMonth(); // 0 a 11
  let year = date.getFullYear();

  if (day >= 24) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const monthName = MONTH_NAMES[month];
  return {
    monthIndex: month,
    monthName,
    year,
    expectedTabName: `${monthName} ${year}`,
  };
}

/**
 * Busca e resolve o nome real da aba na planilha do Google Sheets.
 * Faz busca exata ou busca normalizada (sem acento, case-insensitive).
 *
 * @param {string} spreadsheetId
 * @param {Date} [date=new Date()]
 * @returns {Promise<string>} Nome da aba encontrado na planilha
 */
async function resolveSheetTab(spreadsheetId, date = new Date()) {
  const { expectedTabName, monthName, year } = getTargetMonthInfo(date);

  try {
    const meta = await getSpreadsheetMetadata(spreadsheetId);
    const sheetTitles = meta.sheetTitles;

    // 1. Correspondência exata (ex: "SETEMBRO 2026")
    if (sheetTitles.includes(expectedTabName)) {
      return expectedTabName;
    }

    // 2. Normaliza para comparar sem acento e sem distinção de maiúsculas/minúsculas
    const normalize = (str) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    const normalizedExpected = normalize(expectedTabName);
    const normalizedMonth = normalize(monthName);

    const match = sheetTitles.find((title) => {
      const normTitle = normalize(title);
      return (
        normTitle === normalizedExpected ||
        normTitle === `${normalizedMonth} ${year}` ||
        normTitle.startsWith(`${normalizedMonth} ${year}`) ||
        normTitle === normalizedMonth
      );
    });

    if (match) {
      return match;
    }

    logger.warn(
      `Aba "${expectedTabName}" não encontrada na planilha. Abas disponíveis: ${sheetTitles.join(', ')}`
    );

    // 3. Tenta criar automaticamente a aba para o novo ciclo
    try {
      logger.info(`Criando automaticamente a aba "${expectedTabName}" para o novo ciclo na planilha...`);
      await retryWithBackoff(async () => {
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: expectedTabName,
                  },
                },
              },
            ],
          },
        });
      });

      const standardHeaders = [
        'DATA',
        'DEPARTAMENTO',
        'CARRO',
        'PLACAS/ CHASSIS',
        'LOCAL DE COLETA ',
        'LOCAL DE ENTREGA ',
        'VEICULO  TRANSPORTE',
        'NOTA FISCAL ',
        'CUSTO DA VIAGEM ',
        'VEICULOS POR VIAGEM ',
        'CUSTO UNITARIO POR VIAGEM ',
        'Faturado/Não Faturado',
      ];

      await retryWithBackoff(async () => {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `'${expectedTabName}'!A2:L2`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [standardHeaders],
          },
        });
      });

      await getSpreadsheetMetadata(spreadsheetId, true);
      logger.info(`Aba "${expectedTabName}" criada com sucesso no Google Sheets!`);
      return expectedTabName;
    } catch (createErr) {
      logger.warn(`Não foi possível criar automaticamente a aba "${expectedTabName}": ${createErr.message}`);
    }

    // 4. Fallback seguro: utiliza a última aba de mês existente para não interromper a operação
    const monthTabs = sheetTitles.filter((t) =>
      /^(JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+\d{4}$/i.test(t.trim())
    );
    if (monthTabs.length > 0) {
      const fallbackTab = monthTabs[monthTabs.length - 1];
      logger.warn(`Utilizando a aba mais recente existente: "${fallbackTab}"`);
      return fallbackTab;
    }

    return expectedTabName;
  } catch (err) {
    logger.warn(`Erro ao consultar abas da planilha: ${err.message}. Usando "${expectedTabName}"`);
    return expectedTabName;
  }
}

/**
 * Obtém as linhas da aba com cache em memória (TTL: 60s).
 */
async function getSheetRows(spreadsheetId, sheetName, forceRefresh = false) {
  const now = Date.now();
  const cached = sheetRowsCache.get(sheetName);

  if (!forceRefresh && cached && now - cached.timestamp < 60000) {
    return cached.rows;
  }

  const rows = await retryWithBackoff(async () => {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:L200`,
    });
    return res.data.values || [];
  });

  sheetRowsCache.set(sheetName, { rows, timestamp: now });
  return rows;
}

/**
 * Verifica se a aba do mês atual/alvo existe na planilha.
 *
 * @param {string} spreadsheetId — ID da planilha
 * @param {Date}   [date=new Date()]
 */
async function ensureHeaders(spreadsheetId, date = new Date()) {
  await getSpreadsheetMetadata(spreadsheetId, true);
  const sheetName = await resolveSheetTab(spreadsheetId, date);
  // Pré-carrega as linhas da aba no cache inicial
  await getSheetRows(spreadsheetId, sheetName, true);
  logger.info(`Aba ativa do ciclo identificada: "${sheetName}" ✓`);
}

/**
 * Normaliza strings de data (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) para comparação segura
 */
function normalizeDateStr(d) {
  if (!d) return '';
  const parts = d.trim().split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parts[2];
    if (p0 > 12) return `${p0}/${p1}/${p2}`;
    if (p1 > 12) return `${p1}/${p0}/${p2}`;
    return `${p0}/${p1}/${p2}`;
  }
  return d.trim();
}

/**
 * Verifica se já existe um registro com o mesmo chassi/placa e data na aba usando o cache.
 *
 * @param {string} spreadsheetId   — ID da planilha
 * @param {string} sheetName       — nome da aba
 * @param {string} chassiPlaca     — chassi ou placa do veículo
 * @param {string} dataFormatada   — data da mensagem (ex: 17/09/2026)
 * @returns {Promise<boolean>}
 */
async function isDuplicate(spreadsheetId, sheetName, chassiPlaca, dataFormatada) {
  if (!chassiPlaca) return false;

  try {
    const rows = await getSheetRows(spreadsheetId, sheetName);
    const cleanChassi = chassiPlaca.trim().toUpperCase();
    const targetDateNorm = normalizeDateStr(dataFormatada);

    return rows.some((row) => {
      const existingChassi = (row[3] || '').trim().toUpperCase();
      if (!existingChassi || existingChassi !== cleanChassi) return false;

      const existingData = (row[0] || '').trim();
      if (!existingData || !targetDateNorm) return true;

      return normalizeDateStr(existingData) === targetDateNorm;
    });
  } catch (err) {
    logger.warn('Erro ao verificar duplicata (ignorando):', err.message);
    return false;
  }
}

// Cache de custos de transporte da primeira aba (CUSTO TRANSPORTE)
const DEFAULT_PLATAFORMA_COSTS = new Map([
  ['SJBV', 900.00],
  ['CAMPINAS', 760.61],
  ['VALINHOS', 846.05],
  ['VINHEDO', 959.96],
  ['ITAPIRA', 265.95],
  ['ANDRADAS', 1100.00],
]);

const DEFAULT_CEGONHA_COSTS = new Map([
  ['SJBV', 1013.00],
  ['CAMPINAS', 1009.95],
  ['VALINHOS', 1109.95],
  ['VINHEDO', 1154.49],
  ['ITAPIRA', 311.34],
  ['ANDRADAS', 1100.00],
  ['PARNAIBA', 2050.00],
]);
let transportCostCache = null;

/**
 * Normaliza nomes de locais e concessionárias para cidades-base de operação.
 */
function extractCity(str) {
  if (!str || typeof str !== 'string') return '';

  // 1. Prioriza o cadastro oficial de concessionárias do Grupo Hazul
  const dealershipCity = dealerships.getDealershipCity(str);
  if (dealershipCity) {
    return dealershipCity;
  }

  const s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  if (s.includes('SJBV') || s.includes('SAO JOAO') || s.includes('BOA VISTA') || s.includes('KENTO SJ') || s.includes('XIAN SJ')) {
    return 'SJBV';
  }
  if (s.includes('MOGI GUACU') || s.includes('MOGI GUAÇU')) {
    return 'MOGI GUAÇU';
  }
  if (s.includes('MOGI') || s.includes('MM') || s.includes('REPARACAO') || s.includes('DUETO') || s.includes('DIVEM') || s.includes('PEUGEOT') || s.includes('CITROEN') || s.includes('PERFEITO')) {
    return 'MOGI MIRIM';
  }
  if (s.includes('CAMPINAS') || s.includes('CODIVE') || s.includes('HZ CAMPINAS')) {
    return 'CAMPINAS';
  }
  if (s.includes('VALINHOS')) return 'VALINHOS';
  if (s.includes('VINHEDO')) return 'VINHEDO';
  if (s.includes('ITAPIRA')) return 'ITAPIRA';
  if (s.includes('ANDRADAS') || s.includes('RICARTI') || s.includes('NOVA VIA')) return 'ANDRADAS';
  if (s.includes('POCOS') || s.includes('CALDAS') || s.includes('HYMAX')) return 'POÇOS DE CALDAS';
  if (s.includes('INDAIATUBA')) return 'INDAIATUBA';
  if (s.includes('JUNDIAI')) return 'JUNDIAÍ';

  return s.trim();
}

/**
 * Carrega a tabela de custos da primeira aba (CUSTO TRANSPORTE).
 */
async function loadTransportCostTable(spreadsheetId, forceRefresh = false) {
  if (transportCostCache && !forceRefresh) return transportCostCache;

  try {
    const res = await retryWithBackoff(async () => {
      return await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `'CUSTO TRANSPORTE'!A2:N20`,
      });
    });

    const values = res.data.values || [];
    const plataformaCosts = new Map();
    const cegonhaCosts = new Map();

    let currentSection = 'PLATAFORMA';
    for (const row of values) {
      if (!row || row.length === 0) continue;
      const colB = (row[1] || '').trim().toUpperCase();
      if (colB === 'PLATAFORMA') {
        currentSection = 'PLATAFORMA';
        continue;
      }
      if (colB === 'CEGONHA') {
        currentSection = 'CEGONHA';
        continue;
      }

      const destCityRaw = (row[2] || '').trim();
      if (!destCityRaw) continue;
      const normCity = extractCity(destCityRaw);

      if (currentSection === 'PLATAFORMA') {
        const costStr = (row[11] || '').replace(/[^\d,\.]/g, '').replace(',', '.');
        const costVal = parseFloat(costStr) || 0;
        if (costVal > 0) {
          plataformaCosts.set(normCity, costVal);
        }
      } else if (currentSection === 'CEGONHA') {
        const costStr = (row[11] || '').replace(/[^\d,\.]/g, '').replace(',', '.');
        const costVal = parseFloat(costStr) || 0;
        if (costVal > 0) {
          cegonhaCosts.set(normCity, costVal);
        }
      }
    }

    // Valores padrão garantidos caso a primeira aba sofra alterações
    if (!plataformaCosts.has('SJBV')) plataformaCosts.set('SJBV', 900.00);
    if (!plataformaCosts.has('CAMPINAS')) plataformaCosts.set('CAMPINAS', 760.61);
    if (!plataformaCosts.has('VALINHOS')) plataformaCosts.set('VALINHOS', 846.05);
    if (!plataformaCosts.has('VINHEDO')) plataformaCosts.set('VINHEDO', 959.96);
    if (!plataformaCosts.has('ITAPIRA')) plataformaCosts.set('ITAPIRA', 265.95);
    if (!plataformaCosts.has('ANDRADAS')) plataformaCosts.set('ANDRADAS', 1100.00);

    // Valores padrão oficiais da Cegonha (Grupo Hazul)
    if (!cegonhaCosts.has('SJBV')) cegonhaCosts.set('SJBV', 1013.00);
    if (!cegonhaCosts.has('CAMPINAS')) cegonhaCosts.set('CAMPINAS', 1009.95);
    if (!cegonhaCosts.has('VALINHOS')) cegonhaCosts.set('VALINHOS', 1109.95);
    if (!cegonhaCosts.has('VINHEDO')) cegonhaCosts.set('VINHEDO', 1154.49);
    if (!cegonhaCosts.has('ITAPIRA')) cegonhaCosts.set('ITAPIRA', 311.34);
    if (!cegonhaCosts.has('ANDRADAS')) cegonhaCosts.set('ANDRADAS', 1100.00);

    transportCostCache = { plataformaCosts, cegonhaCosts };
    return transportCostCache;
  } catch (err) {
    logger.warn(`Aviso ao ler tabela de custos de transporte: ${err.message}. Usando tabela padrão.`);
    transportCostCache = {
      plataformaCosts: new Map([
        ['SJBV', 900.00],
        ['CAMPINAS', 760.61],
        ['VALINHOS', 846.05],
        ['VINHEDO', 959.96],
        ['ITAPIRA', 265.95],
        ['ANDRADAS', 1100.00],
      ]),
      cegonhaCosts: new Map([
        ['SJBV', 1013.00],
        ['CAMPINAS', 1009.95],
        ['VALINHOS', 1109.95],
        ['VINHEDO', 1154.49],
        ['ITAPIRA', 311.34],
        ['ANDRADAS', 1100.00],
        ['PARNAIBA', 2050.00],
      ]),
    };
    return transportCostCache;
  }
}

function formatBRL(val) {
  if (typeof val !== 'number' || isNaN(val)) return 'R$ 0,00';
  return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Resolve o custo total da viagem e o custo unitário por veículo conforme a tabela de preços.
 */
function resolveTripCost(origem, destino, modalidade = 'CEGONHA', qtd = 1, costTable = null) {
  const o = extractCity(origem);
  const d = extractCity(destino);

  let targetCity = (o === 'MOGI MIRIM') ? d : (d === 'MOGI MIRIM' ? o : d);
  if (!targetCity) targetCity = d || o || 'CAMPINAS';

  const costs = costTable || transportCostCache;
  const isCegonha = !modalidade || modalidade.toUpperCase().includes('CEGONHA');
  let totalTrip = isCegonha ? 1009.95 : 760.61; // Padrão Campinas

  if (isCegonha) {
    if (costs && costs.cegonhaCosts && costs.cegonhaCosts.has(targetCity)) {
      const c = costs.cegonhaCosts.get(targetCity);
      totalTrip = typeof c === 'number' ? c : (c[1] || 1009.95);
    } else if (DEFAULT_CEGONHA_COSTS.has(targetCity)) {
      totalTrip = DEFAULT_CEGONHA_COSTS.get(targetCity);
    } else if (targetCity === 'ANDRADAS') {
      totalTrip = 1100.00;
    } else if (targetCity === 'ITAPIRA' && (o === 'CAMPINAS' || d === 'CAMPINAS')) {
      totalTrip = 1009.95;
    }
  } else {
    if (costs && costs.plataformaCosts && costs.plataformaCosts.has(targetCity)) {
      totalTrip = costs.plataformaCosts.get(targetCity);
    } else if (DEFAULT_PLATAFORMA_COSTS.has(targetCity)) {
      totalTrip = DEFAULT_PLATAFORMA_COSTS.get(targetCity);
    } else if (targetCity === 'ANDRADAS') {
      totalTrip = 1100.00;
    } else if (targetCity === 'ITAPIRA' && (o === 'CAMPINAS' || d === 'CAMPINAS')) {
      totalTrip = 760.61;
    }
  }

  const effectiveQtd = Math.max(1, Number(qtd) || 1);
  const unitCost = totalTrip / effectiveQtd;

  return {
    totalTripCost: totalTrip,
    unitCost,
    formattedTotal: formatBRL(totalTrip),
    formattedUnit: formatBRL(unitCost),
  };
}

/**
 * Determina se dois transportes pertencem à mesma viagem/frete compartilhado:
 * - Se estão indo para a mesma cidade no mesmo dia
 * - Se um está indo e outro voltando para o mesmo ponto de partida (ida e volta casada)
 */
function areTransportsRelated(t1, t2) {
  const o1 = extractCity(t1.origem);
  const d1 = extractCity(t1.destino);
  const o2 = extractCity(t2.origem);
  const d2 = extractCity(t2.destino);

  if (!d1 || !d2) return false;

  // 1. Indo para a mesma cidade no mesmo dia
  if (d1 === d2) return true;
  // 1. Ida e volta casada (um indo e outro voltando para o mesmo local de partida)
  if ((o1 === d2 && d1 === o2) || (o1 === o2 && d1 === d2)) return true;

  // 2. Ida e volta casada (um indo e outro voltando para o mesmo local de partida)
  if (o1 === d2 && d1 === o2) return true;
  // 2. Indo para a mesma cidade no mesmo dia
  // Se o destino for a base de retorno (Mogi Mirim), a origem também precisa coincidir
  if (d1 === d2) {
    if (d1 === 'MOGI MIRIM') {
      return o1 === o2;
    }
    return true;
  }

  // 3. Compartilham o mesmo par de cidades
  if ((o1 === o2 && d1 === d2) || (o1 === d2 && d1 === o2)) return true;

  return false;
}

/**
 * Localiza na planilha todas as viagens que compartilham a mesma viagem/transporte no mesmo dia.
 */
function findRelatedTransports(rows, dateNorm, newOrigem, newDestino) {
  const related = [];
  // Linhas de dados começam na linha 3 (índice 2)
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const rDate = normalizeDateStr(r[0] || '');
    if (!rDate || rDate !== dateNorm) continue;

    const rCar = (r[2] || '').trim();
    const rChassi = (r[3] || '').trim();
    if (!rCar && !rChassi) continue; // Linha vazia

    const rOrigem = r[4] || '';
    const rDestino = r[5] || '';

    if (areTransportsRelated(
      { origem: newOrigem, destino: newDestino },
      { origem: rOrigem, destino: rDestino }
    )) {
      related.push({
        rowIndex: i,
        rowNumber: i + 1, // 1-indexed
        carro: rCar,
        chassi: rChassi,
        origem: rOrigem,
        destino: rDestino,
        currentQtd: parseInt(r[9]) || 1,
        currentCusto: r[8] || '',
      });
    }
  }
  return related;
}

/**
 * Encontra a primeira linha vazia na planilha (a partir da linha 3)
 * e atualiza com os dados do agendamento (A:L), calculando custo da viagem,
 * quantidade de veículos agrupados por transporte e fórmulas de faturamento.
 *
 * @param {string}   spreadsheetId — ID da planilha
 * @param {string[]} rowData       — array com os valores das colunas A-H
 * @param {Date}     [msgDate=new Date()] — data da mensagem para determinar a aba
 * @returns {Promise<boolean>}    — true se inseriu, false se era duplicata
 */
async function appendRow(spreadsheetId, rowData, msgDate = new Date()) {
  const sheetName = await resolveSheetTab(spreadsheetId, msgDate);

  // Coluna A (index 0) = DATA, Coluna D (index 3) = PLACAS/CHASSIS
  const dataFormatada = rowData[0];
  const chassiPlaca = rowData[3];

  const duplicate = await isDuplicate(spreadsheetId, sheetName, chassiPlaca, dataFormatada);
  if (duplicate) {
    logger.warn(
      `Agendamento duplicado ignorado: ${chassiPlaca} em ${dataFormatada} na aba "${sheetName}"`
    );
    return false;
  }

  try {
    const rows = await getSheetRows(spreadsheetId, sheetName);
    let targetRow = -1;

    // Linha 1 = Título, Linha 2 = Cabeçalho. Linhas de dados começam na linha 3 (índice 2).
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      const data = (r[0] || '').trim();
      const carro = (r[2] || '').trim();
      const chassi = (r[3] || '').trim();

      // Linha vazia se não tem data, carro nem chassi
      if (!data && !carro && !chassi) {
        targetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      targetRow = Math.max(rows.length + 1, 3);
    }

    // 1. Carrega tabela de custos da primeira aba
    const costTable = await loadTransportCostTable(spreadsheetId);

    // 2. Normaliza data do agendamento
    const targetDateNorm = normalizeDateStr(dataFormatada);

    // 3. Localiza transportes relacionados no mesmo dia
    const related = findRelatedTransports(rows, targetDateNorm, rowData[4], rowData[5]);
    const totalQtd = related.length + 1;

    // 4. Calcula custo da viagem
    const modalidade = rowData[6] || 'CEGONHA';
    rowData[6] = modalidade;
    const costInfo = resolveTripCost(rowData[4], rowData[5], modalidade, totalQtd, costTable);

    // 5. Preenche Colunas I a L da nova linha
    rowData[8] = (typeof rowData[8] === 'number') ? rowData[8] : costInfo.totalTripCost;
    rowData[9] = totalQtd;
    rowData[10] = `=I${targetRow}/J${targetRow}`;
    rowData[11] = rowData[11] || ' NÃO FATURADO';

    // 6. Atualiza os dados nas colunas A até L
    await retryWithBackoff(async () => {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A${targetRow}:L${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    });

    // 7. Atualiza o cache local imediatamente
    while (rows.length < targetRow) {
      rows.push([]);
    }
    const currentCachedRow = rows[targetRow - 1] || [];
    for (let col = 0; col < rowData.length; col++) {
      currentCachedRow[col] = rowData[col];
    }
    rows[targetRow - 1] = currentCachedRow;

    // 8. Se há viagens irmãs relacionadas no mesmo dia, atualiza Col G a L nelas
    if (related.length > 0) {
      const siblingUpdates = [];
      for (const sib of related) {
        const sibRow = sib.rowNumber;
        siblingUpdates.push({
          range: `'${sheetName}'!G${sibRow}:L${sibRow}`,
          values: [[
            'CEGONHA',
            sib.nf || '',
            costInfo.totalTripCost,
            totalQtd,
            `=I${sibRow}/J${sibRow}`,
            ' NÃO FATURADO',
          ]],
        });
        if (rows[sib.rowIndex]) {
          rows[sib.rowIndex][6] = 'CEGONHA';
          rows[sib.rowIndex][8] = costInfo.totalTripCost;
          rows[sib.rowIndex][9] = totalQtd;
          rows[sib.rowIndex][10] = `=I${sibRow}/J${sibRow}`;
          rows[sib.rowIndex][11] = ' NÃO FATURADO';
        }
      }

      try {
        await retryWithBackoff(async () => {
          await sheetsClient.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
              valueInputOption: 'USER_ENTERED',
              data: siblingUpdates,
            },
          });
        });
        logger.info(`Atualizadas ${related.length} viagem(ns) relacionada(s) no dia ${dataFormatada} para ${totalQtd} veículos.`);
      } catch (sibErr) {
        logger.warn(`Aviso ao atualizar viagens irmãs: ${sibErr.message}`);
      }
    }

    // 9. Garante formatação visual consistente na linha
    try {
      await ensureRowFormatting(spreadsheetId, sheetName, targetRow, rows[targetRow - 1]);
    } catch (fmtErr) {
      logger.debug(`Aviso ao formatar linha ${targetRow}: ${fmtErr.message}`);
    }

    logger.success(`Linha ${targetRow} preenchida na aba "${sheetName}" (${totalQtd} veículo(s) no transporte, custo ${costInfo.formattedTotal}) ✓`);
    return true;
  } catch (err) {
    logger.error(`Erro ao inserir na planilha (aba ${sheetName}):`, err.message);
    throw err;
  }
}

/**
 * Garante que a linha preenchida tenha a formatação visual padrão e fórmulas K e L:
 * - Coluna A: Fundo verde suave (#99cc00), data centralizada com formato dd/MM/yyyy
 * - Colunas B a H: Fundo branco, bordas e texto centralizado
 * - Coluna K: Fórmula de custo unitário =I{row}/J{row} (se vazia)
 * - Coluna L: " NÃO FATURADO" em azul e negrito (se vazia)
 */
async function ensureRowFormatting(spreadsheetId, sheetName, rowNumber, cachedRow = []) {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheetId = meta.sheetIdByTitle.get(sheetName);
  if (sheetId === undefined) return;

  const colK = (cachedRow[10] || '').trim();
  const colL = (cachedRow[11] || '').trim();

  const updates = [];
  if (!colK) {
    updates.push({
      range: `'${sheetName}'!K${rowNumber}`,
      values: [[`=I${rowNumber}/J${rowNumber}`]],
    });
  }
  if (!colL) {
    updates.push({
      range: `'${sheetName}'!L${rowNumber}`,
      values: [[' NÃO FATURADO']],
    });
  }

  if (updates.length > 0) {
    await retryWithBackoff(async () => {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    });
    if (cachedRow) {
      cachedRow[10] = `=I${rowNumber}/J${rowNumber}`;
      cachedRow[11] = ' NÃO FATURADO';
    }
  }

  const rowIndex = rowNumber - 1; // 0-indexed

  // Aplica estilos visuais via batchUpdate
  await retryWithBackoff(async () => {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Coluna A: Verde suave, data centralizada
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 0,
                endColumnIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.6, green: 0.8, blue: 0.0 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  numberFormat: { type: 'DATE', pattern: 'dd/MM/yyyy' },
                  borders: {
                    top: { style: 'SOLID', width: 1 },
                    bottom: { style: 'SOLID', width: 1 },
                    left: { style: 'SOLID', width: 1 },
                    right: { style: 'SOLID', width: 1 },
                  },
                  textFormat: { fontFamily: 'Calibri', fontSize: 11 },
                },
              },
              fields:
                'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,numberFormat,borders,textFormat)',
            },
          },
          // Colunas B a L: Branco, bordas, centralizado
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 1,
                endColumnIndex: 12,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 1, blue: 1 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', width: 1 },
                    bottom: { style: 'SOLID', width: 1 },
                    left: { style: 'SOLID', width: 1 },
                    right: { style: 'SOLID', width: 1 },
                  },
                  textFormat: { fontFamily: 'Calibri', fontSize: 11 },
                },
              },
              fields:
                'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,borders,textFormat)',
            },
          },
        ],
      },
    });
  });
}

/**
 * Remove uma linha física da aba na planilha e invalida o cache.
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} rowNumber - Número da linha na planilha (1-indexed, ex: 33)
 */
async function deleteRow(spreadsheetId, sheetName, rowNumber) {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const sheetId = meta.sheetIdByTitle.get(sheetName);
  if (sheetId === undefined) {
    throw new Error(`Aba "${sheetName}" não encontrada na planilha.`);
  }

  await retryWithBackoff(async () => {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });
  });

  // Invalida cache de linhas da aba
  sheetRowsCache.delete(sheetName);
  logger.success(`Linha ${rowNumber} removida com sucesso da aba "${sheetName}"!`);
}

/**
 * Recalcula e preenche os custos de viagem, quantidade de veículos agrupados
 * e fórmulas unitárias para todas as viagens de uma aba (mês).
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName (ex: 'SETEMBRO 2026')
 * @returns {Promise<{ updatedCount: number, details: Array }>}
 */
async function recalculateMonthTransportCosts(spreadsheetId, sheetName) {
  const costTable = await loadTransportCostTable(spreadsheetId, true);
  const rows = await getSheetRows(spreadsheetId, sheetName, true);

  if (!rows || rows.length < 3) {
    return { updatedCount: 0, details: [] };
  }

  const transports = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const data = (r[0] || '').trim();
    const depto = (r[1] || '').trim();
    const carro = (r[2] || '').trim();
    const chassi = (r[3] || '').trim();
    const coleta = (r[4] || '').trim();
    const entrega = (r[5] || '').trim();
    const veicTransp = (r[6] || '').trim() || 'CEGONHA';
    const nf = (r[7] || '').trim();
    const custoViagem = (r[8] || '').trim();
    const veicPorViagem = (r[9] || '').trim();
    const custoUnit = (r[10] || '').trim();
    const faturado = (r[11] || '').trim() || ' NÃO FATURADO';

    if (!data && !carro && !chassi) continue;

    transports.push({
      rowIndex: i,
      rowNumber: i + 1,
      data,
      depto,
      carro,
      chassi,
      coleta,
      entrega,
      veicTransp,
      nf,
      custoViagem,
      veicPorViagem,
      custoUnit,
      faturado,
    });
  }

  const byDate = new Map();
  for (const t of transports) {
    if (!byDate.has(t.data)) byDate.set(t.data, []);
    byDate.get(t.data).push(t);
  }

  const updateBatch = [];
  const details = [];

  for (const [date, list] of byDate.entries()) {
    const groups = [];
    for (const t of list) {
      let foundGroup = null;
      for (const g of groups) {
        if (g.some(other => areTransportsRelated(
          { origem: t.coleta, destino: t.entrega },
          { origem: other.coleta, destino: other.entrega }
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
      const costInfo = resolveTripCost(first.coleta, first.entrega, 'CEGONHA', qtd, costTable);

      for (const item of g) {
        const rowNum = item.rowNumber;
        const newCusto = costInfo.totalTripCost;
        const newQtd = qtd;
        const newFormula = `=I${rowNum}/J${rowNum}`;
        const newFaturado = item.faturado || ' NÃO FATURADO';

        updateBatch.push({
          range: `'${sheetName}'!G${rowNum}:L${rowNum}`,
          values: [['CEGONHA', item.nf || '', newCusto, newQtd, newFormula, newFaturado]],
        });

        details.push({
          rowNumber: rowNum,
          data: item.data,
          carro: item.carro,
          chassi: item.chassi,
          rota: `${item.coleta} -> ${item.entrega}`,
          qtd,
          custoViagem: costInfo.formattedTotal,
          custoUnit: costInfo.formattedUnit,
        });
      }
    }
  }

  if (updateBatch.length > 0) {
    await retryWithBackoff(async () => {
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateBatch,
        },
      });
    });

    sheetRowsCache.delete(sheetName);
    logger.success(`Recálculo concluído: ${updateBatch.length} linhas atualizadas na aba "${sheetName}".`);
  }

  return { updatedCount: updateBatch.length, details };
}

/**
 * Obtém todos os dados da aba para o Painel de Transparência, incluindo
 * detalhamento dos motivos de cada valor e memória de cálculo.
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName (ex: 'SETEMBRO 2026')
 */
async function getMonthTransparencyData(spreadsheetId, sheetName) {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const availableMonthTabs = (meta.sheetTitles || []).filter((t) =>
    /^(JANEIRO|FEVEREIRO|MARCO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+\d{4}$/i.test(t.trim())
  );

  const rows = await getSheetRows(spreadsheetId, sheetName, true);

  const transports = [];
  let totalCostSum = 0;
  let sharedVehiclesCount = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const data = (r[0] || '').trim();
    const depto = (r[1] || '').trim();
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

    const oCity = extractCity(coleta);
    const dCity = extractCity(entrega);
    let targetCity = (oCity === 'MOGI MIRIM') ? dCity : (dCity === 'MOGI MIRIM' ? oCity : dCity);
    if (!targetCity) targetCity = dCity || oCity || 'CAMPINAS';

    const cleanNum = (str) => {
      const s = String(str || '').replace(/[^\d,\.]/g, '');
      if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.')) || 0;
      if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
      return parseFloat(s) || 0;
    };
    const numCustoViagem = cleanNum(custoViagem);
    const numCustoUnit = cleanNum(custoUnit) || (numCustoViagem / Math.max(1, veicPorViagem));

    totalCostSum += numCustoUnit;
    if (veicPorViagem > 1) {
      sharedVehiclesCount++;
    }

    const highway = distance.getHighwayDistance(coleta, entrega);
    const distanciaKm = highway.distanceKm;
    const distanciaTexto = highway.distanceText;

    // 1. Motivo do Valor Inserido (Origem do Custo Total da Viagem / Cegonha)
    let motivoValor = '';
    let motivoValorCurto = '';
    let motivoValorBadge = '';

    if (numCustoViagem === 1013 || numCustoViagem === 1081.56 || targetCity === 'SJBV') {
      motivoValorBadge = 'Tabela Cegonha SJBV (R$ 1.013)';
      motivoValorCurto = `Tabela Cegonha Hazul para São João da Boa Vista (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para a rota Mogi ⟷ São João da Boa Vista (~${distanciaKm} km rodoviários). Custo base da viagem na cegonha: R$ 1.013,00.`;
    } else if (Math.abs(numCustoViagem - 1009.95) < 1 || targetCity === 'CAMPINAS') {
      motivoValorBadge = 'Tabela Cegonha Campinas (R$ 1.009,95)';
      motivoValorCurto = `Tabela Cegonha Hazul para Campinas (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Campinas (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 1.009,95.`;
    } else if (Math.abs(numCustoViagem - 1109.95) < 1 || targetCity === 'VALINHOS') {
      motivoValorBadge = 'Tabela Cegonha Valinhos (R$ 1.109,95)';
      motivoValorCurto = `Tabela Cegonha Hazul para Valinhos (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Valinhos (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 1.109,95.`;
    } else if (Math.abs(numCustoViagem - 1154.49) < 1 || targetCity === 'VINHEDO') {
      motivoValorBadge = 'Tabela Cegonha Vinhedo (R$ 1.154,49)';
      motivoValorCurto = `Tabela Cegonha Hazul para Vinhedo (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Vinhedo (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 1.154,49.`;
    } else if (Math.abs(numCustoViagem - 1100) < 1 || targetCity === 'ANDRADAS') {
      motivoValorBadge = 'Tabela Cegonha Andradas (R$ 1.100)';
      motivoValorCurto = `Tabela Cegonha Hazul para Andradas (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Andradas (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 1.100,00.`;
    } else if (Math.abs(numCustoViagem - 311.34) < 1 || targetCity === 'ITAPIRA') {
      motivoValorBadge = 'Tabela Cegonha Itapira (R$ 311,34)';
      motivoValorCurto = `Tabela Cegonha Hazul para Itapira (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Itapira (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 311,34.`;
    } else if (Math.abs(numCustoViagem - 2050) < 1 || targetCity === 'PARNAIBA') {
      motivoValorBadge = 'Tabela Cegonha Parnaíba (R$ 2.050)';
      motivoValorCurto = `Tabela Cegonha Hazul para Santana de Parnaíba (${distanciaKm} km)`;
      motivoValor = `Tabela oficial de Cegonha do Grupo Hazul para rota Mogi ⟷ Santana de Parnaíba (~${distanciaKm} km). Custo base da viagem na cegonha: R$ 2.050,00.`;
    } else if (numCustoViagem === 180 || oCity === dCity || (oCity.includes('MOGI') && dCity.includes('MOGI'))) {
      motivoValorBadge = 'Tabela Curta (R$ 180)';
      motivoValorCurto = `Tabela Local / Curta Distância (${distanciaKm} km)`;
      motivoValor = `Tabela de deslocamento urbano / intermunicipal curto (~${distanciaKm} km). Custo fixo tabelado: R$ 180,00 por transporte.`;
    } else if (numCustoViagem > 0) {
      motivoValorBadge = `Tabela Base (R$ ${numCustoViagem.toFixed(0)})`;
      motivoValorCurto = `Valor Base Tabelado (${distanciaKm} km)`;
      motivoValor = `Valor de custo do transporte na cegonha registrado para o trajeto (${distanciaKm} km): ${custoViagem || formatBRL(numCustoViagem)}.`;
    } else {
      motivoValorBadge = 'Pendente';
      motivoValorCurto = 'Valor não inserido';
      motivoValor = 'Custo da viagem ainda pendente de definição na planilha.';
    }

    // 2. Motivo do Cálculo (Regra de Rateio vs Frete Exclusivo)
    let motivoCalculo = '';
    let motivoCalculoCurto = '';
    let motivoCalculoBadge = '';
    let motivoTitulo = '';
    let motivoDetalhe = '';

    if (veicPorViagem > 1) {
      motivoTitulo = `Otimização: ${veicPorViagem} veículos agrupados no mesmo transporte`;
      motivoDetalhe = `Rota calculada com base em ${targetCity} (Custo total: ${custoViagem || formatBRL(numCustoViagem)}). Rateio entre ${veicPorViagem} veículos = ${custoUnit || formatBRL(numCustoUnit)} por veículo.`;
      motivoCalculoBadge = `Rateio (${veicPorViagem} veículos)`;
      motivoCalculoCurto = `Rateio proporcional (${custoViagem || formatBRL(numCustoViagem)} ÷ ${veicPorViagem})`;
      motivoCalculo = `Viagem compartilhada: Custo total da cegonha (${custoViagem || formatBRL(numCustoViagem)}) rateado igualmente entre os ${veicPorViagem} veículos transportados no mesmo dia (${data}) = ${custoUnit || formatBRL(numCustoUnit)} por carro.`;
    } else if (numCustoViagem > 0) {
      motivoTitulo = `Frete exclusivo na rota (${targetCity})`;
      motivoDetalhe = `${motivoValorCurto}. Custo integral (1 único veículo na rota).`;
      motivoCalculoBadge = 'Frete Exclusivo (1 carro)';
      motivoCalculoCurto = 'Custo integral (1 único veículo na rota)';
      motivoCalculo = `Frete exclusivo: Único transporte agendado nesta rota na data ${data}. O veículo assume 100% do custo da viagem na cegonha (${custoViagem || formatBRL(numCustoViagem)}).`;
    } else {
      motivoTitulo = `Frete exclusivo na rota (${targetCity})`;
      motivoDetalhe = `Transporte realizado no dia para ${targetCity}. Aguardando inserção de valor da viagem.`;
      motivoCalculoBadge = 'Aguardando Rateio';
      motivoCalculoCurto = 'Pendente de cálculo';
      motivoCalculo = 'Aguardando inserção de valor da viagem para cálculo de rateio unitário.';
    }

    transports.push({
      rowNumber: i + 1,
      data,
      depto,
      carro,
      chassi,
      coleta,
      entrega,
      origemCity: oCity,
      destinoCity: dCity,
      targetCity,
      distanciaKm,
      distanciaTexto,
      modalidade: veicTransp,
      notaFiscal: nf,
      custoViagem: custoViagem || formatBRL(numCustoViagem),
      veicPorViagem,
      custoUnit: custoUnit || formatBRL(numCustoUnit),
      numCustoUnit,
      faturado,
      motivoValor,
      motivoValorCurto,
      motivoValorBadge,
      motivoCalculo,
      motivoCalculoCurto,
      motivoCalculoBadge,
      motivoTitulo,
      motivoDetalhe,
    });
  }

  const totalTrips = transports.length;
  const avgVehicles = totalTrips > 0 ? (transports.reduce((a, b) => a + b.veicPorViagem, 0) / totalTrips).toFixed(1) : '1.0';

  return {
    sheetName,
    availableMonthTabs,
    stats: {
      totalTrips,
      totalCostFormatted: formatBRL(totalCostSum),
      sharedVehiclesCount,
      avgVehiclesPerTrip: avgVehicles,
    },
    transports,
  };
}

/**
 * Atualiza o local de saída (coleta) e chegada (entrega) de uma linha específica da planilha,
 * e executa o recálculo dos custos da aba para manter os agrupamentos consistentes.
 *
 * @param {string} spreadsheetId
 * @param {string} sheetName (ex: 'SETEMBRO 2026')
 * @param {number} rowNumber (1-indexed, ex: 14)
 * @param {string} novaOrigem
 * @param {string} novoDestino
 */
async function updateRowRoute(spreadsheetId, sheetName, rowNumber, novaOrigem, novoDestino) {
  const finalOrigem = dealerships.standardizeDealershipName(novaOrigem, (novaOrigem || '').trim().toUpperCase());
  const finalDestino = dealerships.standardizeDealershipName(novoDestino, (novoDestino || '').trim().toUpperCase());

  // 1. Atualiza as colunas E e F da linha na planilha
  await retryWithBackoff(async () => {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!E${rowNumber}:F${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[finalOrigem, finalDestino]],
      },
    });
  });

  // 2. Invalida cache da aba
  sheetRowsCache.delete(sheetName);

  // 3. Executa o recálculo para atualizar os custos de viagem, agrupamentos e fórmulas da aba
  const recalcResult = await recalculateMonthTransportCosts(spreadsheetId, sheetName);

  logger.success(`Rota da linha ${rowNumber} na aba "${sheetName}" atualizada para: "${finalOrigem}" -> "${finalDestino}" ✓`);

  return {
    success: true,
    rowNumber,
    finalOrigem,
    finalDestino,
    recalcResult,
  };
}

module.exports = {
  init,
  ensureHeaders,
  appendRow,
  deleteRow,
  getSheetRows,
  getSpreadsheetMetadata,
  getTargetMonthInfo,
  resolveSheetTab,
  loadTransportCostTable,
  resolveTripCost,
  extractCity,
  areTransportsRelated,
  findRelatedTransports,
  recalculateMonthTransportCosts,
  getMonthTransparencyData,
  updateRowRoute,
};
