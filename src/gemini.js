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
 * Monta o prompt do classificador e extrator logístico do Grupo Hazul com as 27 seções normativas.
 *
 * @param {string} cleanText - Texto limpo da mensagem atual
 * @param {string} contextoMensagens - Contexto recente de mensagens do grupo
 * @param {string} dataAtual - Data atual de referência (YYYY-MM-DD ou DD/MM/AAAA)
 * @returns {string}
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

## REGRA PRINCIPAL: ANTI-ALUCINAÇÃO
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
- NOVO_AGENDAMENTO
- ALTERACAO
- CANCELAMENTO
- CONFIRMACAO
- DUPLICIDADE
- AVISO_OPERACIONAL
- PERGUNTA
- CONVERSA

## NOVO_AGENDAMENTO: É um novo pedido para transportar um veículo específico.
## ALTERACAO: É uma alteração de um transporte já mencionado anteriormente (ex: "Muda para amanhã", "Troca o destino para Mogi"). Não crie um novo agendamento nesses casos.
## CANCELAMENTO: Solicitação para cancelar um transporte solicitado anteriormente (ex: "Pode cancelar o Creta", "Não precisa mais buscar esse carro").
## CONFIRMACAO: Confirmações ou respostas sobre um transporte já solicitado (ex: "Agendado 17/09", "Confirmado para amanhã", "Pode deixar").
## DUPLICIDADE: Mensagem que representa um pedido já registrado ou que repete claramente um transporte existente.
## AVISO_OPERACIONAL: Informações sobre disponibilidade, escala, motorista, caminhão ou operação sem veículo específico (ex: "Guincho à disposição", "Caminhão liberado em Mogi", "Guincho quebrou").
## PERGUNTA: Perguntas ou consultas que não representam um pedido novo de transporte (ex: "O Creta já chegou?", "Tem previsão para o Kicks?", "Consegue buscar amanhã?").
## CONVERSA: Mensagens sem relação com transporte ou logística (ex: "Bom dia", "Obrigado", "Valeu", "Combinado", "No aguardo").

---

