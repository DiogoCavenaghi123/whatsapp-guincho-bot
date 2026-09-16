// =============================================================
//  WhatsApp — Conexão e listener de mensagens via whatsapp-web.js
// =============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('./logger');
const { parseAgendamento, toSheetRow } = require('./parser');
const sheets = require('./sheets');
const gemini = require('./gemini');
const { calculateTripDetails } = require('./distance');

/**
 * Cria e inicializa o cliente WhatsApp.
 *
 * @param {object} config
 * @param {string} config.groupId      — ID do grupo para monitorar
 * @param {string} config.spreadsheetId — ID da planilha Google Sheets
 * @param {string} config.sheetName     — nome da aba na planilha
 * @returns {Client}
 */
function createClient(config) {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
      ],
    },
  });

  // ── QR Code ────────────────────────────────────────────────
  client.on('qr', (qr) => {
    logger.info('Escaneie o QR Code abaixo com o WhatsApp:');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
    logger.info('Abra o WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo');
  });

  // ── Autenticação ───────────────────────────────────────────
  client.on('authenticated', () => {
    logger.success('WhatsApp autenticado com sucesso');
  });

  client.on('auth_failure', (msg) => {
    logger.error('Falha na autenticação:', msg);
    logger.info('Tente apagar a pasta .wwebjs_auth/ e escanear o QR code novamente');
  });

  // ── Pronto ─────────────────────────────────────────────────
  client.on('ready', async () => {
    logger.success('Bot conectado e pronto! 🚀');
    logger.info(`Monitorando grupo: ${config.groupId}`);

    // Varredura de mensagens enviadas enquanto o bot esteve desligado
    try {
      logger.info('Verificando mensagens recentes do grupo...');
      const chat = await client.getChatById(config.groupId);
      if (chat) {
        const recentMessages = await chat.fetchMessages({ limit: 30 });
        logger.info(`Analisando ${recentMessages.length} mensagens recentes do histórico...`);
        for (const msg of recentMessages) {
          try {
            await handleMessage(msg, config, true); // true = histórico, não responde no grupo
          } catch (e) {
            // Ignora falhas pontuais de mensagens do histórico
          }
        }
        logger.success('Varredura inicial concluída! Planilha atualizada.');
      }
    } catch (syncErr) {
      logger.debug(`Aviso na varredura inicial: ${syncErr.message}`);
    }

    logger.info('Aguardando mensagens de agendamento em tempo real...');
    console.log('');
    console.log('─'.repeat(60));
    console.log('  Pressione Ctrl+C para parar o bot');
    console.log('─'.repeat(60));
    console.log('');
  });

  // ── Mensagem recebida ou enviada no grupo ────────────────
  client.on('message_create', async (message) => {
    try {
      await handleMessage(message, config, false);
    } catch (err) {
      logger.error('Erro ao processar mensagem:', err.message);
    }
  });

  // ── Desconexão ─────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    logger.warn('WhatsApp desconectado:', reason);
    logger.info('Tentando reconectar...');
    client.initialize();
  });

  return client;
}

/**
 * Processa uma mensagem recebida.
 */
