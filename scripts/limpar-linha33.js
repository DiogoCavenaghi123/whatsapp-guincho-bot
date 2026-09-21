require('dotenv').config();
const sheets = require('../src/sheets');
const logger = require('../src/logger');

async function inspectRows() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
  const tabName = 'SETEMBRO 2026';

  await sheets.init(credentialsPath);
  const rows = await sheets.getSheetRows(spreadsheetId, tabName, true);

  for (let i = 28; i <= 36; i++) {
    if (rows[i]) {
      console.log(`Linha ${i + 3}:`, JSON.stringify(rows[i]));
    }
  }
}

inspectRows().catch(console.error);