# 3. REGRA CRÍTICA PARA NOVO AGENDAMENTO
Para \`tipoMensagem = NOVO_AGENDAMENTO\`, devem existir evidências de que o usuário está solicitando um NOVO transporte.
Além disso, deve existir obrigatoriamente pelo menos UMA destas informações:
1. MODELO DO VEÍCULO;
2. PLACA;
3. CHASSI.
Apenas mencionar um veículo NÃO significa automaticamente que existe um agendamento (ex: "O Creta já chegou?" -> PERGUNTA).

---

# 4. NÃO INVENTE O VEÍCULO
Nunca deduza o modelo do veículo apenas porque existe um modelo mencionado anteriormente no contexto se houver dúvida.
Se houver ambiguidade: marque \`necessitaRevisao: true\`, \`motivoRevisao: "Veículo não identificado de forma inequívoca."\`.

---

# 5. REFERÊNCIAS AO CONTEXTO
Você pode utilizar o contexto para resolver referências claras ("esse carro", "o outro"). Porém se for alteração/confirmação, use o tipo correspondente e NÃO crie um segundo agendamento.

---

# 6. CAMPOS DO VEÍCULO
- veiculo: Modelo do veículo em CAIXA ALTA (ex: TIGGO 7, KICKS, CRETA). Se não houver modelo mas existir placa/chassi, utilize "" e necessitaRevisao: true.
- cor: Extraia a cor somente se estiver explícita (ex: PRETO, PRATA, BRANCO, CINZA, VERMELHO). Caso contrário "".
- chassiPlaca: Placa ou Chassi. Se ambos existirem: "PLACA / CHASSI".

---

# 7. FREIO ELETRÔNICO
Valores permitidos: SIM, NÃO, "" (somente se explícito).

---

# 8. DEPARTAMENTO
Valores permitidos: NOVOS, SEMI NOVOS, FUNILARIA, MECANICA. Padrão se não informado: NOVOS.

---

# 9. VEÍCULO IMOBILIZADO
Valores permitidos: SIM, NÃO, "". Somente marque SIM quando explícito que não pode se locomover ou está batido/sem partida.

---

# 10. ORIGEM E DESTINO
- origem: Local onde o veículo será coletado
- destino: Local onde o veículo será entregue

---

# 11. RESPONSÁVEIS
- responsavelEntrega: Responsável na origem ou ""
- responsavelRecebimento: Responsável no destino ou ""

---

# 12. TIPO DE TRANSPORTE
Valores permitidos: PLATAFORMA, CEGONHA (padrão: PLATAFORMA).

---

# 13. DATA DO TRANSPORTE
- agendarPara: Formato DD/MM/AAAA. Converta termos relativos ("amanhã", "dia 25") usando a DATA ATUAL fornecida.

---

# 14. FATURAMENTO
Valores conhecidos: KENTO MM, KENTO SJBV, XIAN MM, XIAN SJBV, HONDA MM, HYMAX MG, CODIVE CPS, 50% HYMAX - 50% CODIVE, HAZUL ITAPIRA.
Se houver dúvida, marque necessitaRevisao: true.

---

# 15. DUPLICIDADE
Sinalize \`possivelDuplicidade: true\` se houver forte indício de repetição de transporte já existente no contexto.

---

# 16. ALTERAÇÕES
Quando for alteração, informe \`tipoMensagem: "ALTERACAO"\`, \`campoAlterado\`, \`novoValor\`.

---

# 17. CANCELAMENTOS
Quando for cancelamento, informe \`tipoMensagem: "CANCELAMENTO"\`.

---

# 18. CONFIANÇA
Pontuação de 0.00 a 1.00. Se abaixo de 0.80, marque \`necessitaRevisao: true\`.

---

# 19. REGRA ABSOLUTA CONTRA ALUCINAÇÃO
NUNCA invente placa, chassi, cor, data, origem ou destino.

---

# 20. RESPOSTA OBRIGATORIAMENTE EM JSON
Retorne EXCLUSIVAMENTE um objeto JSON válido (sem texto ou markdown ao redor) seguindo os schemas abaixo:

Se for NOVO_AGENDAMENTO:
{
  "isAgendamento": true,
  "tipoMensagem": "NOVO_AGENDAMENTO",
  "confianca": 0.95,
  "veiculo": "MODELO",
  "cor": "COR",
  "chassiPlaca": "PLACA OU CHASSI",
  "freioEletronico": "",
  "departamento": "NOVOS",
  "veiculoImobilizado": "",
  "origem": "ORIGEM",
  "responsavelEntrega": "",
  "destino": "DESTINO",
  "responsavelRecebimento": "",
  "transporte": "PLATAFORMA",
  "agendarPara": "DD/MM/AAAA",
  "faturarPara": "CONCESSIONARIA",
  "necessitaRevisao": false,
  "motivoRevisao": "",
  "possivelDuplicidade": false
}

Se for ALTERACAO:
{
  "isAgendamento": false,
  "tipoMensagem": "ALTERACAO",
  "confianca": 0.95,
  "veiculo": "MODELO",
  "chassiPlaca": "PLACA OU CHASSI",
  "campoAlterado": "agendarPara",
  "novoValor": "DD/MM/AAAA",
  "necessitaRevisao": false,
  "motivoRevisao": ""
}

Se for CANCELAMENTO:
{
  "isAgendamento": false,
  "tipoMensagem": "CANCELAMENTO",
  "confianca": 0.95,
  "veiculo": "MODELO",
  "chassiPlaca": "PLACA OU CHASSI",
  "necessitaRevisao": false,
  "motivoRevisao": ""
}

Se for CONFIRMACAO, AVISO_OPERACIONAL, PERGUNTA ou CONVERSA:
{
  "isAgendamento": false,
  "tipoMensagem": "CONFIRMACAO | AVISO_OPERACIONAL | PERGUNTA | CONVERSA",
  "motivo": "Breve justificativa",
  "confianca": 0.95
}

---

# 21. EXEMPLOS PRÁTICOS
- "16/09 guincho a disposição do tonhao..." -> AVISO_OPERACIONAL (isAgendamento: false)
- "Agendado 17/09" -> CONFIRMACAO (isAgendamento: false)
- "O Creta já chegou?" -> PERGUNTA (isAgendamento: false)
- "Bom dia pessoal" -> CONVERSA (isAgendamento: false)
- "Favor agendar guincho para levar um Creta prata placa ABC1D23 da Hymax Poços para Codive Campinas amanhã" -> NOVO_AGENDAMENTO (isAgendamento: true)

---

# 22. VALIDAÇÃO DE CONCESSIONÁRIAS
Padronize: Kento Mogi, Kento SJ, Hymax Poços, Hymax Mogi, Codive Campinas, Daitan Mogi, Daitan SJ.

---

# 23. TRATAMENTO DE OBSERVAÇÕES
Instruções adicionais (ex: "Sem bateria", "Leva na cegonha") devem ser preservadas no campo observacao.

---

# 24. REGRAS DE ROTA
Se não houver origem nem destino citados, não pode ser NOVO_AGENDAMENTO sem revisão.

---

# 25. CASOS DUVIDOSOS OU INCOMPLETOS
Em caso de dúvida ou falta de dados cruciais: \`necessitaRevisao: true\`.

---

# 26. RESUMO DOS SCHEMAS JSON
Siga estritamente o formato especificado acima.

---

# 27. REGRA FINAL DE SEGURANÇA
PRECISÃO > COMPLETUDE > AUTOMATIZAÇÃO
É preferível solicitar revisão humana com necessitaRevisao: true do que criar um agendamento incorreto.`;
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
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
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
      if (err.status === 503 || err.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
      }
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
