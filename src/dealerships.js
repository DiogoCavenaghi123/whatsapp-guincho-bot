// =============================================================
//  Dealerships — Cadastro Oficial e Padronização de Concessionárias
//  Grupo Hazul
// =============================================================

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DEALERSHIPS = [
  // --- CODIVE CHEVROLET ---
  {
    name: 'CODIVE VALINHOS',
    brand: 'Chevrolet',
    razaoSocial: 'HZ DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '24.624.003/0002-45',
    ie: '708.121.693.110',
    address: 'Rua Campos Sales, 715, Vila São Sebastião, Valinhos - SP, 13271-000',
    city: 'Valinhos',
    cityCode: 'VALINHOS',
    state: 'SP',
    cep: '13271-000',
    phone: '19 3829-8888',
    email: 'nfe@codive.com.br',
    aliases: [
      'CODIVE VALINHOS',
      'CODIVE VAL',
      'CHEVROLET VALINHOS',
      'HZ VALINHOS',
      'CODIVE DE VALINHOS',
    ],
  },
  {
    name: 'CODIVE VINHEDO',
    brand: 'Chevrolet',
    razaoSocial: 'HZ DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '24.624.003/0003-26',
    ie: '714.075.227.110',
    address: 'Avenida Independência, 5920, São Matheus, Vinhedo - SP, 13284-400',
    city: 'Vinhedo',
    cityCode: 'VINHEDO',
    state: 'SP',
    cep: '13284-400',
    phone: '19 3836-6600',
    email: 'nfe@codive.com.br',
    aliases: [
      'CODIVE VINHEDO',
      'CODIVE VIN',
      'CHEVROLET VINHEDO',
      'HZ VINHEDO',
      'CODIVE DE VINHEDO',
    ],
  },
  {
    name: 'CODIVE DOM PEDRO',
    brand: 'Chevrolet',
    razaoSocial: 'HZ DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '24.624.003/0001-64',
    ie: '795.708.740.110',
    address: 'Rodovia Dom Pedro I, 605 KM 128, Campinas - SP, 13097-100',
    city: 'Campinas',
    cityCode: 'CAMPINAS',
    state: 'SP',
    cep: '13097-100',
    phone: '19 3399-1999',
    email: 'nfe@codive.com.br',
    aliases: [
      'CODIVE DOM PEDRO',
      'CODIVE D PEDRO',
      'CODIVE D. PEDRO',
      'CODIVE DP',
      'CODIVE CAMPINAS',
      'CODIVE CPS',
      'CHEVROLET CAMPINAS',
      'CHEVROLET DOM PEDRO',
      'HZ CAMPINAS',
      'HZ CPS',
      'CODIVE',
    ],
  },
  {
    name: 'CODIVE CASTELO',
    brand: 'Chevrolet Seminovos',
    razaoSocial: 'HZ DISTRIBUIDORA DE VEÍCULOS LTDA',
    address: 'Avenida Francisco José de Camargo Andrade, 262A, Jardim Chapadão, Campinas - SP, 13070-055',
    city: 'Campinas',
    cityCode: 'CAMPINAS',
    state: 'SP',
    cep: '13070-055',
    aliases: [
      'CODIVE CASTELO',
      'CODIVE SEMINOVOS',
      'SEMINOVOS CASTELO',
      'CASTELO CAMPINAS',
      'CODIVE CASTELO CAMPINAS',
      'SEMINOVOS CODIVE',
    ],
  },

  // --- DIVEM CITROËN / PEUGEOT ---
  {
    name: 'DIVEM MM',
    brand: 'Citroën / Peugeot',
    razaoSocial: 'DUETO DISTRIBUIDORA DE VEICULOS LTDA',
    cnpj: '45.104.355/0001-69',
    ie: '456.232.959.115',
    address: 'Rua Padre Roque, 2855, Jardim Áurea, Mogi Mirim - SP, 13800-207',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-207',
    phone: '19 3814-5000',
    email: 'nfe@divempeugeot.com.br',
    aliases: [
      'DIVEM MM',
      'DIVEM MOGI MIRIM',
      'DIVEM MOGI',
      'DIVEM PEUGEOT',
      'DIVEM CITROEN',
      'DUETO MM',
      'DUETO MOGI MIRIM',
      'DUETO MOGI',
      'DUETO DISTRIBUIDORA',
      'DUETO',
      'DIVEM',
      'PEUGEOT MM',
      'PEUGEOT MOGI',
      'CITROEN MM',
      'CITROEN MOGI',
      'PEUGEOT/CITROEN',
      'PEUGEOT / CITROEN',
      'PEUGEOT CITROEN',
    ],
  },

  // --- HYMAX HYUNDAI ---
  {
    name: 'HYMAX MG',
    brand: 'Hyundai',
    razaoSocial: 'HYMAX DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '17.348.808/0001-67',
    ie: '455.114.767.112',
    address: 'Avenida Brasil, 4615, Jardim Serra Dourada, Mogi Guaçu - SP, 13844-210',
    city: 'Mogi Guaçu',
    cityCode: 'MOGI GUAÇU',
    state: 'SP',
    cep: '13844-210',
    phone: '19 3851-5050',
    email: 'nfe@hymaxveiculos.com.br',
    aliases: [
      'HYMAX MG',
      'HYMAX MOGI GUACU',
      'HYMAX MOGI GUAÇU',
      'HYMAX GUACU',
      'HYMAX GUAÇU',
      'HYMAX',
      'HYUNDAI MOGI GUACU',
      'HYUNDAI MOGI GUAÇU',
      'HYUNDAI GUAÇU',
      'HYUNDAI MG',
    ],
  },

  // --- KENTO NISSAN ---
  {
    name: 'KENTO MM',
    brand: 'Nissan',
    razaoSocial: 'KENTO DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '15.139.569/0001-00',
    ie: '456079663119',
    address: 'Rua Padre Roque, 2222, Garcez, Mogi Mirim - SP, 13800-207',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-207',
    phone: '19 3022-8888',
    email: 'nfe@kentonissan.com.br',
    aliases: [
      'KENTO MM',
      'KENTO MOGI MIRIM',
      'KENTO MOGI',
      'KENTO',
      'NISSAN MOGI MIRIM',
      'NISSAN MOGI',
      'NISSAN MM',
    ],
  },
  {
    name: 'KENTO SJBV',
    brand: 'Nissan',
    razaoSocial: 'KENTO DISTRIBUIDORA DE VEICULOS LTDA',
    cnpj: '15.139.569/0002-90',
    ie: '639.119.680.110',
    address: 'Avenida Treze de Maio, 729, Vila Loyola, São João da Boa Vista - SP, 13874-622',
    city: 'São João da Boa Vista',
    cityCode: 'SJBV',
    state: 'SP',
    cep: '13874-622',
    phone: '19 3631-4100',
    email: 'nfe@kentonissan.com.br',
    aliases: [
      'KENTO SJBV',
      'KENTO SJ',
      'KENTO SAO JOAO',
      'KENTO SÃO JOÃO',
      'KENTO SAO JOAO DA BOA VISTA',
      'KENTO S J B V',
      'NISSAN SJBV',
      'NISSAN SJ',
      'NISSAN SAO JOAO',
      'NISSAN SÃO JOÃO',
      'NISSAN SAO JOAO DA BOA VISTA',
    ],
  },

  // --- KODYVE HONDA ---
  {
    name: 'KODYVE MM',
    brand: 'Honda',
    razaoSocial: 'HITO DISTRIBUIDORA DE VEICULOS LTDA',
    cnpj: '07.184.585/0001-96',
    ie: '456138298111',
    address: 'Rua Padre Roque, 2901, Garcez, Mogi Mirim - SP, 13800-207',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-207',
    phone: '19 3814-5500',
    email: 'nfe@kodyve.com.br',
    aliases: [
      'KODYVE MM',
      'KODYVE MOGI MIRIM',
      'KODYVE MOGI',
      'KODYVE',
      'HONDA MM',
      'HONDA MOGI MIRIM',
      'HONDA MOGI',
      'HITO',
      'HITO DISTRIBUIDORA',
    ],
  },

  // --- XIAN CAOA CHERY ---
  {
    name: 'XIAN MM',
    brand: 'Caoa Chery',
    razaoSocial: 'XIAN DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '35.981.772/0001-36',
    ie: '456203132111',
    address: 'Rua Padre Roque, 2911, Jardim Áurea, Mogi Mirim - SP, 13800-207',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-207',
    phone: '19 3814-2600',
    email: 'nfe@kodyve.com.br',
    aliases: [
      'XIAN MM',
      'XIAN MOGI MIRIM',
      'XIAN MOGI',
      'XIAN',
      'CAOA CHERY MM',
      'CAOA CHERY MOGI MIRIM',
      'CAOA CHERY MOGI',
      'CHERY MM',
      'CHERY MOGI MIRIM',
      'CHERY MOGI',
    ],
  },
  {
    name: 'XIAN SJBV',
    brand: 'Caoa Chery',
    razaoSocial: 'XIAN DISTRIBUIDORA DE VEÍCULOS LTDA',
    cnpj: '35.981.772/0002-17',
    ie: '639.181.614.113',
    address: 'Avenida Dr. Durval Nicolau, 1114, Parque Colina da Mantiqueira, São João da Boa Vista - SP, 13874-371',
    city: 'São João da Boa Vista',
    cityCode: 'SJBV',
    state: 'SP',
    cep: '13874-371',
    phone: '19 3635-2000',
    email: 'nfe@kodyve.com.br',
    aliases: [
      'XIAN SJBV',
      'XIAN SJ',
      'XIAN SAO JOAO',
      'XIAN SÃO JOÃO',
      'XIAN SAO JOAO DA BOA VISTA',
      'CAOA CHERY SJBV',
      'CAOA CHERY SJ',
      'CAOA CHERY SAO JOAO',
      'CHERY SJBV',
      'CHERY SJ',
      'CHERY SAO JOAO',
    ],
  },

  // --- SERVICE LOCADORA ---
  {
    name: 'SERVICE LOCADORA',
    brand: 'Locadora',
    razaoSocial: 'INTERCAMBIO VEICULOS LTDA.',
    cnpj: '58.776.535/0001-39',
    ie: 'ISENTO',
    address: 'Rua Luiz Gonzaga Guerreiro, 101 Fundos, Jardim Maria Beatriz, Mogi Mirim - SP, 13803-011',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13803-011',
    phone: '19 3806-4466',
    aliases: [
      'SERVICE LOCADORA',
      'SERVICE LOCADORA MM',
      'SERVICE LOCADORA MOGI',
      'SERVICE',
      'INTERCAMBIO VEICULOS',
      'INTERCÂMBIO VEÍCULOS',
    ],
  },

  // --- CODIVE ASSINATURA ---
  {
    name: 'CODIVE ASSINATURA',
    brand: 'Chevrolet Assinatura',
    razaoSocial: 'INTERCÂMBIO VEÍCULOS LTDA',
    cnpj: '58.776.535/0004-81',
    address: 'Rodovia Dom Pedro I, 605 KM 133, Campinas - SP, 13097-100',
    city: 'Campinas',
    cityCode: 'CAMPINAS',
    state: 'SP',
    cep: '13097-100',
    phone: '19 3399-1999',
    email: 'nfe@codive.com.br',
    aliases: [
      'CODIVE ASSINATURA',
      'ASSINATURA CODIVE',
      'CODIVE ASSINATURA MM',
    ],
  },

  // --- FUNILARIA EXPRESS ---
  {
    name: 'FUNILARIA EXPRESS',
    brand: 'Funilaria Express',
    razaoSocial: 'FUNILARIA E PINTURA EXPRESS',
    cnpj: '49.997.576/0001-64',
    ie: '122.980.940.119',
    address: 'Rodovia Dom Pedro I, 605 KM 128/129 Fundos, Parque Imperador, Campinas - SP, 13097-100',
    city: 'Campinas',
    cityCode: 'CAMPINAS',
    state: 'SP',
    cep: '13097-100',
    aliases: [
      'FUNILARIA EXPRESS',
      'FUNILARIA E PINTURA EXPRESS',
      'EXPRESS CAMPINAS',
      'EXPRESS CPS',
    ],
  },

  // --- PERFEITO FUNILARIA ---
  {
    name: 'PERFEITO FUNILARIA',
    brand: 'Funilaria Perfeito',
    razaoSocial: 'FUNILARIA E PINTURA SANTO EXPEDITO LTDA EPP',
    cnpj: '03.960.248/0001-92',
    ie: '374130026113',
    address: 'Rua Padre Roque, 2901, Garcez, Mogi Mirim - SP, 13800-207',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-207',
    phone: '19 3863-1000',
    email: 'nfe@perfeitofunilariaepintura.com.br',
    aliases: [
      'PERFEITO FUNILARIA',
      'PERFEITO FUNILARIA E PINTURA',
      'FUNILARIA PERFEITO',
      'SANTO EXPEDITO FUNILARIA',
      'FUNILARIA SANTO EXPEDITO',
      'PERFEITO',
    ],
  },

  // --- HAZUL REPRESENTAÇÕES ---
  {
    name: 'HAZUL POSSE',
    brand: 'Hazul Representações',
    razaoSocial: 'HAZUL REPRESENTAÇÃO S/S LTDA',
    cnpj: '08.909.290/0001-00',
    ie: 'ISENTO',
    address: 'Rua Jorge Tibiriçá, 775 A, Centro, Santo Antônio de Posse - SP, 13830-000',
    city: 'Santo Antônio de Posse',
    cityCode: 'SANTO ANTÔNIO DE POSSE',
    state: 'SP',
    cep: '13830-000',
    email: 'nfe@hazul.com.br',
    aliases: [
      'HAZUL POSSE',
      'HAZUL SANTO ANTONIO DE POSSE',
      'HAZUL SANTO ANTÔNIO DE POSSE',
      'HAZUL REPRESENTACOES',
      'HAZUL REPRESENTAÇÕES',
      'HAZUL POSSE SP',
    ],
  },

  // --- MOGI BUSINESS CENTER ---
  {
    name: 'MOGI BUSINESS CENTER',
    brand: 'Imobiliário',
    razaoSocial: 'MOGI BUSINESS CENTER EMPREENDIMENTOS IMOBILIARIO SPE LTDA',
    cnpj: '18.592.148/0001-28',
    ie: '456091219110',
    address: 'Rua Pedro Botesi, 2171, Mogi Mirim - SP, 13806-635',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13806-635',
    phone: '19 3549-4801',
    email: 'claudia@mogibusinesscenter.com.br',
    aliases: [
      'MOGI BUSINESS CENTER',
      'BUSINESS CENTER MOGI',
      'BUSINESS CENTER',
      'MBC MOGI',
      'MBC',
    ],
  },

  // --- TYREPLUS MICHELIN ---
  {
    name: 'TYREPLUS MM',
    brand: 'Tyreplus Michelin',
    razaoSocial: 'BGS COMÉRCIO PNEUS E ACESSÓRIOS LTDA.',
    cnpj: '23.016.432/0001-96',
    ie: '456.109.535.114',
    address: 'Rua Padre Roque, 1060, Centro, Mogi Mirim - SP, 13800-033',
    city: 'Mogi Mirim',
    cityCode: 'MOGI MIRIM',
    state: 'SP',
    cep: '13800-033',
    phone: '19 3549-9990',
    email: 'daniela@grupohazul.com.br',
    aliases: [
      'TYREPLUS MM',
      'TYREPLUS MOGI MIRIM',
      'TYREPLUS MOGI',
      'TYREPLUS',
      'MICHELIN MM',
      'MICHELIN MOGI MIRIM',
      'MICHELIN MOGI',
      'BGS MOGI',
      'BGS MM',
    ],
  },
  {
    name: 'TYREPLUS INDAIATUBA',
    brand: 'Tyreplus Michelin',
    razaoSocial: 'BGS COMERCIO PNEUS E ACESSORIOS LTDA.',
    cnpj: '23.016.432/0002-77',
    ie: '456.109.535.114',
    address: 'Avenida Francisco de Paula Leite, 3661, Recreio Campestre Joia, Indaiatuba - SP, 13346-615',
    city: 'Indaiatuba',
    cityCode: 'INDAIATUBA',
    state: 'SP',
    cep: '13346-615',
    phone: '19 3549-9990',
    aliases: [
      'TYREPLUS INDAIATUBA',
      'TYREPLUS INDAIA',
      'MICHELIN INDAIATUBA',
      'MICHELIN INDAIA',
      'BGS INDAIATUBA',
    ],
  },

  // --- ITAPIRA (Apoio Operacional Grupo Hazul) ---
  {
    name: 'HAZUL ITAPIRA',
    brand: 'Grupo Hazul',
    address: 'Itapira - SP',
    city: 'Itapira',
    cityCode: 'ITAPIRA',
    state: 'SP',
    aliases: [
      'HAZUL ITAPIRA',
      'HAZUL ITA',
      'HZ ITAPIRA',
      'HZ ITA',
    ],
  },
];

