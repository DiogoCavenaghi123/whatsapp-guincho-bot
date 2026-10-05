const { parseAgendamento, toSheetRow, resolveNotaFiscal, isCancellationRequest, extractCancellationTarget } = require('../src/parser');

const msg = `VEICULO TIGGO 7 PRO MAX DRIVE
COR: CINZA ESCURO 
CHASSIS: 95PEEL61DVB106403
DEPARTAMENTO:VENDAS NOVOS
VEICULO IMOBILIZADO:NAO
ORIGEM : MOGI MIRIM
RESPONSAVEL: FABIANA
DESTINO: XIAN SAO JOAO DA BOA VISTA
DPTO VENDAS NOVOS
RESPONSAVEL ADRIANO
AGENDAR: 29/09/26
FATURAR XIAN SAO JOAO`;

console.log('--- TESTANDO PARSER NORMAL ---');
const parsed = parseAgendamento(msg);
console.log('Parsed:', parsed);
console.log('resolveNotaFiscal:', resolveNotaFiscal(parsed));
const row = toSheetRow(parsed, new Date());
console.log('toSheetRow:', row);

console.log('\n--- TESTANDO MENSAGEM COM "CANCELAR" ---');
const cancelMsg = msg + '\n\nCANCELAR';
console.log('isCancellationRequest:', isCancellationRequest(cancelMsg));
console.log('extractCancellationTarget:', extractCancellationTarget(cancelMsg));

console.log('\n--- TESTANDO MENSAGEM CURTA "Cancelar chassi 95PEEL61DVB106403" ---');
const shortCancel = 'Favor cancelar o agendamento do chassi 95PEEL61DVB106403';
console.log('isCancellationRequest short:', isCancellationRequest(shortCancel));
console.log('extractCancellationTarget short:', extractCancellationTarget(shortCancel));
