// =============================================================
//  Sheets — Integração com Google Sheets API
// =============================================================

const { google } = require('googleapis');
const logger = require('./logger');

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

/**
 * Encontra a primeira linha vazia na planilha (a partir da linha 3)
 * e atualiza com os dados do agendamento (A:H), preservando a formatação
 * existente (fundo verde na data, fundo branco com bordas nos dados,
 * e fórmulas de faturamento nas colunas K e L).
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

      // Linha vazia se não tiene data, carro nem chassi
      if (!data && !carro && !chassi) {
        targetRow = i + 1; // 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      targetRow = Math.max(rows.length + 1, 3);
    }

    // 2. Atualiza os dados nas colunas A até H sem sobrescrever colunas I a L
    await retryWithBackoff(async () => {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A${targetRow}:H${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });
    });

    // 3. Atualiza o cache local imediatamente para que a próxima verificação já veja esta linha
    while (rows.length < targetRow) {
      rows.push([]);
    }
    const currentCachedRow = rows[targetRow - 1] || [];
    for (let col = 0; col < rowData.length; col++) {
      currentCachedRow[col] = rowData[col];
    }
    rows[targetRow - 1] = currentCachedRow;

    // 4. Garante formatação consistente na linha se necessário
    try {
      await ensureRowFormatting(spreadsheetId, sheetName, targetRow, rows[targetRow - 1]);
    } catch (fmtErr) {
      logger.debug(`Aviso ao formatar linha ${targetRow}: ${fmtErr.message}`);
    }

    logger.success(`Linha ${targetRow} preenchida na aba "${sheetName}" ✓`);
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
          // Colunas B a H: Branco, bordas, centralizado
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 1,
                endColumnIndex: 8,
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

module.exports = {
  init,
  ensureHeaders,
  appendRow,
  deleteRow,
  getSheetRows,
  getSpreadsheetMetadata,
  getTargetMonthInfo,
  resolveSheetTab,
};