// Pré-computa lista de aliases ordenada do mais longo ao mais curto para correspondência precisa
const SORTED_ALIAS_MAP = [];
for (const d of DEALERSHIPS) {
  for (const alias of d.aliases) {
    SORTED_ALIAS_MAP.push({
      aliasNorm: normalizeText(alias),
      dealership: d,
    });
  }
}
// Ordenar por tamanho do alias decrescente (ex: "KENTO SJBV" ou "KENTO SJ" antes de "KENTO")
SORTED_ALIAS_MAP.sort((a, b) => b.aliasNorm.length - a.aliasNorm.length);

/**
 * Identifica a concessionária oficial a partir de qualquer string de texto.
 *
 * @param {string} text - Texto a ser analisado (ex: "kento", "kento sj", "codive valinhos", etc.)
 * @returns {object|null} - Objeto da concessionária ou null se não encontrada
 */
function identifyDealership(text) {
  if (!text || typeof text !== 'string') return null;
  const norm = normalizeText(text);
  if (!norm) return null;

  for (const item of SORTED_ALIAS_MAP) {
    const pattern = new RegExp(`(^|\\b)${item.aliasNorm}(\\b|$)`, 'i');
    if (pattern.test(norm)) {
      return item.dealership;
    }
  }

  return null;
}

