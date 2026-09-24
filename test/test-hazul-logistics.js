// ==========================================================================
//  Testes Automatizados: Regras Logísticas do Grupo Hazul
//  - Detecção de Viagem com Cobrança de Frete
//  - Tabela de Custos e Cálculo de Rota
//  - Agrupamento de Veículos por Transporte (Mesmo Destino ou Ida e Volta)
// ==========================================================================

const assert = require('assert');
const parser = require('../src/parser');
const sheets = require('../src/sheets');
const history = require('../src/history');

console.log('🧪 Iniciando testes de regras logísticas...\n');

// ── Teste 1: Detecção de Mensagem Operacional com Cobrança ───────────────
console.log('▶ Teste 1: Parser não deve descartar mensagem operacional com cobrança de frete');
const msgCobrar = '16/09 guincho a disposição do tonhao itapira hz campinas cobrar uma viagem';
const isNoise = parser.isOperationalNoise(msgCobrar);
console.log(`  Mensagem: "${msgCobrar}"`);
console.log(`  isOperationalNoise: ${isNoise}`);
assert.strictEqual(isNoise, false, 'Mensagem com "cobrar uma viagem" NÃO pode ser descartada como ruído!');
console.log('  ✓ Passou!\n');

// ── Teste 2: Fila de Aprovações do Histórico ───────────────────────────────
console.log('▶ Teste 2: Mensagem classificada como SOLICITACAO_VIAGEM deve entrar na fila de aprovação');
const testId = 'test_msg_' + Date.now();
history.recordMessage({
  messageId: testId,
  sender: '551999999999@c.us',
  author: 'Operador Tonhão',
  body: msgCobrar,
  texto: msgCobrar,
  timestamp: Date.now(),
  status: 'PENDENTE_APROVACAO',
  tipoMensagem: 'SOLICITACAO_VIAGEM',
  necessitaAprovacao: true,
  dadosExtraidos: {
    data: '16/09/2026',
    origem: 'ITAPIRA',
    destino: 'CAMPINAS',
    veiculo: 'VIAGEM GUINCHO - TONHÃO',
    departamento: 'SEMI NOVOS',
    veiculoTransporte: 'PLATAFORMA',
    custoViagem: 'R$ 760,61',
  },
});

const pendentes = history.getPendingApprovals();
const found = pendentes.find((p) => p.id === testId);
assert.ok(found, 'A mensagem adicionada deve constar na lista de pendentes de aprovação!');
assert.strictEqual(found.status, 'PENDENTE_APROVACAO');
console.log(`  Item encontrado na fila: ${found.id} | Status: ${found.status}`);
console.log('  ✓ Passou!\n');

// ── Teste 3: Cálculo de Custo por Rota ─────────────────────────────────────
console.log('▶ Teste 3: Resolução de custos conforme a tabela master');
const costCampinas1 = sheets.resolveTripCost('ITAPIRA', 'CAMPINAS', 'PLATAFORMA', 1);
console.log(`  Itapira -> Campinas (1 carro): Total = ${costCampinas1.formattedTotal} | Unit = ${costCampinas1.formattedUnit}`);
assert.strictEqual(costCampinas1.totalTripCost, 760.61);
assert.strictEqual(costCampinas1.unitCost, 760.61);

const costCampinas2 = sheets.resolveTripCost('MOGI MIRIM', 'CAMPINAS', 'PLATAFORMA', 2);
console.log(`  Mogi -> Campinas (2 carros): Total = ${costCampinas2.formattedTotal} | Unit = ${costCampinas2.formattedUnit}`);
assert.strictEqual(costCampinas2.totalTripCost, 760.61);
assert.strictEqual(Math.round(costCampinas2.unitCost * 100) / 100, 380.31);

const costSJBV = sheets.resolveTripCost('MOGI MIRIM', 'SJBV', 'PLATAFORMA', 1);
console.log(`  Mogi -> SJBV (1 carro): Total = ${costSJBV.formattedTotal}`);
assert.strictEqual(costSJBV.totalTripCost, 900.00);

const costItapira = sheets.resolveTripCost('MOGI MIRIM', 'ITAPIRA', 'PLATAFORMA', 1);
console.log(`  Mogi -> Itapira (1 carro): Total = ${costItapira.formattedTotal}`);
assert.strictEqual(costItapira.totalTripCost, 265.95);
console.log('  ✓ Passou!\n');

// ── Teste 4: Agrupamento de Veículos por Transporte ───────────────────────
console.log('▶ Teste 4: Identificação de frete compartilhado e ida e volta');

// Caso A: Dois carros para o mesmo destino no mesmo dia
const t1 = { origem: 'Mogi Mirim', destino: 'Campinas' };
const t2 = { origem: 'Mogi Mirim', destino: 'Campinas Hz' };
const relatedSameDest = sheets.areTransportsRelated(t1, t2);
console.log(`  Caso A (Mesmo destino Campinas): areTransportsRelated = ${relatedSameDest}`);
assert.strictEqual(relatedSameDest, true, 'Carros para o mesmo destino devem ser agrupados no mesmo frete!');

// Caso B: Ida e volta casada no mesmo dia (um indo para o local e outro voltando para o ponto de partida)
const t3 = { origem: 'Mogi Mirim', destino: 'Campinas' };
const t4 = { origem: 'Campinas', destino: 'Mogi Mirim' };
const relatedRoundTrip = sheets.areTransportsRelated(t3, t4);
console.log(`  Caso B (Ida e volta casada Mogi <-> Campinas): areTransportsRelated = ${relatedRoundTrip}`);
assert.strictEqual(relatedRoundTrip, true, 'Ida e volta casada deve ser agrupada como dois carros no transporte!');

// Caso C: Cidades diferentes no mesmo dia
const t5 = { origem: 'Mogi Mirim', destino: 'Campinas' };
const t6 = { origem: 'Mogi Mirim', destino: 'São João da Boa Vista' };
const relatedDiff = sheets.areTransportsRelated(t5, t6);
console.log(`  Caso C (Campinas vs SJBV): areTransportsRelated = ${relatedDiff}`);
assert.strictEqual(relatedDiff, false, 'Cidades distintas não devem ser agrupadas no mesmo frete!');

console.log('  ✓ Passou!\n');

// Limpeza do item de teste
history.updateMessage(testId, { status: 'DESCARTADO' });
console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
