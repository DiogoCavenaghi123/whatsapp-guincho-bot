// =============================================================
//  Distance — Cálculo de rota, distância e precificação
// =============================================================

const logger = require('./logger');
const { GoogleGenAI, Type } = require('@google/genai');

let ai = null;

function getAI() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap)
 */
async function geocode(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WhatsAppGuinchoBot/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (err) {
    logger.debug(`Erro no geocode Nominatim: ${err.message}`);
  }
  return null;
}

/**
 * Calcula rota via OSRM rodoviário
 */
async function getOSRMRoute(originCoord, destCoord) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoord.lon},${originCoord.lat};${destCoord.lon},${destCoord.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10; // ex: 45.2 km
      const durationMin = Math.round(route.duration / 60);
      const hours = Math.floor(durationMin / 60);
      const mins = durationMin % 60;
      const durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
      return { distanceKm, durationText };
    }
  } catch (err) {
    logger.debug(`Erro OSRM: ${err.message}`);
  }
  return null;
}

const dealerships = require('./dealerships');

// Dicionário de locais conhecidos da operação para máxima precisão
const KNOWN_PLACES = [
  { match: /kento\s+mogi/i, replace: 'Kento Toyota, Mogi Mirim - SP' },
  { match: /autolink\s+po[cç]os/i, replace: 'Poços de Caldas - MG' },
  { match: /nova\s+via\s+motors/i, replace: 'Andradas - MG' },
];

function normalizeAddress(addr) {
  if (!addr) return '';
  let clean = addr.trim();

  // Se corresponder a uma concessionária/loja oficial do Grupo Hazul,
  // utiliza o endereço físico exato da unidade para cálculo de rota
  const dealershipAddr = dealerships.getDealershipAddress(clean);
  if (dealershipAddr) {
    return dealershipAddr;
  }

  for (const kp of KNOWN_PLACES) {
    if (kp.match.test(clean)) {
      clean = clean.replace(kp.match, kp.replace);
      break;
    }
  }
  return clean;
}

/**
 * Fallback usando Gemini AI para estimar distância rodoviária
 */
async function calculateViaGemini(origin, destination) {
  const client = getAI();
  if (!client) return null;

  try {
    const prompt = `Você é um calculador de rotas e distâncias rodoviárias do Brasil com foco na região da Baixa Mogiana, Leste Paulista e Sul de Minas Gerais (cidades como Poços de Caldas, Andradas, São João da Boa Vista, Mogi Mirim, Mogi Guaçu, Campinas, etc.).

IMPORTANTE: Se o destino ou origem mencionar apenas "Mogi" (como Kento Mogi ou Mogi), trata-se de MOGI MIRIM / MOGI GUAÇU - SP, NUNCA Mogi das Cruzes.

Calcule a distância rodoviária real mais curta/comum e o tempo de viagem entre:
Origem: "${origin}"
Destino: "${destination}"

Responda em JSON com distanceKm (número de KM só de ida com 1 decimal) e durationText (ex: "1h 35min").`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.6-flash'];
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                distanceKm: { type: Type.NUMBER, description: 'Distância rodoviária em km (apenas ida)' },
                durationText: { type: Type.STRING, description: 'Tempo estimado de viagem' },
              },
              required: ['distanceKm', 'durationText'],
            },
          },
        });
        if (response && response.text) break;
      } catch (modelErr) {
        // Tenta o próximo modelo
      }
    }

    if (!response || !response.text) return null;

    const parsed = JSON.parse(response.text);
    if (parsed.distanceKm && parsed.distanceKm > 0) {
      return {
        distanceKm: Math.round(parsed.distanceKm * 10) / 10,
        durationText: parsed.durationText || 'N/D',
      };
    }
  } catch (err) {
    logger.debug(`Erro ao calcular distância via Gemini: ${err.message}`);
  }
  return null;
}

