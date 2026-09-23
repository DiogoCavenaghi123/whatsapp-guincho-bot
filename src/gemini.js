// =============================================================
//  Gemini — Classificador e Extrator Logístico (Grupo Hazul)
// =============================================================

const { GoogleGenAI } = require('@google/genai');
const logger = require('./logger');

let ai = null;

function init() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('GEMINI_API_KEY não encontrada no .env. Modo IA desabilitado.');
    return;
  }
  ai = new GoogleGenAI({ apiKey });
  logger.success('Gemini AI inicializado com sucesso! 🤖');
}

/**
 * Monta o prompt do classificador e extrator logístico do Grupo Hazul.
 */
function buildPrompt(cleanText, contextoMensagens, dataAtual) {
  return `# CLASSIFICADOR E EXTRATOR LOGÍSTICO — GRUPO HAZUL

Você é um sistema de **classificação, interpretação e extração de dados logísticos de extrema precisão** para o Grupo Hazul.

Sua função é analisar mensagens trocadas em grupos operacionais do WhatsApp e determinar se elas representam:
* um NOVO pedido de transporte;
* uma ALTERAÇÃO de transporte existente;
* um CANCELAMENTO;
* uma DUPLICIDADE;
* uma CONFIRMAÇÃO;
* uma PERGUNTA;
* um AVISO OPERACIONAL;
* ou apenas CONVERSA.

## REGRA PRINCIPAL
**Nunca crie, complete ou invente informações que não estejam presentes na mensagem ou no contexto fornecido.**
A IA deve interpretar o que foi escrito, mas não deve tomar decisões baseadas em suposições.
Quando uma informação obrigatória não puder ser determinada com segurança, marque a situação como \`necessitaRevisao: true\`.

---

# 1. CONTEXTO DA ANÁLISE

### MENSAGEM ATUAL
"""
${cleanText}
"""

### CONTEXTO RECENTE DO GRUPO
"""
${contextoMensagens || '(Nenhuma mensagem recente anterior no contexto)'}
"""

### DATA ATUAL
${dataAtual}

Use a data atual para interpretar expressões relativas como: hoje, amanhã, depois de amanhã, sexta, segunda, próxima semana.
Nunca transforme uma data relativa em uma data absoluta sem considerar a data atual fornecida.

---

# 2. TIPOS DE MENSAGEM

Classifique a mensagem em EXATAMENTE um dos seguintes tipos:
NOVO_AGENDAMENTO
ALTERACAO
CANCELAMENTO
CONFIRMACAO
DUPLICIDADE
AVISO_OPERACIONAL
PERGUNTA
CONVERSA

## NOVO_AGENDAMENTO
É um novo pedido para transportar um veículo específico.

## ALTERACAO
É uma alteração de um transporte já mencionado anteriormente.
Exemplos: "Muda para amanhã.", "Pode entregar em Campinas.", "Troca o destino para Mogi.", "Esse vai na cegonha."
Não crie um novo agendamento nesses casos.

## CANCELAMENTO
É uma solicitação para cancelar um transporte anteriormente solicitado.
Exemplos: "Pode cancelar o Creta.", "Não precisa mais buscar esse carro.", "Cancela o transporte de amanhã."

## CONFIRMACAO
Confirmações ou respostas sobre um transporte já solicitado.
Exemplos: "Agendado 17/09.", "Confirmado para amanhã.", "Pode deixar.", "Já foi agendado."

## DUPLICIDADE
Mensagem que representa um pedido já registrado ou que claramente repete um transporte existente.

## AVISO_OPERACIONAL
Informações sobre disponibilidade, escala, motorista, caminhão ou operação, sem solicitação de transporte de veículo específico.
Exemplos: "Guincho à disposição.", "Caminhão liberado em Mogi.", "Guincho quebrou.", "Motorista disponível amanhã."

## PERGUNTA
Perguntas ou consultas que não representam um pedido novo de transporte.
Exemplos: "O Creta já chegou?", "Tem previsão para o Kicks?", "Consegue buscar amanhã?"

## CONVERSA
Mensagens sem relação com um novo transporte ou com a operação logística.
Exemplos: "Bom dia.", "Obrigado.", "Valeu.", "Combinado.", "No aguardo."

---

# 3. REGRA CRÍTICA PARA NOVO AGENDAMENTO

Para \`tipoMensagem = NOVO_AGENDAMENTO\`, devem existir evidências de que o usuário está solicitando um NOVO transporte.
Além disso, deve existir obrigatoriamente pelo menos UMA destas informações:
1. MODELO DO VEÍCULO;
2. PLACA;
3. CHASSI.

Exemplos válidos: TIGGO 7, KICKS, VERSA, CRETA, HB20, COROLLA, CAMARO, ABC1D23, 9BWZZZ..., chassi 95P...

### IMPORTANTE:
Apenas mencionar um veículo NÃO significa automaticamente que existe um agendamento.
Exemplo: "O Creta já chegou?" -> PERGUNTA
Exemplo: "Tem previsão para o Creta chegar?" -> PERGUNTA
Exemplo: "Creta prata, buscar na Hymax e levar para Codive amanhã." -> NOVO_AGENDAMENTO

---

# 4. NÃO INVENTE O VEÍCULO
Nunca deduza o modelo do veículo apenas porque existe um modelo mencionado anteriormente no contexto.
Se houver ambiguidade: \`necessitaRevisao: true\`, \`motivoRevisao: "Veículo não identificado de forma inequívoca."\`

---

# 5. REFERÊNCIAS AO CONTEXTO
Você pode utilizar o contexto para resolver referências claras.
Se a mensagem atual for continuação ou mudança ("Pode mandar amanhã"), classifique como ALTERACAO ou CONFIRMACAO, NÃO crie um segundo agendamento.

---

# 6. CAMPOS DO VEÍCULO
Para um novo agendamento, extraia:
- veiculo: Modelo do veículo em CAIXA ALTA (ex: TIGGO 7, KICKS, CRETA). Nunca coloque "-", "N/A" ou "DESCONHECIDO". Se não houver modelo, mas existir placa ou chassi, utilize "" e marque necessitaRevisao: true.
- cor: Extraia a cor somente se estiver explícita (ex: PRETO, PRATA, BRANCO, CINZA, VERMELHO). Caso contrário "".
- chassiPlaca: Prioridade: 1. Chassi; 2. Placa. Se ambos existirem, coloque ambos separados por " / " (ex: "ABC1D23 / 95P...").

---

# 7. FREIO ELETRÔNICO
Valores permitidos: SIM, NÃO, "" (preencher somente se explícito).

---

# 8. DEPARTAMENTO
Valores permitidos: NOVOS, SEMI NOVOS, FUNILARIA, MECANICA.
Se não houver informação suficiente: utilize "" e necessitaRevisao: true. NÃO invente NOVOS sem evidência.

---

# 9. VEÍCULO IMOBILIZADO
Valores permitidos: SIM, NÃO, "". Somente marque SIM quando explícito que não pode se locomover.

---

# 10. ORIGEM E DESTINO
- origem: local onde o veículo será coletado
- destino: local onde o veículo será entregue

---

# 11. RESPONSÁVEIS
- responsavelEntrega: responsável na origem ou ""
- responsavelRecebimento: responsável no destino ou ""

---

# 12. TIPO DE TRANSPORTE
Valores permitidos: PLATAFORMA, CEGONHA (se houver indicação explícita de cegonha use CEGONHA, senão PLATAFORMA).

---

# 13. DATA DO TRANSPORTE
- agendarPara: formato obrigatório DD/MM/AAAA.
Interprete termos relativos (hoje, amanhã, dia 25) utilizando a dataAtual fornecida. Se não puder ser determinada, coloque "".

---

# 14. FATURAMENTO
Valores conhecidos:
KENTO MM, KENTO SJBV, XIAN MM, XIAN SJBV, HONDA MM, HYMAX MG, CODIVE CPS, 50% HYMAX - 50% CODIVE, HAZUL ITAPIRA.
Regras:
- Coleta ou entrega em Mogi Mirim Toyota -> KENTO MM
- Coleta ou entrega em São João Toyota -> KENTO SJBV
- Coleta ou entrega na Caoa Chery Mogi -> XIAN MM
- Coleta ou entrega na Caoa Chery São João -> XIAN SJBV
- Coleta ou entrega em Honda -> HONDA MM
- Coleta ou entrega no Sul de Minas / Poços -> HYMAX MG
- Coleta ou entrega em Campinas -> CODIVE CPS
- Transferência mútua entre Hymax e Codive -> 50% HYMAX - 50% CODIVE
Se houver dúvida: utilize "" e necessitaRevisao: true.

---

# 15. DUPLICIDADE
A IA deve identificar possíveis duplicidades utilizando chassi, placa ou modelo+origem+destino+data.
Não considere duplicado se origem ou destino forem diferentes. Sinalize \`possivelDuplicidade: true\` se houver forte indício.

---

# 16. ALTERAÇÕES
Quando for alteração: \`tipoMensagem: "ALTERACAO"\`, \`campoAlterado: "..."\`, \`novoValor: "..."\`.

---

# 17. CANCELAMENTOS
Quando for cancelamento: \`tipoMensagem: "CANCELAMENTO"\`.

---

# 18. CONFIANÇA
Pontuação entre 0.00 e 1.00. Se for abaixo de 0.80, marque \`necessitaRevisao: true\`.

---

# 19. REGRA ABSOLUTA CONTRA ALUCINAÇÃO
NUNCA invente placa, chassi, cor, data, origem, destino, responsável, departamento ou faturamento.

---

# 20. RESPOSTA OBRIGATORIAMENTE EM JSON
Retorne EXCLUSIVAMENTE um objeto JSON válido (sem qualquer texto, markdown ou explicações fora do JSON).

ESTRUTURAS ESPERADAS:

Para NOVO_AGENDAMENTO:
{
  "isAgendamento": true,
  "tipoMensagem": "NOVO_AGENDAMENTO",
  "confianca": 0.98,
  "veiculo": "TIGGO 7",
  "cor": "PRETO",
  "chassiPlaca": "ABC1D23",
  "freioEletronico": "",
  "departamento": "NOVOS",
  "veiculoImobilizado": "",
  "origem": "HYMAX POÇOS",
  "responsavelEntrega": "",
  "destino": "CODIVE CAMPINAS",
  "responsavelRecebimento": "",
  "transporte": "PLATAFORMA",
  "agendarPara": "24/09/2026",
  "faturarPara": "HYMAX MG",
  "necessitaRevisao": false,
  "motivoRevisao": "",
  "possivelDuplicidade": false
}

Para ALTERACAO:
{
  "isAgendamento": false,
  "tipoMensagem": "ALTERACAO",
  "confianca": 0.96,
  "veiculo": "CRETA",
  "chassiPlaca": "ABC1D23",
  "campoAlterado": "agendarPara",
  "novoValor": "25/09/2026",
  "necessitaRevisao": false,
  "motivoRevisao": ""
}

Para CANCELAMENTO:
{
  "isAgendamento": false,
  "tipoMensagem": "CANCELAMENTO",
  "confianca": 0.97,
  "veiculo": "CRETA",
  "chassiPlaca": "ABC1D23",
  "necessitaRevisao": false,
  "motivoRevisao": ""
}

Para CONFIRMACAO, AVISO_OPERACIONAL, PERGUNTA ou CONVERSA:
{
  "isAgendamento": false,
  "tipoMensagem": "CONFIRMACAO",
  "motivo": "Confirmação de transporte já solicitado.",
  "confianca": 0.99
}

---

# 27. REGRA FINAL DE SEGURANÇA
A prioridade absoluta deste sistema é:
PRECISÃO > COMPLETUDE > AUTOMATIZAÇÃO
É preferível enviar um caso para revisão humana com necessitaRevisao: true do que criar um agendamento incorreto.`;
}

