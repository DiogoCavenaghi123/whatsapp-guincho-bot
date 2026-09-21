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
    // "VEICULO:", "VEÍCULO:", "CARRO:", "MODELO:" — mas NÃO "VEÍCULO IMOBILIZADO"
    pattern: /^(?:VE[IÍ]CULO|CARRO|MODELO)\s*:?\s*(.+)/i,
  },
  {
    key: 'cor',
    pattern: /^COR\s*:?\s*(.+)/i,
  },
  {
    key: 'chassiPlaca',
    // "CHASSI:", "PLACA:", "CHASSI/PLACA:", "CHASSI/ PLACA:", "PLACAS/ CHASSIS:"
    pattern: /^(?:PLACAS?\s*\/?\s*CHASSIS?|CHASSIS?\s*\/?\s*PLACAS?|CHASSI\s*\/?\s*PLACA|CHASSIS?|PLACAS?)\s*:?\s*(.+)/i,
  },
  {
    key: 'freioEletronico',
    pattern: /^FREIO\s+ELETR[OÔ]NICO\s*:?\s*(.+)/i,
  },
  {
    key: 'veiculoImobilizado',
    pattern: /^VE[IÍ]CULO\s+IMOBILIZADO\s*:?\s*(.+)/i,
  },
  {
    key: 'deptoEntrega',
    // "DEPTO ENTREGA:" — precisa vir ANTES de "DEPARTAMENTO/DEPTO"
    pattern: /^DEPTO\s+ENTREGA\s*:?\s*(.+)/i,
  },
  {
    key: 'departamento',
    // "DEPARTAMENTO:" ou "DEPTO:" (sem "ENTREGA" depois)
    pattern: /^(?:DEPARTAMENTO|DEPTO)\s*:?\s*(.+)/i,
  },
  {
    key: 'origem',
    // "ORIGEM:", "LOCAL DE COLETA:", "COLETA:", "LOCAL DE RETIRADA:", "RETIRADA:", "DE:"
    pattern: /^(?:ORIGEM|LOCAL\s+DE\s+COLETA|LOCAL\s+DE\s+RETIRADA|LOCAL\s+DE\s+SA[IÍ]DA|COLETA|RETIRADA|SA[IÍ]DA)\s*:?\s*(.+)|^DE\s*:\s*(.+)/i,
  },
  {
    key: 'responsavelEntrega',
    // "RESPONSAVEL PELA ENTREGA:" ou "RESPONSÁVEL PELA ENTREGA:"
    pattern: /^RESPONS[AÁ]VEL\s+(?:PELA\s+)?ENTREGA\s*:?\s*(.+)/i,
  },
  {
    key: 'destino',
    // "DESTINO:", "LOCAL DE ENTREGA:", "ENTREGA:", "LOCAL DE CHEGADA:", "CHEGADA:", "PARA:"
    pattern: /^(?:DESTINO|LOCAL\s+DE\s+ENTREGA|LOCAL\s+DE\s+CHEGADA|ENTREGA|CHEGADA)\s*:?\s*(.+)|^PARA\s*:\s*(.+)/i,
  },
  {
    key: 'responsavelRecebimento',
    // "RESPONSAVEL PELO RECEBIMENTO:" ou "RESPONSÁVEL PELO RECEBIMENTO:"
    pattern: /^RESPONS[AÁ]VEL\s+(?:PELO\s+)?RECEBIMENTO\s*:?\s*(.+)/i,
  },
  {
    key: 'agendarPara',
    pattern: /^(?:AGENDAR\s+PARA|AGENDAMENTO|AGENDAR|DATA\s+DO\s+AGENDAMENTO|DATA)\s*:?\s*(.+)/i,
  },
  {
    key: 'transporte',
    pattern: /^(?:VE[IÍ]CULO\s+TRANSPORTE|TIPO\s+DE\s+TRANSPORTE|TRANSPORTE|TIPO)\s*:?\s*(.+)/i,
  },
  {
    key: 'faturarPara',
    // "FATURAR PARA:", "FATURAR:", "NOTA FISCAL:", "NF:", "EMPRESA:", "CONCESSIONARIA:"
    pattern: /^(?:FATURAR\s+(?:PARA|P\/|P)?|FATURAMENTO|NOTA\s+FISCAL|NOTA|NF|EMITIR\s+(?:NF|NOTA)(?:\s+PARA)?|EMPRESA|LOJA|CONCESSION[AÁ]RIA|RAZ[AÃ]O\s+SOCIAL|PAGANTE)\s*:?\s*(.+)/i,
  },
];