/**
 * Retorna o nome padronizado da concessionária ou o próprio texto caso não encontre.
 * Exemplo:
 *   "kento" -> "KENTO MM"
 *   "kento mm" -> "KENTO MM"
 *   "kento sj" -> "KENTO SJBV"
 *   "kento sjbv" -> "KENTO SJBV"
 *
 * @param {string} text
 * @param {string} [fallback]
 * @returns {string}
 */
function standardizeDealershipName(text, fallback = null) {
  const d = identifyDealership(text);
  if (d) return d.name;
  return fallback !== null ? fallback : (text || '').trim().toUpperCase();
}

/**
 * Obtém o endereço físico completo para cálculo de rotas e distâncias.
 *
 * @param {string} text
 * @returns {string|null}
 */
function getDealershipAddress(text) {
  const d = identifyDealership(text);
  return d ? d.address : null;
}

/**
 * Obtém a cidade ou código de cidade da concessionária para cálculo de tabelas.
 *
 * @param {string} text
 * @returns {string|null}
 */
function getDealershipCity(text) {
  const d = identifyDealership(text);
  return d ? d.cityCode || d.city : null;
}

/**
 * Retorna todas as concessionárias cadastradas.
 */
function getAllDealerships() {
  return DEALERSHIPS;
}

module.exports = {
  DEALERSHIPS,
  identifyDealership,
  standardizeDealershipName,
  getDealershipAddress,
  getDealershipCity,
  getAllDealerships,
  normalizeText,
};