/**
 * Classifica detalhadamente a mensagem retornando o objeto de classificação completo.
 *
 * @param {string} text - Mensagem bruta
 * @param {object} [options]
 * @param {string} [options.contextoMensagens] - Histórico recente de mensagens do grupo
 * @param {string} [options.dataAtual] - Data atual para resolução de termos relativos
 * @returns {Promise<object|null>}
 */
async function classifyWithGemini(text, options = {}) {
  if (!ai || !text || typeof text !== 'string') return null;

  const cleanText = text.trim();
  if (cleanText.length < 3) return null;

  const dataAtual = options.dataAtual || new Date().toLocaleDateString('pt-BR');
  const contextoMensagens = options.contextoMensagens || '';

  const prompt = buildPrompt(cleanText, contextoMensagens, dataAtual);

  const models = [
    process.env.GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-1.5-flash',
  ].filter(Boolean);

  let responseText = null;

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Máxima precisão e determinismo
        },
      });
      if (res && res.text) {
        responseText = res.text;
        break;
      }
    } catch (err) {
      logger.debug(`Modelo ${model} indisponível (${err.status || err.message}), tentando próximo...`);
    }
  }

  if (!responseText) return null;

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validação estrita de novo agendamento
    if (parsed.isAgendamento === true || parsed.tipoMensagem === 'NOVO_AGENDAMENTO') {
      const veiculo = (parsed.veiculo || '').trim();
      const chassiPlaca = (parsed.chassiPlaca || '').trim();

      // Regra 3: É obrigatório modelo OU placa/chassi
      if (!veiculo && !chassiPlaca) {
        parsed.isAgendamento = false;
        parsed.tipoMensagem = parsed.tipoMensagem || 'AVISO_OPERACIONAL';
        parsed.motivo = 'Sem identificação de veículo, placa ou chassi.';
      } else {
        parsed.isAgendamento = true;
      }
    }

    return parsed;
  } catch (parseErr) {
    logger.debug(`Erro no parse JSON do Gemini: ${parseErr.message}`);
    return null;
  }
}

/**
 * Função compatível com o fluxo do bot: retorna os dados do agendamento
 * se for NOVO_AGENDAMENTO válido, ou null caso contrário.
 *
 * @param {string} text - Texto da mensagem
 * @param {object} [options]
 * @returns {Promise<object|null>}
 */
async function parseWithGemini(text, options = {}) {
  const result = await classifyWithGemini(text, options);
  if (!result) return null;

  if (result.isAgendamento === true) {
    const veiculo = (result.veiculo || '').trim();
    if (!veiculo || veiculo === '-' || veiculo === 'N/D') {
      logger.debug('Gemini retornou isAgendamento=true mas sem modelo de veículo válido.');
      return null;
    }
    return result;
  }

  logger.debug(`Gemini classificou mensagem como [${result.tipoMensagem || 'NÃO-AGENDAMENTO'}]: ${result.motivo || result.motivoRevisao || ''}`);
  return null;
}

module.exports = {
  init,
  classifyWithGemini,
  parseWithGemini,
  buildPrompt,
};