// Campos para aceitação flexível: precisa de veículo e pelo menos origem ou destino
const MIN_FIELDS_TO_ACCEPT = 2;

/**
 * Normaliza o departamento para um dos 4 oficiais da empresa:
 * NOVOS, SEMI NOVOS, FUNILARIA ou MECANICA
 *
 * @param {string} depto
 * @returns {string}
 */
function normalizeDepartment(depto) {
  if (!depto) return 'NOVOS';
  const clean = depto.trim().toUpperCase();

  if (/SEMI|USADO/i.test(clean)) return 'SEMI NOVOS';
  if (/NOVO|0\s*KM/i.test(clean)) return 'NOVOS';
  if (/FUNILARIA|PINTURA|SINISTRO/i.test(clean)) return 'FUNILARIA';
  if (/MEC[AÁ]NICA|OFICINA|REVIS[AÃ]O/i.test(clean)) return 'MECANICA';

  return clean;
}

/**
 * Identifica a concessionária / loja correspondente para emissão de Nota Fiscal.
 * Se a mensagem não trouxer explicitamente o campo FATURAR PARA,
 * deduz pela concessionária de destino ou origem conforme padrão da empresa.
 */
function resolveNotaFiscal(data) {
  const explicit = (data.faturarPara || data.notaFiscal || '').trim();
  if (explicit && explicit.length > 1) {
    return explicit.toUpperCase();
  }

  const matchDealership = (text) => {
    if (!text) return null;
    const s = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    // KENTO
    if (s.includes('KENTO')) {
      if (s.includes('SJ') || s.includes('SAO JOAO') || s.includes('BOA VISTA')) return 'KENTO SJBV';
      return 'KENTO MM';
    }

    // XIAN
    if (s.includes('XIAN')) {
      if (s.includes('SJ') || s.includes('SAO JOAO') || s.includes('BOA VISTA')) return 'XIAN SJBV';
      return 'XIAN MM';
    }

    // HONDA
    if (s.includes('HONDA')) return 'HONDA MM';

    // HYMAX
    if (s.includes('HYMAX')) return 'HYMAX MG';

    // KODYVE
    if (s.includes('KODYVE')) return 'KODYVE';

    // HAZUL CAMPINAS / HZ CAMPINAS
    if (s.includes('CAMPINAS')) return 'HZ CAMPINAS';

    // HAZUL ITAPIRA / HAZUL ITA
    if (s.includes('ITAPIRA') || s.includes('HAZUL ITA')) return 'HAZUL ITAPIRA';

    // DUETO
    if (s.includes('DUETO')) return 'DUETO MM';

    return null;
  };

  // 1. Tenta identificar pela concessionária de Destino
  const destinoMatch = matchDealership(data.destino);
  if (destinoMatch) return destinoMatch;

  // 2. Se Destino for externo (Valinhos, Andradas, Funilaria terceirizada), usa a Concessionária de Origem
  const origemMatch = matchDealership(data.origem);
  if (origemMatch) return origemMatch;

  // 3. Fallback: se não achar concessionária cadastrada, usa o texto do destino ou origem limpo
  return (data.destino || data.origem || '').trim().toUpperCase();
}

/**
 * Resolve o tipo de veículo de transporte: CEGONHA ou PLATAFORMA (padrão)
 */
function resolveTransporte(data) {
  const text = (data.transporte || '').toUpperCase();
  if (text.includes('CEGONHA')) return 'CEGONHA';
  return 'PLATAFORMA';
}

/**
 * Verifica se a mensagem é apenas ruído operacional (confirmação, aviso de motorista, etc.)
 * e não uma solicitação nova de transporte.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isOperationalNoise(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim();

  // Se tiver rótulos explícitos de agendamento, não é ruído simples
  if (/^(?:VE[IÍ]CULO|CARRO|CHASSI|PLACA)\s*:?/im.test(clean)) {
    return false;
  }

  // Avisos de motorista / guincho à disposição
  if (/(?:guincho|cegonha)\s+a\s+disposi[çc][ãa]o/i.test(clean)) {
    return true;
  }

  // Confirmações curtas de agendamento existente (ex: "Agendado 17/09", "Agendado guincho 18/09")
  if (/^agendad[oa]\s+(?:guincho|cegonha|\d{1,2}[\/\-_]\d{1,2}|para|\b)/i.test(clean) && clean.length < 80) {
    return true;
  }

  // Mensagens curtas de confirmação, agradecimento ou status
  if (/^(?:ok|fechado|confirmad[oa]|liberad[oa]|chegou|saiu|bom dia|boa tarde|boa noite|obrigad[oa]|valeu)[.!]?$/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Tenta extrair dados de agendamento de uma mensagem.
 *
 * @param {string} messageBody  — corpo da mensagem do WhatsApp
 * @returns {object|null}       — objeto com os campos extraídos, ou null
 */
