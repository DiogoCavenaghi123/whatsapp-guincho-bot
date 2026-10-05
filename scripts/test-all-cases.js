// =============================================================
//  SUITE DE TESTES EXAUSTIVA — WHATSAPP GUINCHO BOT
//  Testa 100% das possibilidades, roteamentos, cálculos,
//  rateios, parser, tratamento de erros e integridade da planilha.
// =============================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sheets = require('../src/sheets');
const dealerships = require('../src/dealerships');
const {
  parseAgendamento,
  toSheetRow,
  resolveNotaFiscal,
  isCancellationRequest,
  extractCancellationTarget,
  extractRescheduleDate,
  isOperationalNoise,
} = require('../src/parser');
const { isVanderleiSender } = require('../src/whatsapp');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('  🧪 SUITE DE TESTES EXAUSTIVA: REGRAS, PARSER E PLANILHA');
  console.log('============================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. TESTE DE ROTAS E AGRUPAMENTOS (areTransportsRelated)
  // ─────────────────────────────────────────────────────────────
  console.log('─── 1. TESTES DE AGRUPAMENTO DE ROTAS (areTransportsRelated) ───');

  // Caso 1: Mesma cidade de destino (Mogi -> SJBV e Mogi -> SJBV) -> DEVE AGRUPAR
  const r1 = sheets.areTransportsRelated(
    { origem: 'MOGI MIRIM', destino: 'XIAN SJBV' },
    { origem: 'MOGI MIRIM', destino: 'XIAN SAO JOAO DA BOA VISTA' }
  );
  assert(r1 === true, 'Mogi -> Xian SJBV e Mogi -> Xian São João devem agrupar (mesma rota SJBV)');

  // Caso 2: Ida e volta casada (Mogi -> SJBV e SJBV -> Mogi) -> DEVE AGRUPAR
  const r2 = sheets.areTransportsRelated(
    { origem: 'MOGI MIRIM', destino: 'XIAN SJBV' },
    { origem: 'SÃO JOÃO DA BOA VISTA', destino: 'XIAN MM' }
  );
  assert(r2 === true, 'Mogi -> SJBV e SJBV -> Mogi devem agrupar (ida e volta casada)');

  // Caso 3: Cidades diferentes no mesmo dia (Andradas vs SJBV) -> NÃO PODE AGRUPAR!
  const r3 = sheets.areTransportsRelated(
    { origem: 'NOVA VIA MOTORS - ANDRADAS', destino: 'KENTO MM' },
    { origem: 'MOGI MIRIM', destino: 'XIAN SJBV' }
  );
  assert(r3 === false, 'Andradas -> Mogi e Mogi -> SJBV NÃO podem agrupar (rotas distintas)');

  // Caso 4: Retorno a Mogi de cidades distintas (Andradas -> Mogi vs SJBV -> Mogi) -> NÃO PODE AGRUPAR!
  const r4 = sheets.areTransportsRelated(
    { origem: 'NOVA VIA MOTORS - ANDRADAS', destino: 'KENTO MM' },
    { origem: 'SÃO JOÃO DA BOA VISTA', destino: 'XIAN MM' }
  );
  assert(r4 === false, 'Andradas -> Mogi e SJBV -> Mogi NÃO podem agrupar mesmo com mesmo destino');

  // Caso 5: Campinas vs Vinhedo no mesmo dia -> NÃO PODE AGRUPAR
  const r5 = sheets.areTransportsRelated(
    { origem: 'MOGI MIRIM', destino: 'CODIVE CAMPINAS' },
    { origem: 'MOGI MIRIM', destino: 'CODIVE VINHEDO' }
  );
  assert(r5 === false, 'Campinas vs Vinhedo são destinos distintos com tabelas diferentes');

  // Caso 6: Dois carros para Campinas (Hymax Mogi Guaçu -> Codive Campinas vs Mogi Mirim -> Codive Campinas) -> DEVE AGRUPAR
  const r6 = sheets.areTransportsRelated(
    { origem: 'Mogi Guaçu', destino: 'CODIVE CPS' },
    { origem: 'MOGI MIRIM', destino: 'CODIVE CAMPINAS' }
  );
  assert(r6 === true, 'Carros para Campinas no mesmo dia devem agrupar');

  // Caso 7: Andradas ida e volta (Mogi Guaçu -> Andradas e Andradas -> Hymax Mogi) -> DEVE AGRUPAR
  const r7 = sheets.areTransportsRelated(
    { origem: 'Mogi Guaçu', destino: 'Nova Via - Andradas' },
    { origem: 'Andradas', destino: 'Hymax' }
  );
  assert(r7 === true, 'Andradas ida e volta deve agrupar na mesma viagem');

  // Caso 8: Destino vazio ou nulo -> NÃO PODE AGRUPAR
  const r8 = sheets.areTransportsRelated(
    { origem: 'MOGI MIRIM', destino: '' },
    { origem: 'MOGI MIRIM', destino: 'XIAN SJBV' }
  );
  assert(r8 === false, 'Destino vazio não deve agrupar com nenhum outro transporte');

  // ─────────────────────────────────────────────────────────────
  // 2. TESTE DE TABELAS DE PREÇO E RATEIO (resolveTripCost)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── 2. TESTES DE PREÇOS E CÁLCULO DE RATEIO (resolveTripCost) ───');

  await sheets.init();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const costTable = await sheets.loadTransportCostTable(spreadsheetId, true);

  // 2.1 SJBV Cegonha: 1 carro, 2 carros, 6 carros
  const costSJBV_1 = sheets.resolveTripCost('MOGI MIRIM', 'XIAN SJBV', 'CEGONHA', 1, costTable);
  assert(costSJBV_1.totalTripCost === 1081.56, `SJBV Custo Total base: ${costSJBV_1.totalTripCost} (esperado 1081.56)`);
  assert(costSJBV_1.unitCost === 1081.56, `SJBV Custo Unit (1 carro): ${costSJBV_1.unitCost}`);

  const costSJBV_2 = sheets.resolveTripCost('MOGI MIRIM', 'XIAN SJBV', 'CEGONHA', 2, costTable);
  assert(costSJBV_2.unitCost === 540.78, `SJBV Custo Unit (2 carros): ${costSJBV_2.unitCost} (esperado 540.78)`);

  const costSJBV_6 = sheets.resolveTripCost('MOGI MIRIM', 'XIAN SJBV', 'CEGONHA', 6, costTable);
  assert(Math.abs(costSJBV_6.unitCost - 180.26) < 0.01, `SJBV Custo Unit (6 carros): ${costSJBV_6.unitCost} (esperado 180.26)`);

  // 2.2 Andradas Cegonha: R$ 1.100,00
  const costAndradas_1 = sheets.resolveTripCost('MOGI MIRIM', 'ANDRADAS', 'CEGONHA', 1, costTable);
  assert(costAndradas_1.totalTripCost === 1100.00, `Andradas Custo Total: ${costAndradas_1.totalTripCost} (esperado 1100.00)`);
  const costAndradas_2 = sheets.resolveTripCost('MOGI GUAÇU', 'NOVA VIA MOTORS - ANDRADAS', 'CEGONHA', 2, costTable);
  assert(costAndradas_2.unitCost === 550.00, `Andradas Custo Unit (2 carros): ${costAndradas_2.unitCost} (esperado 550.00)`);

  // 2.3 Vinhedo Cegonha: R$ 1.154,49
  const costVinhedo_1 = sheets.resolveTripCost('MOGI MIRIM', 'CODIVE VINHEDO', 'CEGONHA', 1, costTable);
  assert(costVinhedo_1.totalTripCost === 1154.49, `Vinhedo Custo Total: ${costVinhedo_1.totalTripCost} (esperado 1154.49)`);

  // 2.4 Valinhos Cegonha (da aba CUSTO TRANSPORTE: 1014.64)
  const costValinhos = sheets.resolveTripCost('MOGI MIRIM', 'VALINHOS', 'CEGONHA', 1, costTable);
  assert(costValinhos.totalTripCost === 1014.64, `Valinhos Custo Total: ${costValinhos.totalTripCost} (esperado 1014.64)`);

  // 2.5 Itapira Cegonha: R$ 311,34
  const costItapira = sheets.resolveTripCost('MOGI MIRIM', 'ITAPIRA', 'CEGONHA', 1, costTable);
  assert(costItapira.totalTripCost === 311.34, `Itapira Custo Total: ${costItapira.totalTripCost} (esperado 311.34)`);

  // 2.6 Campinas Plataforma (R$ 760,61) vs Cegonha (R$ 909,75 da aba CUSTO TRANSPORTE)
  const costCpsPlat = sheets.resolveTripCost('MOGI MIRIM', 'CAMPINAS', 'PLATAFORMA', 1, costTable);
  assert(costCpsPlat.totalTripCost === 760.61, `Campinas Plataforma: ${costCpsPlat.totalTripCost} (esperado 760.61)`);

  const costCpsCeg = sheets.resolveTripCost('MOGI MIRIM', 'CAMPINAS', 'CEGONHA', 1, costTable);
  assert(costCpsCeg.totalTripCost === 909.75, `Campinas Cegonha: ${costCpsCeg.totalTripCost} (esperado 909.75)`);

  // 2.7 Proteção contra divisão por zero
  const costZero = sheets.resolveTripCost('MOGI MIRIM', 'CAMPINAS', 'CEGONHA', 0, costTable);
  assert(costZero.unitCost === costZero.totalTripCost && !isNaN(costZero.unitCost) && costZero.unitCost > 0, 'Proteção contra divisão por zero em qtd = 0');

  // ─────────────────────────────────────────────────────────────
  // 3. TESTE DO PARSER DE MENSAGENS (Campos, NF e Variações)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── 3. TESTES DO PARSER DE MENSAGENS (Campos e Formatações) ───');

  // 3.1 Mensagem com formatações mistas e faturar colado
  const msg1 = `VEICULO TIGGO 7 PRO MAX DRIVE
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

  const p1 = parseAgendamento(msg1);
  assert(p1 !== null, 'Mensagem padrão do usuário deve ser reconhecida');
  assert(p1.veiculo === 'TIGGO 7 PRO MAX DRIVE', `Veículo extraído: "${p1.veiculo}"`);
  assert(p1.chassiPlaca === '95PEEL61DVB106403', `Chassi extraído: "${p1.chassiPlaca}"`);
  assert(p1.agendarPara === '29/09/2026', `Data normalizada: "${p1.agendarPara}"`);
  assert(resolveNotaFiscal(p1) === 'XIAN SJBV', `Nota Fiscal mapeada: "${resolveNotaFiscal(p1)}" (esperado XIAN SJBV)`);

  // 3.2 Mensagem com "FATURAR PARA:" e asteriscos do WhatsApp
  const msg2 = `*VEICULO*: KAIT ADVANCE
*COR*: PRATA
*CHASSI/ PLACA*: 94DFCAP15TB121875
*FREIO ELETRÔNICO*: NÃO
*DEPARTAMENTO*: VENDAS- NOVOS
*VEÍCULO IMOBILIZADO*: NÃO
*ORIGEM*: NOVA VIA MOTORS / ANDADRAS-MG
*DESTINO*: KENTO MOGI MIRIM
*AGENDAR PARA:* 29/09/2026
*FATURAR*
*PARA*: KENTO MOGI MIRIM`;

  const p2 = parseAgendamento(msg2);
  assert(p2 !== null, 'Mensagem com formatação WhatsApp deve ser reconhecida');
  assert(p2.chassiPlaca === '94DFCAP15TB121875', `Chassi limpo de asteriscos: "${p2.chassiPlaca}"`);
  assert(resolveNotaFiscal(p2) === 'KENTO MM', `Nota Fiscal mapeada: "${resolveNotaFiscal(p2)}" (esperado KENTO MM)`);

  // 3.3 Mensagem com Chassi parcial (ex: 4 dígitos)
  const msg3 = `VEICULO TIGGO 8 PRO
COR: BRANCO
CHASSIS: 6760
DEPARTAMENTO:VENDAS NOVOS
VEICULO IMOBILIZADO:NAO
ORIGEM : MOGI MIRIM
DESTINO: XIAN SAO JOAO DA BOA VISTA
AGENDAR: 29/09/26
FATURAR XIAN SAO JOAO`;

  const p3 = parseAgendamento(msg3);
  assert(p3.chassiPlaca === '6760', `Chassi curto extraído com sucesso: "${p3.chassiPlaca}"`);

  // 3.4 Mensagem com Faturamento compartilhado (50% Hymax 50% Codive)
  const msg4 = `VEICULO CRETA Action
COR: Branca
CHASSIS: TP326920
DEPARTAMENTO:Vendas
ORIGEM : Mogi Guaçu 
DESTINO: CODIVE CPS 
AGENDAR: 02/10/26
FATURAR 50% Hymax 50% Codive`;

  const p4 = parseAgendamento(msg4);
  assert(resolveNotaFiscal(p4) === '50% HYMAX 50% CODIVE', `Faturamento 50/50 preservado: "${resolveNotaFiscal(p4)}"`);

  // 3.5 Proteção contra confundir VEICULO IMOBILIZADO com VEICULO
  const msg5 = `VEICULO IMOBILIZADO: NAO
VEICULO: ONIX PLUS PREMIER
COR: AZUL
CHASSI: 9BGBB48V0LG123456
ORIGEM: MOGI MIRIM
DESTINO: CAMPINAS`;

  const p5 = parseAgendamento(msg5);
  assert(p5.veiculo === 'ONIX PLUS PREMIER', `Veículo não foi sobrescrito por VEICULO IMOBILIZADO: "${p5.veiculo}"`);
  assert(p5.veiculoImobilizado === 'NAO', `Veículo imobilizado capturado corretamente: "${p5.veiculoImobilizado}"`);

  // ─────────────────────────────────────────────────────────────
  // 4. TESTE DE CANCELAMENTO (isCancellationRequest e extractCancellationTarget)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── 4. TESTES DE DETECÇÃO E EXTRAÇÃO DE CANCELAMENTO ───');

  // 4.1 Reenvio de mensagem com "CANCELAR" no final
  const cancelMsg1 = `${msg1}\n\nCANCELAR`;
  assert(isCancellationRequest(cancelMsg1) === true, 'Mensagem com CANCELAR no final deve ser detectada');
  const target1 = extractCancellationTarget(cancelMsg1);
  assert(target1.chassi === '95PEEL61DVB106403', `Chassi extraído para cancelamento: "${target1.chassi}"`);

  // 4.2 Comando direto por chassi
  const cancelMsg2 = 'CANCELAR AGENDAMENTO CHASSI 95PEEL61DVB106403';
  assert(isCancellationRequest(cancelMsg2) === true, 'Comando direto por chassi deve ser detectado');
  const target2 = extractCancellationTarget(cancelMsg2);
  assert(target2.chassi === '95PEEL61DVB106403', `Chassi do comando direto: "${target2.chassi}"`);

  // 4.3 Comando direto por placa
  const cancelMsg3 = 'CANCELAR AGENDAMENTO PLACA ABC1D23';
  assert(isCancellationRequest(cancelMsg3) === true, 'Comando direto por placa deve ser detectado');
  const target3 = extractCancellationTarget(cancelMsg3);
  assert(target3.placa === 'ABC1D23', `Placa do comando direto: "${target3.placa}"`);

  // 4.4 Mensagem normal NÃO deve ser detectada como cancelamento
  assert(isCancellationRequest(msg1) === false, 'Mensagem de agendamento normal NÃO pode ser cancelamento');

  // ─────────────────────────────────────────────────────────────
  // 5. TESTE DE REAGENDAMENTO / CONFIRMAÇÃO DO VANDERLEI G
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── 5. TESTES DE REAGENDAMENTO POR VANDERLEI G ───');

  // 5.1 Validação exclusiva do remetente
  const v1 = isVanderleiSender({ author: '5519999241783@c.us' }, null, '');
  assert(v1 === true, 'Identifica Vanderlei por número WhatsApp (+55 19 99924-1783)');

  const v2 = isVanderleiSender({ author: '12345678@c.us' }, { number: '5519999241783', name: 'Vanderlei G' }, '');
  assert(v2 === true, 'Identifica Vanderlei por contato salvo');

  const v3 = isVanderleiSender({ author: '551988887777@c.us' }, null, 'Adriano Vendas');
  assert(v3 === false, 'NÃO identifica outro remetente como Vanderlei');

  // 5.2 Extração da data de confirmação
  const d1 = extractRescheduleDate('Agendado 29/09 cegonha', new Date(2026, 8, 25));
  assert(d1 === '29/09/2026', `Extrai data de "Agendado 29/09 cegonha": "${d1}"`);

  const d2 = extractRescheduleDate('Agendado cegonha 29/09', new Date(2026, 8, 25));
  assert(d2 === '29/09/2026', `Extrai data de "Agendado cegonha 29/09": "${d2}"`);

  const d3 = extractRescheduleDate('Confirmado para 05/10/26', new Date(2026, 8, 25));
  assert(d3 === '05/10/2026', `Extrai data com ano de 2 dígitos: "${d3}"`);

  const d4 = extractRescheduleDate('Ok recebido obrigado', new Date(2026, 8, 25));
  assert(d4 === null, 'Mensagem sem data retorna null');

  // ─────────────────────────────────────────────────────────────
  // 6. TESTE DE INTEGRIDADE DA PLANILHA GOOGLE SHEETS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── 6. TESTES DE INTEGRIDADE DIRETO NA PLANILHA (OUTUBRO 2026) ───');

  const outRows = await sheets.getSheetRows(spreadsheetId, 'OUTUBRO 2026', false);
  const dataRows = outRows.slice(2); // Linhas 3 em diante

  assert(dataRows.length > 0, `Planilha possui ${dataRows.length} transportes cadastrados`);

  let emptyColsFound = 0;
  let divZeroFound = 0;
  let invalidDatesFound = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rowNum = i + 3;

    // Col A a L
    const data = r[0];
    const depto = r[1];
    const carro = r[2];
    const chassi = r[3];
    const coleta = r[4];
    const entrega = r[5];
    const modalidade = r[6];
    const nf = r[7];
    const custoViagem = r[8];
    const qtd = r[9];
    const custoUnit = r[10];
    const faturado = r[11];

    if (!data || !depto || !carro || !coleta || !entrega || !modalidade || !nf) {
      emptyColsFound++;
      console.error(`    Linha ${rowNum} possui campo essencial vazio:`, { data, depto, carro, chassi, coleta, entrega, nf });
    }

    if (String(custoUnit).includes('#DIV') || String(custoViagem).includes('#DIV')) {
      divZeroFound++;
      console.error(`    Linha ${rowNum} possui erro #DIV/0!`);
    }

    if (!data || !/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      invalidDatesFound++;
      console.error(`    Linha ${rowNum} possui data em formato inválido: "${data}"`);
    }
  }

  assert(emptyColsFound === 0, `Zero colunas essenciais vazias em OUTUBRO 2026 (encontradas: ${emptyColsFound})`);
  assert(divZeroFound === 0, `Zero erros de divisão (#DIV/0!) na planilha (encontrados: ${divZeroFound})`);
  assert(invalidDatesFound === 0, `Todas as datas estão no formato estrito DD/MM/YYYY (inválidas: ${invalidDatesFound})`);

  // ─────────────────────────────────────────────────────────────
  // RESULTADO FINAL
  // ─────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`  📊 RESULTADO DA SUITE: ${passedTests}/${totalTests} TESTES APROVADOS!`);
  if (failedTests === 0) {
    console.log('  🎉 100% DOS TESTES PASSARAM COM SUCESSO ABSOLUTO!');
  } else {
    console.error(`  ⚠️ ${failedTests} TESTE(S) FALHARAM!`);
  }
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('\nErro fatal na execução da suite:', err);
  process.exit(1);
});
