const assert = require('assert');
const dealerships = require('../src/dealerships');
const parser = require('../src/parser');
const distance = require('../src/distance');

console.log('--- Iniciando Testes de Padronização de Concessionárias ---');

// 1. Testes de Casos Citados pelo Usuário
console.log('1. Casos explícitos do usuário:');
assert.strictEqual(dealerships.standardizeDealershipName('kento'), 'KENTO MM', 'kento deve ser KENTO MM');
assert.strictEqual(dealerships.standardizeDealershipName('kento mm'), 'KENTO MM', 'kento mm deve ser KENTO MM');
assert.strictEqual(dealerships.standardizeDealershipName('kento sj'), 'KENTO SJBV', 'kento sj deve ser KENTO SJBV');
assert.strictEqual(dealerships.standardizeDealershipName('kento sjbv'), 'KENTO SJBV', 'kento sjbv deve ser KENTO SJBV');
console.log('   OK: Casos Kento validados.');

// 2. Testes de Demais Concessionárias e Variações
console.log('2. Variações das demais concessionárias:');
assert.strictEqual(dealerships.standardizeDealershipName('xian'), 'XIAN MM');
assert.strictEqual(dealerships.standardizeDealershipName('xian mm'), 'XIAN MM');
assert.strictEqual(dealerships.standardizeDealershipName('xian sj'), 'XIAN SJBV');
assert.strictEqual(dealerships.standardizeDealershipName('xian sjbv'), 'XIAN SJBV');
assert.strictEqual(dealerships.standardizeDealershipName('codive valinhos'), 'CODIVE VALINHOS');
assert.strictEqual(dealerships.standardizeDealershipName('codive val'), 'CODIVE VALINHOS');
assert.strictEqual(dealerships.standardizeDealershipName('codive vinhedo'), 'CODIVE VINHEDO');
assert.strictEqual(dealerships.standardizeDealershipName('codive vin'), 'CODIVE VINHEDO');
assert.strictEqual(dealerships.standardizeDealershipName('codive'), 'CODIVE DOM PEDRO');
assert.strictEqual(dealerships.standardizeDealershipName('codive dom pedro'), 'CODIVE DOM PEDRO');
assert.strictEqual(dealerships.standardizeDealershipName('hz campinas'), 'CODIVE DOM PEDRO');
assert.strictEqual(dealerships.standardizeDealershipName('codive castelo'), 'CODIVE CASTELO');
assert.strictEqual(dealerships.standardizeDealershipName('divem'), 'DIVEM MM');
assert.strictEqual(dealerships.standardizeDealershipName('dueto mm'), 'DIVEM MM');
assert.strictEqual(dealerships.standardizeDealershipName('hymax'), 'HYMAX MG');
assert.strictEqual(dealerships.standardizeDealershipName('hymax mg'), 'HYMAX MG');
assert.strictEqual(dealerships.standardizeDealershipName('kodyve'), 'KODYVE MM');
assert.strictEqual(dealerships.standardizeDealershipName('honda mm'), 'KODYVE MM');
assert.strictEqual(dealerships.standardizeDealershipName('service locadora'), 'SERVICE LOCADORA');
assert.strictEqual(dealerships.standardizeDealershipName('codive assinatura'), 'CODIVE ASSINATURA');
assert.strictEqual(dealerships.standardizeDealershipName('funilaria express'), 'FUNILARIA EXPRESS');
assert.strictEqual(dealerships.standardizeDealershipName('perfeito funilaria'), 'PERFEITO FUNILARIA');
assert.strictEqual(dealerships.standardizeDealershipName('hazul posse'), 'HAZUL POSSE');
assert.strictEqual(dealerships.standardizeDealershipName('mogi business center'), 'MOGI BUSINESS CENTER');
assert.strictEqual(dealerships.standardizeDealershipName('tyreplus'), 'TYREPLUS MM');
assert.strictEqual(dealerships.standardizeDealershipName('tyreplus mm'), 'TYREPLUS MM');
assert.strictEqual(dealerships.standardizeDealershipName('tyreplus indaiatuba'), 'TYREPLUS INDAIATUBA');
assert.strictEqual(dealerships.standardizeDealershipName('tyreplus indaia'), 'TYREPLUS INDAIATUBA');
console.log('   OK: Todas as 17 unidades e aliases validados.');

// 3. Teste de Busca de Endereços Físicos das Lojas
console.log('3. Busca de endereços físicos para rotas:');
const addrValinhos = dealerships.getDealershipAddress('codive valinhos');
assert.ok(addrValinhos.includes('Rua Campos Sales, 715'), 'Endereço de Valinhos incorreto');
assert.ok(addrValinhos.includes('Valinhos - SP'), 'Cidade de Valinhos incorreta');

const addrKento = dealerships.getDealershipAddress('kento');
assert.ok(addrKento.includes('Rua Padre Roque, 2222'), 'Endereço Kento MM incorreto');

const addrKentoSJ = dealerships.getDealershipAddress('kento sjbv');
assert.ok(addrKentoSJ.includes('Avenida Treze de Maio, 729'), 'Endereço Kento SJBV incorreto');

console.log('   OK: Endereços físicos resolvidos com exatidão.');

// 4. Teste de Parser: resolveNotaFiscal e toSheetRow
console.log('4. Integração com o Parser:');
const msgAgendamento = `
VEICULO: COROLLA CROSS
COR: BRANCO
CHASSI: 9BRBL30E8P123456
ORIGEM: Kento
DESTINO: Codive Valinhos
FATURAR PARA: kento sj
`;
const parsed = parser.parseAgendamento(msgAgendamento);
assert.ok(parsed, 'Falha ao fazer parse do agendamento');
const row = parser.toSheetRow(parsed, new Date());
console.log('   Linha gerada para a planilha:', row);
assert.strictEqual(row[4], 'KENTO MM', 'Origem na planilha deve ser KENTO MM');
assert.strictEqual(row[5], 'CODIVE VALINHOS', 'Destino na planilha deve ser CODIVE VALINHOS');
assert.strictEqual(row[7], 'KENTO SJBV', 'Nota fiscal / faturamento deve ser KENTO SJBV');

console.log('   OK: Parser e geração da linha da planilha 100% integrados.');

console.log('\n>>> TODOS OS TESTES PASSARAM COM SUCESSO! <<<');