function parseAgendamento(messageBody) {
  if (!messageBody || typeof messageBody !== 'string') return null;

  if (isOperationalNoise(messageBody)) {
    return null;
  }

  const lines = messageBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result = {};
  let matchedCount = 0;

  for (const rawLine of lines) {
    // Remove formatação do WhatsApp como *negrito*, _itálico_, ~tachado~ ao redor de palavras/rótulos
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

  // O modelo de veículo é ESTRITAMENTE OBRIGATÓRIO (não pode ser vazio, "-" ou menor que 2 letras)
  const veiculo = (result.veiculo || '').trim();
  if (!veiculo || veiculo === '-' || veiculo === 'N/D' || veiculo.length < 2) {
    logger.debug(`Mensagem tem ${matchedCount} campos mas não possui modelo de veículo válido`);
    return null;
  }

  // Precisa ter pelo menos um ponto de rota (origem ou destino)
  if (!result.origem && !result.destino) {
    logger.debug(`Mensagem tem ${matchedCount} campos mas não possui rota mínima`);
    return null;
  }

  logger.debug(`Campos extraídos: ${matchedCount} de ${FIELD_PATTERNS.length}`);
  return result;
}

/**
 * Converte o objeto parseado em um array ordenado para inserir na planilha
 * "CONTROLE DE TRANSPORTE CEGONHA E PLATAFORMA".
 *
 * Colunas preenchidas (A até H):
 *   A — DATA (data que a mensagem foi recebida)
 *   B — DEPARTAMENTO (NOVOS, SEMI NOVOS, FUNILARIA, MECANICA)
 *   C — CARRO
 *   D — PLACAS/ CHASSIS
 *   E — LOCAL DE COLETA
 *   F — LOCAL DE ENTREGA
 *   G — VEICULO TRANSPORTE (sempre "PLATAFORMA")
 *   H — NOTA FISCAL (faturar para)
 * As colunas restantes (I até L) não são preenchidas pelo bot.
 *
 * @param {object} data        — objeto retornado por parseAgendamento()
 * @param {Date|string} msgDate — data do recebimento da mensagem
 * @returns {string[]}         — array com os valores na ordem das colunas
 */
function toSheetRow(data, msgDate) {
  let dataFormatada = '';
  if (msgDate instanceof Date) {
    dataFormatada = msgDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } else if (typeof msgDate === 'string') {
    dataFormatada = msgDate;
  }

  const deptoNormalizado = normalizeDepartment(data.departamento || data.deptoEntrega);
  const transporte = resolveTransporte(data);
  const notaFiscal = resolveNotaFiscal(data);

  return [
    dataFormatada || '',                      // A — DATA
    deptoNormalizado || 'NOVOS',              // B — DEPARTAMENTO
    data.veiculo || '',                       // C — CARRO
    data.chassiPlaca || '',                   // D — PLACAS/ CHASSIS
    data.origem || '',                        // E — LOCAL DE COLETA
    data.destino || '',                       // F — LOCAL DE ENTREGA
    transporte,                               // G — VEICULO TRANSPORTE (PLATAFORMA ou CEGONHA)
    notaFiscal || '',                         // H — NOTA FISCAL
  ];
}

/**
 * Retorna os cabeçalhos das colunas para criar/validar a planilha.
 */
function getHeaders() {
  return [
    'DATA',
    'DEPARTAMENTO',
    'CARRO',
    'PLACAS/ CHASSIS',
    'LOCAL DE COLETA',
    'LOCAL DE ENTREGA',
    'VEICULO TRANSPORTE',
    'NOTA FISCAL',
    'CUSTO DA VIAGEM',
    'VEICULOS POR VIAGEM',
    'CUSTO UNITARIO POR VIAGEM',
    'Faturado/Não Faturado',
  ];
}

module.exports = {
  parseAgendamento,
  isOperationalNoise,
  toSheetRow,
  getHeaders,
  normalizeDepartment,
  resolveNotaFiscal,
  resolveTransporte,
};

