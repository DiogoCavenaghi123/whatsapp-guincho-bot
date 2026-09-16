// =============================================================
//  Gemini — Extração Inteligente de Dados de Agendamento
// =============================================================

const { GoogleGenAI, Type } = require('@google/genai');
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
 * Usa o Gemini 2.5 Flash para interpretar mensagens livres de agendamento de guincho
 * e retornar um JSON estruturado com os campos da planilha.
 *
 * @param {string} text - Texto bruto da mensagem do WhatsApp
 * @returns {Promise<object|null>} - Objeto com os campos ou null se não for agendamento
 */
async function parseWithGemini(text) {
  if (!ai) return null;

  try {
    const prompt = `Você é um assistente especializado em extrair dados de pedidos de guincho/transporte de veículos enviados em grupos de WhatsApp.
Analise a mensagem abaixo e determine se ela representa um agendamento de transporte/guincho.
Se NÃO for uma solicitação de guincho ou agendamento de transporte, defina isAgendamento como false.
Se FOR um agendamento, extraia as informações com precisão:

MENSAGEM:
"""
${text}
"""`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.6-flash'];
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isAgendamento: {
                  type: Type.BOOLEAN,
                  description: 'Verdadeiro se a mensagem for um pedido de guincho/transporte de veículo',
                },
                veiculo: { type: Type.STRING, description: 'Modelo do veículo (ex: KICKS EXCLUSIVE)' },
                cor: { type: Type.STRING, description: 'Cor do veículo' },
                chassiPlaca: { type: Type.STRING, description: 'Número do chassi ou placa' },
                freioEletronico: { type: Type.STRING, description: 'SIM ou NÃO' },
                departamento: { type: Type.STRING, description: 'Departamento solicitante' },
                veiculoImobilizado: { type: Type.STRING, description: 'SIM ou NÃO' },
                origem: { type: Type.STRING, description: 'Local de origem/coleta do veículo' },
                responsavelEntrega: { type: Type.STRING, description: 'Nome de quem vai entregar o veículo na origem' },
                destino: { type: Type.STRING, description: 'Local de destino do veículo' },
                responsavelRecebimento: { type: Type.STRING, description: 'Nome de quem vai receber o veículo no destino' },
                deptoEntrega: { type: Type.STRING, description: 'Departamento de entrega' },
                agendarPara: { type: Type.STRING, description: 'Data do agendamento (ex: 14/09/2026)' },
                faturarPara: { type: Type.STRING, description: 'Para quem deve ser faturado' },
              },
              required: ['isAgendamento'],
            },
          },
        });
        if (response && response.text) break;
      } catch (err) {
        // Tenta o próximo modelo
      }
    }

    if (!response || !response.text) return null;

    const parsed = JSON.parse(response.text);
    if (!parsed.isAgendamento) {
      return null;
    }

    // Validação mínima para garantir integridade
    if (!parsed.veiculo && !parsed.origem && !parsed.destino) {
      return null;
    }

    return parsed;
  } catch (err) {
    logger.warn('Erro ao processar com Gemini:', err.message);
    return null;
  }
}

module.exports = { init, parseWithGemini };