/**
 * Calcula a distância, tempo e preço final do frete
 *
 * @param {string} origin - Endereço ou cidade de origem
 * @param {string} destination - Endereço ou cidade de destino
 * @returns {Promise<object|null>}
 */
async function calculateTripDetails(origin, destination) {
  if (!origin || !destination) return null;

  const cleanOrigin = normalizeAddress(origin);
  const cleanDestination = normalizeAddress(destination);

  const valorKm = parseFloat(process.env.VALOR_POR_KM || '7.00');
  const calcularIdaEVolta = (process.env.CALCULAR_IDA_E_VOLTA || 'true').toLowerCase() === 'true';

  let route = null;

  // 1. Tenta calcular via OSRM / OpenStreetMap
  try {
    const [c1, c2] = await Promise.all([geocode(cleanOrigin), geocode(cleanDestination)]);
    if (c1 && c2) {
      route = await getOSRMRoute(c1, c2);
    }
  } catch (e) {
    // Silently continue to Gemini fallback
  }

  // 2. Se OSRM não encontrar ou der timeout, aciona o Gemini AI como fallback
  if (!route) {
    logger.info('Calculando rota rodoviária com auxílio do Gemini AI...');
    route = await calculateViaGemini(cleanOrigin, cleanDestination);
  }

  if (!route) {
    logger.warn(`Não foi possível calcular a distância entre "${origin}" e "${destination}".`);
    return null;
  }

  const distanciaIdaKm = route.distanceKm;
  const distanciaCobradaKm = calcularIdaEVolta ? Math.round(distanciaIdaKm * 2 * 10) / 10 : distanciaIdaKm;
  const valorTotal = Math.round(distanciaCobradaKm * valorKm * 100) / 100;

  const valorFormatado = valorTotal.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return {
    distanciaIdaKm,
    distanciaCobradaKm,
    duracaoTexto: route.durationText,
    valorPorKm: valorKm,
    isIdaEVolta: calcularIdaEVolta,
    valorTotal,
    valorFormatado,
  };
}

module.exports = { calculateTripDetails };
// Matriz de distâncias rodoviárias reais (apenas ida) entre as bases operacionais do Grupo Hazul
const HIGHWAY_DISTANCE_MATRIX = {
  'MOGI MIRIM|MOGI GUAÇU': 14,
  'MOGI MIRIM|CAMPINAS': 68,
  'MOGI MIRIM|VALINHOS': 76,
  'MOGI MIRIM|VINHEDO': 84,
  'MOGI MIRIM|SJBV': 72,
  'MOGI MIRIM|SANTO ANTÔNIO DE POSSE': 22,
  'MOGI MIRIM|ITAPIRA': 32,
  'MOGI MIRIM|INDAIATUBA': 92,
  'MOGI MIRIM|POÇOS DE CALDAS': 105,
  'MOGI MIRIM|ANDRADAS': 80,

  'MOGI GUAÇU|CAMPINAS': 75,
  'MOGI GUAÇU|VALINHOS': 82,
  'MOGI GUAÇU|VINHEDO': 90,
  'MOGI GUAÇU|SJBV': 62,
  'MOGI GUAÇU|SANTO ANTÔNIO DE POSSE': 30,
  'MOGI GUAÇU|ITAPIRA': 38,
  'MOGI GUAÇU|INDAIATUBA': 98,
  'MOGI GUAÇU|POÇOS DE CALDAS': 95,
  'MOGI GUAÇU|ANDRADAS': 70,

  'CAMPINAS|VALINHOS': 14,
  'CAMPINAS|VINHEDO': 22,
  'CAMPINAS|SJBV': 138,
  'CAMPINAS|SANTO ANTÔNIO DE POSSE': 52,
  'CAMPINAS|ITAPIRA': 75,
  'CAMPINAS|INDAIATUBA': 28,

  'VALINHOS|VINHEDO': 10,
  'VALINHOS|SJBV': 145,
  'VALINHOS|INDAIATUBA': 32,

  'VINHEDO|SJBV': 152,
  'VINHEDO|INDAIATUBA': 25,

  'SJBV|POÇOS DE CALDAS': 38,
  'SJBV|ANDRADAS': 35,
  'SJBV|SANTO ANTÔNIO DE POSSE': 88,
  'SJBV|ITAPIRA': 78,
  'SJBV|INDAIATUBA': 160,
};

