const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');

async function search() {
  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await sheets.getSpreadsheetMetadata(spreadsheetId);
  console.log('Tabs:', meta.sheetTitles);

  for (const tab of ['SETEMBRO 2026', 'OUTUBRO 2026']) {
    const rows = await sheets.getSheetRows(spreadsheetId, tab, false);
    console.log(`Checking ${tab}, total rows: ${rows.length}`);
    rows.forEach((r, idx) => {
      const lineStr = (r || []).join(' | ');
      if (lineStr.includes('95PEEL61DVB106403') || lineStr.toLowerCase().includes('tiggo 7') || lineStr.includes('29/09')) {
        console.log(`[${tab}] Linha ${idx + 1}:`, r);
      }
    });
  }
}

search().catch(console.error);
