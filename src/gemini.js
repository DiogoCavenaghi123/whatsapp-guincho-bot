// =============================================================
//  Gemini — Extração Inteligente de Dados de Agendamento
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
 * Usa o Gemini para interpretar mensagens livres de agendamento de guincho
 * e retornar um JSON estruturado com os campos da planilha.
 *
 * @param {string} text - Texto bruto da mensagem do WhatsApp
 * @returns {Promise<object|null>} - Objeto com os campos ou null se não for agendamento
 */
async function parseWithGemini(text) {
  if (!ai) return null;

  try {
    const prompt = `Você é um assistente especializado em extrair dados de pedidos de transporte/guincho de veículos enviados em grupos de WhatsApp.
Analise a mensagem abaixo e extraia as informações.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem texto ou markdown antes ou depois) com a seguinte estrutura:
{
  "isAgendamento": true,
  "veiculo": "modelo do veículo (ex: KICKS, VERSA, HB20, TIGGO 5X, KAIT ADVANCE)",
  "cor": "cor do veículo ou string vazia",
  "chassiPlaca": "placa ou chassi do veículo ou string vazia",
  "freioEletronico": "SIM ou NÃO ou string vazia",
  "departamento": "classifique estritamente em um destes 4: NOVOS, SEMI NOVOS, FUNILARIA ou MECANICA (se não informado, use NOVOS)",
  "veiculoImobilizado": "SIM ou NÃO ou string vazia",
  "origem": "local de coleta/origem",
  "responsavelEntrega": "responsável pela entrega na origem ou string vazia",
  "destino": "local de entrega/destino",
  "responsavelRecebimento": "responsável pelo recebimento no destino ou string vazia",
  "transporte": "PLATAFORMA ou CEGONHA (padrão PLATAFORMA)",
  "agendarPara": "data agendada ou string vazia",
  "faturarPara": "concessionária/loja para emissão da nota fiscal (ex: KENTO MM, KENTO SJBV, XIAN MM, XIAN SJBV, HONDA MM, HYMAX MG, KODYVE, HZ CAMPINAS; se não explícito, deduza pela concessionária de destino ou origem)"
}

Se a mensagem NÃO tiver relação com transporte, guincho ou movimentação de veículos, retorne:
{"isAgendamento": false}

MENSAGEM:
"""
${text}
"""`;

    const models = ['gemini-3.6-flash', 'gemini-3.5-flash'];
    let responseText = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
          });
          if (res && res.text) {
            responseText = res.text;
            break;
          }
        } catch (err) {
          if (err.status === 503 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }
      }
      if (responseText) break;
    }

    if (!responseText) return null;

    // Extrai o bloco JSON da resposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.isAgendamento && !(parsed.veiculo && (parsed.origem || parsed.destino))) {
      return null;
    }

    if (!parsed.veiculo && !parsed.origem && !parsed.destino) {
      return null;
    }

    return parsed;
  } catch (err) {
    logger.debug(`Aviso ao interpretar com Gemini: ${err.message}`);
    return null;
  }
}

module.exports = { init, parseWithGemini };