function resolveCityName(place) {
  if (!place) return '';
  const d = dealerships.identifyDealership(place);
  if (d && d.cityCode) return d.cityCode;
  if (d && d.city) {
    const norm = d.city.toUpperCase();
    if (norm.includes('SAO JOAO') || norm.includes('SÃO JOÃO')) return 'SJBV';
    return norm;
  }
  const u = String(place).toUpperCase();
  if (u.includes('VALINHOS') || u.includes('VAL')) return 'VALINHOS';
  if (u.includes('VINHEDO') || u.includes('VIN')) return 'VINHEDO';
  if (u.includes('DOM PEDRO') || u.includes('CASTELO') || u.includes('CAMPINAS') || u.includes('CPS') || u.includes('ASSINATURA') || u.includes('EXPRESS')) return 'CAMPINAS';
  if (u.includes('SAO JOAO') || u.includes('SÃO JOÃO') || u.includes('SJBV') || u.includes('SJ')) return 'SJBV';
  if (u.includes('MOGI GUACU') || u.includes('MOGI GUAÇU') || u.includes('GUACU') || u.includes('GUAÇU') || u.includes('HYMAX') || u.includes('MG')) return 'MOGI GUAÇU';
  if (u.includes('POSSE')) return 'SANTO ANTÔNIO DE POSSE';
  if (u.includes('INDAIATUBA') || u.includes('INDAIA')) return 'INDAIATUBA';
  if (u.includes('ITAPIRA') || u.includes('ITA')) return 'ITAPIRA';
  if (u.includes('POCOS') || u.includes('POÇOS')) return 'POÇOS DE CALDAS';
  if (u.includes('ANDRADAS')) return 'ANDRADAS';
  if (u.includes('MOGI') || u.includes('MM') || u.includes('DIVEM') || u.includes('KENTO') || u.includes('KODYVE') || u.includes('XIAN') || u.includes('SERVICE') || u.includes('PERFEITO') || u.includes('TYREPLUS')) return 'MOGI MIRIM';
  return u.trim();
}

/**
 * Retorna a distância rodoviária calculada em KM entre duas concessionárias ou cidades.
 *
 * @param {string} origin
 * @param {string} destination
 * @returns {{ distanceKm: number, distanceRoundTripKm: number, distanceText: string, originCity: string, destCity: string }}
 */
function getHighwayDistance(origin, destination) {
  const c1 = resolveCityName(origin);
  const c2 = resolveCityName(destination);

  if (!c1 || !c2) {
    return {
      distanceKm: 0,
      distanceRoundTripKm: 0,
      distanceText: '-- km',
      originCity: c1 || 'Origem',
      destCity: c2 || 'Destino',
    };
  }

  if (c1 === c2) {
    return {
      distanceKm: 8,
      distanceRoundTripKm: 16,
      distanceText: '8 km (trajeto local)',
      originCity: c1,
      destCity: c2,
    };
  }

  const key1 = `${c1}|${c2}`;
  const key2 = `${c2}|${c1}`;
  let km = HIGHWAY_DISTANCE_MATRIX[key1] || HIGHWAY_DISTANCE_MATRIX[key2];

  if (!km) {
    km = 45; // Estimativa média intermunicipal regional
  }

  return {
    distanceKm: km,
    distanceRoundTripKm: km * 2,
    distanceText: `${km} km (ida) / ${km * 2} km (ida e volta)`,
    originCity: c1,
    destCity: c2,
  };
}

module.exports = {
  calculateTripDetails,
  getHighwayDistance,
  resolveCityName,
};


