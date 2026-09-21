// =============================================================
//  Gemini — Extração Inteligente e Blindada de Agendamentos
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
 * Usa o Gemini com prompt contextual rigoroso para classificar se a mensagem
 * é um PEDIDO REAL de transporte de veículo e extrair seus dados.
 *
 * @param {string} text - Texto bruto da mensagem do WhatsApp
 * @returns {Promise<object|null>} - Objeto com os campos ou null se não for agendamento
 */
async function parseWithGemini(text) {
  if (!ai || !text || typeof text !== 'string') return null;

  const cleanText = text.trim();
  if (cleanText.length < 5) return null;

  try {
    const prompt = `Você é um classificador e extrator de dados de extrema precisão para uma empresa de transporte e guincho de veículos (Grupo Hazul).
Sua missão é analisar mensagens trocadas em um grupo operacional de WhatsApp e determinar se a mensagem é uma SOLICITAÇÃO REAL DE TRANSPORTE DE VEÍCULO ou apenas conversa/confirmação/aviso operacional.

CRITÉRIO CRÍTICO PARA SER UM AGENDAMENTO ("isAgendamento": true):
1. Deve ser um PEDIDO NOVO DE TRANSPORTE DE UM VEÍCULO ESPECÍFICO.
2. É OBRIGATÓRIO haver o modelo do carro (ex: TIGGO 7, KICKS, VERSA, CRETA, HB20, CAMARO, COROLLA, etc.) OU a placa/chassi do carro.
3. Se NÃO houver um carro/veículo claramente especificado que precisa ser transportado, NÃO É UM AGENDAMENTO.

EXEMPLOS DE MENSAGENS QUE NÃO SÃO AGENDAMENTOS ("isAgendamento": false):
- Confirmações simples enviadas por motoristas ou atendentes:
  * "Agendado 17/09" -> NÃO é agendamento (é apenas uma confirmação).
  * "Agendado guincho 18/09" -> NÃO é agendamento.
  * "Agendado cegonha 17/09" -> NÃO é agendamento.
  * "Ok confirmado para amanhã" -> NÃO é agendamento.
- Avisos de disponibilidade de caminhão/guincho ou motorista:
  * "16/09 guincho a disposição do tonhao itapira hz campinas" -> NÃO é agendamento (não transporta nenhum carro, é apenas aviso de escala de motorista).
  * "Guincho quebrou, está na oficina" -> NÃO é agendamento.
  * "Caminhão liberado em Mogi" -> NÃO é agendamento.
- Perguntas, dúvidas operacionais ou cobranças:
  * "O carro de Mogi já foi carregado?" -> NÃO é agendamento.
  * "Tem previsão para o Creta chegar?" -> NÃO é agendamento.
  * "Consegue buscar um carro amanhã?" (pergunta aberta sem dados) -> NÃO é agendamento.
- Mensagens de cortesia:
  * "Bom dia", "Obrigado", "Valeu", "No aguardo".

EXEMPLOS DE MENSAGENS QUE SÃO AGENDAMENTOS ("isAgendamento": true):
- "VEICULO: TIGGO 7 PRO / COR: PRETO / CHASSI: 95P... / ORIGEM: MOGI / DESTINO: SJBV" -> É agendamento.
- "Favor agendar guincho para levar um Creta prata placa ABC1D23 da Hymax Poços para a Codive Campinas amanhã" -> É agendamento.
- "Preciso de transporte para um Kicks de Itapira para Mogi Mirim dia 25" -> É agendamento.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem qualquer texto ou markdown adicional) com a seguinte estrutura:

Se for um agendamento legítimo:
{
  "isAgendamento": true,
  "veiculo": "modelo do veículo (OBRIGATÓRIO. Nunca deixe vazio ou '-', exemplo: TIGGO 7, KICKS, VERSA, CRETA, etc.)",
  "cor": "cor do veículo ou string vazia",
  "chassiPlaca": "placa ou chassi do veículo ou string vazia",
  "freioEletronico": "SIM ou NÃO ou string vazia",
  "departamento": "classifique em um destes 4: NOVOS, SEMI NOVOS, FUNILARIA ou MECANICA (padrão: NOVOS)",
  "veiculoImobilizado": "SIM ou NÃO ou string vazia",
  "origem": "local de coleta/origem",
  "responsavelEntrega": "responsável pela entrega na origem ou string vazia",
  "destino": "local de entrega/destino",
  "responsavelRecebimento": "responsável pelo recebimento no destino ou string vazia",
  "transporte": "PLATAFORMA ou CEGONHA (padrão PLATAFORMA)",
  "agendarPara": "data agendada ou string vazia",
  "faturarPara": "concessionária pagante da nota fiscal (ex: KENTO MM, KENTO SJBV, XIAN MM, XIAN SJBV, HONDA MM, HYMAX MG, CODIVE CPS, HAZUL ITAPIRA)"
}

Se NÃO for uma solicitação de transporte de veículo:
{
  "isAgendamento": false,
  "motivo": "breve justificativa (ex: aviso operacional sem veículo, confirmação simples, pergunta)"
}

MENSAGEM A ANALISAR:
\"\"\"
${cleanText}
\"\"\"`;

    const models = [
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
    ];
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
        // Falha no modelo atual (503, 429 ou timeout), tenta o próximo modelo da lista
        logger.debug(`Modelo ${model} indisponível (${err.status || err.message}), tentando próximo...`);
      }
    }

    if (!responseText) return null;

    // Extrai o bloco JSON da resposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // ── VALIDAÇÃO ESTRITA DE AGENDAMENTO ─────────────────────
    // Se a IA indicou que NÃO é agendamento, descarta sumariamente!
    if (parsed.isAgendamento !== true) {
      logger.debug(`Gemini descartou mensagem: ${parsed.motivo || 'não é solicitação de transporte'}`);
      return null;
    }

    // O modelo de veículo é ESTRITAMENTE OBRIGATÓRIO
    const veiculo = (parsed.veiculo || '').trim();
    if (!veiculo || veiculo === '-' || veiculo === 'N/D' || veiculo.length < 2) {
      logger.debug('Gemini retornou isAgendamento=true mas sem modelo de veículo válido. Rejeitado.');
      return null;
    }

    // Precisa ter pelo menos uma origem ou um destino definidos
    const origem = (parsed.origem || '').trim();
    const destino = (parsed.destino || '').trim();
    if (!origem && !destino) {
      logger.debug('Gemini retornou isAgendamento=true mas sem rota (origem/destino). Rejeitado.');
      return null;
    }

    return parsed;
  } catch (err) {
    logger.debug(`Aviso ao interpretar com Gemini: ${err.message}`);
    return null;
  }
}

module.exports = { init, parseWithGemini };
