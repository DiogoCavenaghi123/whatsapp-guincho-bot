// =============================================================
//  Parser — Extrai campos de agendamento de guincho da mensagem
// =============================================================
//
//  Reconhece variações com/sem acento, espaços extras, etc.
//  Retorna null se a mensagem não parecer um agendamento.
// =============================================================

const logger = require('./logger');

// Cada entrada define:  chave interna  →  regex para capturar o valor
// A ordem importa: padrões mais específicos vêm antes dos genéricos
// para evitar falsos positivos (ex: "DEPTO ENTREGA" antes de "DEPARTAMENTO")
const FIELD_PATTERNS = [
  {
    key: 'veiculo',
    // "VEICULO:" ou "VEÍCULO:" — mas NÃO "VEÍCULO IMOBILIZADO"
    pattern: /^VE[IÍ]CULO\s*:\s*(.+)/i,
  },
  {
    key: 'cor',
    pattern: /^COR\s*:\s*(.+)/i,
  },
  {
    key: 'chassiPlaca',
    // "CHASSI:", "PLACA:", "CHASSI/PLACA:", "CHASSI/ PLACA:"
    pattern: /^(?:CHASSI\s*\/?\s*PLACA|CHASSI|PLACA)\s*:\s*(.+)/i,
  },
  {
    key: 'freioEletronico',
    pattern: /^FREIO\s+ELETR[OÔ]NICO\s*:\s*(.+)/i,
  },
  {
    key: 'veiculoImobilizado',
    pattern: /^VE[IÍ]CULO\s+IMOBILIZADO\s*:\s*(.+)/i,
  },
  {
    key: 'deptoEntrega',
    // "DEPTO ENTREGA:" — precisa vir ANTES de "DEPARTAMENTO/DEPTO"
    pattern: /^DEPTO\s+ENTREGA\s*:\s*(.+)/i,
  },
  {
    key: 'departamento',
    // "DEPARTAMENTO:" ou "DEPTO:" (sem "ENTREGA" depois)
    pattern: /^(?:DEPARTAMENTO|DEPTO)\s*:\s*(.+)/i,
  },
  {
    key: 'origem',
    pattern: /^ORIGEM\s*:\s*(.+)/i,
  },
  {
    key: 'responsavelEntrega',
    // "RESPONSAVEL PELA ENTREGA:" ou "RESPONSÁVEL PELA ENTREGA:"
    pattern: /^RESPONS[AÁ]VEL\s+(?:PELA\s+)?ENTREGA\s*:\s*(.+)/i,
  },
  {
    key: 'destino',
    pattern: /^DESTINO\s*:\s*(.+)/i,
  },
  {
    key: 'responsavelRecebimento',
    // "RESPONSAVEL PELO RECEBIMENTO:" ou "RESPONSÁVEL PELO RECEBIMENTO:"
    pattern: /^RESPONS[AÁ]VEL\s+(?:PELO\s+)?RECEBIMENTO\s*:\s*(.+)/i,
  },
  {
    key: 'agendarPara',
    pattern: /^AGENDAR\s+PARA\s*:\s*(.+)/i,
  },
  {
    key: 'faturarPara',
    pattern: /^FATURAR\s+PARA\s*:\s*(.+)/i,
  },
];

// Campos obrigatórios — se pelo menos N desses existirem,
// consideramos a mensagem como um agendamento válido
const REQUIRED_FIELDS = ['veiculo', 'origem', 'destino'];
const MIN_FIELDS_TO_ACCEPT = 3;

/**
 * Tenta extrair dados de agendamento de uma mensagem.
 *
 * @param {string} messageBody  — corpo da mensagem do WhatsApp
 * @returns {object|null}       — objeto com os campos extraídos, ou null
 */
function parseAgendamento(messageBody) {
  if (!messageBody || typeof messageBody !== 'string') return null;

  const lines = messageBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result = {};
  let matchedCount = 0;

  for (const rawLine of lines) {
    // Remove formatação do WhatsApp como *negrito*, _itálico_, ~tachado~ ao redor de palavras/rótulos
    // Ex: "*VEICULO* : Carro" vira "VEICULO : Carro"
    const line = rawLine.replace(/[*_~]/g, '').trim();

    for (const { key, pattern } of FIELD_PATTERNS) {
      // Pula se já extraímos esse campo (evita sobrescrita)
      if (result[key]) continue;

      const match = line.match(pattern);
      if (match) {
        // Remove também asteriscos residuais do valor extraído
        result[key] = match[1].replace(/^[*_~]+|[*_~]+$/g, '').trim();
        matchedCount++;
        break; // Próxima linha
      }
    }
  }

  // Verifica se tem campos suficientes para ser um agendamento
  if (matchedCount < MIN_FIELDS_TO_ACCEPT) {
    return null;
  }

  // Verifica campos obrigatórios
  const missingRequired = REQUIRED_FIELDS.filter((f) => !result[f]);
  if (missingRequired.length > 0) {
    logger.debug(
      `Mensagem tem ${matchedCount} campos mas faltam obrigatórios: ${missingRequired.join(', ')}`
    );
    return null;
  }

  logger.debug(`Campos extraídos: ${matchedCount} de ${FIELD_PATTERNS.length}`);
  return result;
}

/**
 * Converte o objeto parseado em um array ordenado para inserir na planilha.
 * A ordem corresponde às colunas definidas no plano (A-O).
 *
 * @param {object} data       — objeto retornado por parseAgendamento()
 * @param {string} timestamp  — data/hora da mensagem
 * @param {string} sender     — remetente da mensagem
 * @returns {string[]}        — array com os valores na ordem das colunas
 */
function toSheetRow(data, timestamp, sender, trip = null) {
  const tripKm = trip ? `${trip.distanciaIdaKm} km (Ida: ${trip.distanciaIdaKm}km | Total: ${trip.distanciaCobradaKm}km)` : '';
  const tripTime = trip ? trip.duracaoTexto : '';
  const tripPrice = trip ? trip.valorFormatado : '';

  return [
    timestamp || '',               // A — Data/Hora da mensagem
    data.veiculo || '',            // B — Veículo
    data.cor || '',                // C — Cor
    data.chassiPlaca || '',        // D — Chassi/Placa
    data.freioEletronico || '',    // E — Freio Eletrônico
    data.departamento || '',       // F — Departamento
    data.veiculoImobilizado || '', // G — Veículo Imobilizado
    data.origem || '',             // H — Origem
    data.responsavelEntrega || '', // I — Responsável Entrega
    data.destino || '',            // J — Destino
    data.responsavelRecebimento || '', // K — Responsável Recebimento
    data.deptoEntrega || '',       // L — Depto Entrega
    data.agendarPara || '',        // M — Agendar Para
    data.faturarPara || '',        // N — Faturar Para
    sender || '',                  // O — Remetente
    tripKm,                        // P — Distância
    tripTime,                      // Q — Tempo Estimado
    tripPrice,                     // R — Valor Estimado
  ];
}

/**
 * Retorna os cabeçalhos das colunas para criar/validar a planilha.
 */
function getHeaders() {
  return [
    'Data/Hora',
    'Veículo',
    'Cor',
    'Chassi/Placa',
    'Freio Eletrônico',
    'Departamento',
    'Veículo Imobilizado',
    'Origem',
    'Responsável Entrega',
    'Destino',
    'Responsável Recebimento',
    'Depto Entrega',
    'Agendar Para',
    'Faturar Para',
    'Remetente',
    'Distância',
    'Tempo Estimado',
    'Valor Estimado',
  ];
}

module.exports = { parseAgendamento, toSheetRow, getHeaders };

