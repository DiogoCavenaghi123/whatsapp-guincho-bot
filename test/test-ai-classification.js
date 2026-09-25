require('dotenv').config();
const { parseAgendamento, isOperationalNoise } = require('../src/parser');
const gemini = require('../src/gemini');

gemini.init();

async function runTests() {
  console.log('\n============================================================');
  console.log('  🧪 TESTE DE VALIDAÇÃO DA IA E PRÉ-FILTROS');
  console.log('============================================================\n');

  const testCases = [
    {
      name: 'Falso positivo de hoje (Aviso de motorista / guincho à disposição)',
      text: '16/09 guincho a disposição do tonhao itapira hz campinas',
      shouldBeAgendamento: false,
    },
    {
      name: 'Confirmação operacional simples (Agendado guincho 22/09)',
      text: 'Agendado guincho 22/09',
      shouldBeAgendamento: false,
    },
    {
      name: 'Confirmação curta de agendamento (Agendado 17/09)',
      text: 'Agendado 17/09',
      shouldBeAgendamento: false,
    },
    {
      name: 'Dúvida operacional sem veículo',
      text: 'O carro de Mogi já foi carregado para cá?',
      shouldBeAgendamento: false,
    },
    {
      name: 'Mensagem de cortesia',
      text: 'Ok obrigado!',
      shouldBeAgendamento: false,
    },
    {
      name: 'Agendamento legítimo formulário padrão (Versa)',
      text: `VEICULO: VERSA ADVANCE
COR: PRETO
CHASSI/ PLACA: 3N1CN8AE1VL803968
ORIGEM: KENTO MOGI
DESTINO: KENTO SJ
AGENDAR PARA: 17/09/2026`,
      shouldBeAgendamento: true,
    },
    {
      name: 'Agendamento legítimo texto corrido (Creta)',
      text: 'Favor agendar transporte para um Creta Comfort de Poços de Caldas para a Codive Campinas amanhã',
      shouldBeAgendamento: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`------------------------------------------------------------`);
    console.log(`[TESTE] ${tc.name}`);
    console.log(`Texto: "${tc.text.substring(0, 60)}..."`);

    let isNoise = isOperationalNoise(tc.text);
    let result = null;

    if (isNoise) {
      console.log(`  -> Pré-filtro descartou como RUÍDO OPERACIONAL ✓`);
    } else {
      result = parseAgendamento(tc.text);
      if (result) {
        console.log(`  -> Parser Regex identificou: Veículo="${result.veiculo}", Rota="${result.origem} -> ${result.destino}"`);
      } else {
        console.log(`  -> Parser Regex não identificou, consultando Gemini AI...`);
        result = await gemini.parseWithGemini(tc.text);
        if (result) {
          console.log(`  -> Gemini AI identificou: Veículo="${result.veiculo}", Rota="${result.origem} -> ${result.destino}"`);
        } else {
          console.log(`  -> Gemini AI classificou como NÃO-AGENDAMENTO.`);
        }
      }
    }

    const isAgendamento = !isNoise && result !== null && !!result.veiculo;
    const testOk = isAgendamento === tc.shouldBeAgendamento;

    if (testOk) {
      console.log(`  Resultado: \x1b[32mPASSOU\x1b[0m (Esperado: ${tc.shouldBeAgendamento ? 'AGENDAMENTO' : 'DESCARTAR'}, Obtido: ${isAgendamento ? 'AGENDAMENTO' : 'DESCARTAR'})`);
      passed++;
    } else {
      console.log(`  Resultado: \x1b[31mFALHOU\x1b[0m (Esperado: ${tc.shouldBeAgendamento ? 'AGENDAMENTO' : 'DESCARTAR'}, Obtido: ${isAgendamento ? 'AGENDAMENTO' : 'DESCARTAR'})`);
      failed++;
    }
  }

  console.log('\n============================================================');
  console.log(`  TOTAL: ${testCases.length} testes | ${passed} passaram | ${failed} falharam`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});

 