async function handleMessage(message, config, isHistorical = false) {
  // Ignora se não é do grupo alvo (suporta msgs recebidas e enviadas por você)
  const isFromTargetGroup = message.from === config.groupId || message.to === config.groupId;
  if (!isFromTargetGroup) return;
  const chatId = message.from === config.groupId ? message.from : message.to;

  // Ignora mensagens sem texto (imagens, áudios, stickers, etc.)
  const body = message.body;
  if (!body || body.trim().length === 0) return;

  // Ignora respostas geradas pelo próprio bot para evitar loop infinito
  if (body.includes('AGENDAMENTO REGISTRADO') || body.includes('AGENDAMENTO DUPLICADO')) {
    return;
  }

  logger.info(`[DEBUG] Mensagem recebida no grupo Agenda guincho: "${body.substring(0, 50)}..."`);

  // 1. Tenta extrair com o parser rápido (padrão de texto com rótulos)
  let agendamento = parseAgendamento(body);

  // 2. Se o formato for livre ou informal, aciona o Gemini AI
  if (!agendamento) {
    logger.info('Tentando interpretar mensagem com Gemini AI...');
    agendamento = await gemini.parseWithGemini(body);
    if (agendamento) {
      logger.success('Gemini AI identificou com sucesso o agendamento! 🤖');
    }
  }

  if (!agendamento) {
    return;
  }

  // ── Agendamento detectado! ─────────────────────────────────
  logger.bot('📋 Agendamento detectado!');
  logger.bot(`   Veículo: ${agendamento.veiculo || '-'}`);
  logger.bot(`   Origem:  ${agendamento.origem || '-'}`);
  logger.bot(`   Destino: ${agendamento.destino || '-'}`);
  if (agendamento.agendarPara) {
    logger.bot(`   Data:    ${agendamento.agendarPara}`);
  }

  // Monta dados do remetente com segurança
  let sender = message.author || message._data?.notifyName || chatId;
  try {
    const contact = await message.getContact();
    sender = contact.pushname || contact.name || sender;
  } catch (e) {
    // Caso getContact falhe no Puppeteer, usa o autor/notifyName direto
  }

  // ── Cálculo de Rota e Distância ────────────────────────────
  logger.info('Calculando rota e valor do transporte...');
  const trip = await calculateTripDetails(agendamento.origem, agendamento.destino);

  if (trip) {
    logger.success(
      `Rota calculada: ${trip.distanciaIdaKm} km (~${trip.duracaoTexto}) | Cobrado: ${trip.distanciaCobradaKm} km (${trip.valorFormatado})`
    );
  }

  // Timestamp da mensagem
  const msgDate = new Date(message.timestamp * 1000);
  const timestamp = msgDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Converte para linha da planilha e insere
  const row = toSheetRow(agendamento, timestamp, sender, trip);
  const inserted = await sheets.appendRow(
    config.spreadsheetId,
    config.sheetName,
    row
  );

  if (inserted) {
    logger.success(
      `Agendamento registrado: ${agendamento.veiculo} → ${agendamento.destino}`
    );

    // ── Resposta automática no grupo do WhatsApp (apenas para mensagens em tempo real) ──
    if (!isHistorical) {
      try {
        let replyText = `✅ *AGENDAMENTO REGISTRADO!* 🚛\n\n`;
      replyText += `🚗 *Veículo:* ${agendamento.veiculo || 'N/D'}`;
      if (agendamento.cor) replyText += ` (${agendamento.cor})`;
      replyText += `\n`;

      if (agendamento.chassiPlaca) replyText += `🔖 *Chassi / Placa:* ${agendamento.chassiPlaca}\n`;
      if (agendamento.freioEletronico) replyText += `⚡ *Freio Eletrônico:* ${agendamento.freioEletronico}\n`;
      if (agendamento.veiculoImobilizado) replyText += `🛑 *Veículo Imobilizado:* ${agendamento.veiculoImobilizado}\n`;

      replyText += `\n📍 *Origem:* ${agendamento.origem}\n`;
      if (agendamento.responsavelEntrega) replyText += `👤 *Resp. Entrega:* ${agendamento.responsavelEntrega}\n`;

      replyText += `\n🏁 *Destino:* ${agendamento.destino}\n`;
      if (agendamento.responsavelRecebimento) replyText += `🤝 *Resp. Recebimento:* ${agendamento.responsavelRecebimento}\n`;
      if (agendamento.deptoEntrega || agendamento.departamento) {
        replyText += `🏢 *Depto:* ${agendamento.deptoEntrega || agendamento.departamento}\n`;
      }

      if (agendamento.agendarPara) replyText += `📅 *Agendar Para:* ${agendamento.agendarPara}\n`;
      if (agendamento.faturarPara) replyText += `💳 *Faturar Para:* ${agendamento.faturarPara}\n`;

      if (trip) {
        replyText += `\n─────────────────────\n`;
        replyText += `📏 *Distância (ida):* ${trip.distanciaIdaKm} km\n`;
        replyText += `⏱️ *Tempo estimado:* ~${trip.duracaoTexto}\n`;
        replyText += `🔄 *Cobrança:* Ida e Volta (${trip.distanciaCobradaKm} km a R$ ${trip.valorPorKm.toFixed(2)}/km)\n`;
        replyText += `💰 *Valor Total:* *${trip.valorFormatado}*\n`;
      }

        await message.reply(replyText);
        logger.success('Resposta completa enviada no grupo do WhatsApp!');
      } catch (replyErr) {
        logger.warn(`Não foi possível responder no WhatsApp: ${replyErr.message}`);
      }
    }
  }
}

module.exports = { createClient };

