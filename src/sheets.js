// =============================================================
//  Sheets — Integração com Google Sheets API
// =============================================================

const { google } = require('googleapis');
const logger = require('./logger');
const { getHeaders } = require('./parser');

let sheetsClient = null;
let authClient = null;

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
 * Verifica se a planilha tem cabeçalhos. Se não tiver, cria.
 *
 * @param {string} spreadsheetId — ID da planilha
 * @param {string} sheetName     — nome da aba
 */
async function ensureHeaders(spreadsheetId, sheetName) {
  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:R1`,
    });

    const firstRow = res.data.values?.[0];

    // Se a primeira linha está vazia ou menor que o total de colunas, atualiza os cabeçalhos
    if (!firstRow || firstRow.length < getHeaders().length) {
      logger.info('Atualizando cabeçalhos da planilha...');
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:R1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [getHeaders()],
        },
      });
      logger.success('Cabeçalhos atualizados na planilha');
    } else {
      logger.info('Planilha já tem cabeçalhos ✓');
    }
  } catch (err) {
    // Se a aba não existe, o erro terá "Unable to parse range"
    if (err.message?.includes('Unable to parse range')) {
      logger.error(
        `Aba "${sheetName}" não encontrada na planilha. Crie a aba manualmente ou verifique o nome no .env`
      );
    }
    throw err;
  }
}

/**
 * Verifica se já existe um registro com o mesmo chassi/placa e data de agendamento.
 *
 * @param {string} spreadsheetId — ID da planilha
 * @param {string} sheetName     — nome da aba
 * @param {string} chassiPlaca   — chassi ou placa do veículo
 * @param {string} agendarPara   — data do agendamento
 * @returns {boolean}
 */
async function isDuplicate(spreadsheetId, sheetName, chassiPlaca, agendarPara) {
  if (!chassiPlaca) return false;

  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!D:M`, // Coluna D = Chassi/Placa, Coluna M = Agendar Para
    });

    const rows = res.data.values || [];

    // Coluna D é índice 0 nesse range, Coluna M é índice 9
    return rows.some((row) => {
      const existingChassi = (row[0] || '').trim().toUpperCase();
      const existingData = (row[9] || '').trim();
      return (
        existingChassi === chassiPlaca.trim().toUpperCase() &&
        existingData === agendarPara?.trim()
      );
    });
  } catch (err) {
    logger.warn('Erro ao verificar duplicata (ignorando):', err.message);
    return false;
  }
}

/**
 * Adiciona uma nova linha na planilha.
 *
 * @param {string}   spreadsheetId — ID da planilha
 * @param {string}   sheetName     — nome da aba
 * @param {string[]} rowData       — array com os valores das colunas A-O
 * @returns {boolean}              — true se inseriu, false se era duplicata
 */
async function appendRow(spreadsheetId, sheetName, rowData) {
  // Verifica duplicata (chassiPlaca = index 3, agendarPara = index 12)
  const chassiPlaca = rowData[3];
  const agendarPara = rowData[12];

  const duplicate = await isDuplicate(spreadsheetId, sheetName, chassiPlaca, agendarPara);
  if (duplicate) {
    logger.warn(
      `Agendamento duplicado ignorado: ${chassiPlaca} para ${agendarPara}`
    );
    return false;
  }

  try {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:R`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    logger.success('Linha adicionada na planilha ✓');
    return true;
  } catch (err) {
    logger.error('Erro ao inserir na planilha:', err.message);
    throw err;
  }
}

module.exports = { init, ensureHeaders, appendRow };

