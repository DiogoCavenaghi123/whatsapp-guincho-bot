// =============================================================
//  WhatsApp — Conexão e listener de mensagens via whatsapp-web.js
//  WhatsApp — Conexão, listeners, varredura e histórico
// =============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Message = require('whatsapp-web.js/src/structures/Message');
const qrcode = require('qrcode-terminal');
const logger = require('./logger');
const { parseAgendamento, toSheetRow, resolveNotaFiscal, isOperationalNoise } = require('./parser');
const sheets = require('./sheets');
const gemini = require('./gemini');
const history = require('./history');
const settings = require('./settings');

let activeClient = null;
let activeConfig = null;
let isScanning = false;

// Buffer deslizante das mensagens recentes para contexto da IA
const recentMessagesBuffer = [];
const MAX_RECENT_BUFFER = 6;

function pushRecentMessage(author, text) {
  if (!text || text.length < 2) return;
  recentMessagesBuffer.push(`[${author || 'Grupo'}]: ${text.trim().substring(0, 200)}`);
  if (recentMessagesBuffer.length > MAX_RECENT_BUFFER) {
    recentMessagesBuffer.shift();
  }
}

function getRecentContext() {
  return recentMessagesBuffer.join('\n');
}

/**
 * Limpa processos órfãos do Chromium e remove arquivos de lock remanescentes
 * de sessões anteriores que possam ter sido encerradas incorretamente.
 */
function cleanupStaleBrowserSession() {
  const sessionDir = path.resolve(__dirname, '../.wwebjs_auth/session');

  // 1. Mata processos chrome órfãos usando o diretório de autenticação do bot (no Windows)
  if (process.platform === 'win32') {
    try {
      const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name LIKE '%chrome%'\\" | Where-Object { $_.CommandLine -like '*wwebjs_auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
      execSync(psCmd, { stdio: 'ignore', timeout: 5000 });
    } catch (_) {}
  }

  // 2. Remove arquivos de lock conhecidos do Chromium
  if (fs.existsSync(sessionDir)) {
    const lockFiles = [
      'lockfile',
      'DevToolsActivePort',
      'SingletonLock',
      'SingletonCookie',
      'SingletonSocket',
    ];

    for (const file of lockFiles) {
      const fullPath = path.join(sessionDir, file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          logger.debug(`Arquivo de lock órfão removido: ${file}`);
        }
      } catch (_) {}
    }
  }
}

/**
 * Cria e inicializa o cliente WhatsApp.
 *
 * @param {object} config
 * @param {string} config.groupId      — ID do grupo para monitorar
 * @param {string} config.groupId       — ID do grupo para monitorar
 * @param {string} config.spreadsheetId — ID da planilha Google Sheets
 * @param {string} config.sheetName     — nome da aba na planilha
 * @param {string} [config.sheetName]   — nome da aba na planilha
 * @returns {Client}
 */
function createClient(config) {
  activeConfig = config;

  // Garante limpeza preventiva antes de instanciar o browser
  cleanupStaleBrowserSession();

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

  activeClient = client;

  // ── Carregando WhatsApp ────────────────────────────────────
  client.on('loading_screen', (percent, message) => {
    logger.info(`Carregando WhatsApp: ${percent}%...`);
  });

  // ── QR Code ────────────────────────────────────────────────
  client.on('qr', (qr) => {
    logger.info('Escaneie o QR Code abaixo com o WhatsApp do celular:');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
    logger.info('Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar um aparelho');
  });

  // ── Autenticação ───────────────────────────────────────────
  client.on('authenticated', () => {
    logger.success('WhatsApp autenticado com sucesso!');
  });

  client.on('auth_failure', (msg) => {
    logger.error('Falha na autenticação do WhatsApp:', msg);
  });

  // ── Pronto para uso ────────────────────────────────────────
  let scanStarted = false;
  client.on('ready', async () => {
    logger.success('Bot conectado ao WhatsApp e pronto! 🚀');
    logger.info(`Monitorando grupo: ${config.groupId}`);

    if (scanStarted) {
      logger.debug('Varredura inicial já foi disparada anteriormente, ignorando evento duplicado.');
      return;
    }
    scanStarted = true;

    // Aguarda sincronização do WhatsApp Web
    // Aguarda sincronização inicial do WhatsApp Web
    logger.info('Aguardando sincronização inicial das conversas (5 segundos)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Varredura de mensagens enviadas desde o início do ciclo atual (24/08 em diante)
    try {
      logger.info('Iniciando varredura do histórico do grupo...');
      // Data de corte: 24 de Agosto de 2026 (início do ciclo de faturamento atual)
      const cutoffDate = new Date(2026, 7, 24, 0, 0, 0);
      const recentMessages = await fetchGroupMessagesSafely(client, config.groupId, cutoffDate);
    // Executa varredura inicial padrão
    await scanGroupMessages();

      const cycleMessages = recentMessages
        .filter((msg) => {
          const msgDate = new Date(msg.timestamp * 1000);
          return msgDate >= cutoffDate;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      logger.info(
        `Histórico: ${cycleMessages.length} mensagens encontradas desde 24/08/2026 para análise.`
      );

      let foundCount = 0;
      let insertedCount = 0;
      let duplicateCount = 0;

      for (const msg of cycleMessages) {
        try {
          const res = await handleMessage(msg, config, true); // true = histórico, não responde no grupo
          if (res && res.isAgendamento) {
            foundCount++;
            if (res.inserted) {
              insertedCount++;
            } else {
              duplicateCount++;
            }
          }
        } catch (e) {
          logger.warn(`Erro ao processar mensagem do histórico: ${e.message}`);
        }
        // Intervalo de 600ms para evitar estourar cota do Google Sheets e Gemini
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      logger.success(
        `Varredura concluída! ${foundCount} agendamento(s) identificado(s): ${insertedCount} novo(s) cadastrado(s) na planilha e ${duplicateCount} já existente(s).`
      );
    } catch (syncErr) {
      logger.warn(`Aviso na varredura inicial: ${syncErr.message || syncErr}`);
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
 * Busca mensagens do grupo com estratégia resiliente de paginação até a data de corte
 * Executa a varredura do grupo a partir de uma data de corte.
 *
 * @param {Client} client
 * @param {string} groupId
 * @param {Date}   cutoffDate
 * @returns {Promise<Array<Message>>}
 * @param {Date} [customCutoffDate]
 * @returns {Promise<{ foundCount: number, insertedCount: number, duplicateCount: number, discardedCount: number }>}
 */
async function scanGroupMessages(customCutoffDate = null) {
  if (!activeClient || !activeConfig) {
    logger.warn('Cliente WhatsApp ainda não está pronto para varredura.');
    return { foundCount: 0, insertedCount: 0, duplicateCount: 0, discardedCount: 0 };
  }

  if (isScanning) {
    logger.warn('Já existe uma varredura em andamento. Aguarde o término.');
    return { foundCount: 0, insertedCount: 0, duplicateCount: 0, discardedCount: 0 };
  }

  isScanning = true;

  try {
    // Se especificada como string, converte preservando fuso horário local
    let cutoffDate = customCutoffDate;
    if (typeof cutoffDate === 'string') {
      const parts = cutoffDate.split(/[-/]/).map(Number);
      if (parts.length === 3 && parts[0] > 1000) {
        cutoffDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      } else {
        cutoffDate = new Date(cutoffDate);
      }
    }

    // Se não especificada ou inválida, calcula o início do ciclo atual (dia 24 do mês correspondente)
    if (!cutoffDate || isNaN(cutoffDate.getTime())) {
      const now = new Date();
      if (now.getDate() >= 24) {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 24, 0, 0, 0);
      } else {
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 24, 0, 0, 0);
      }
    }

    const cutoffStr = cutoffDate.toLocaleDateString('pt-BR');
    logger.info(`Iniciando varredura das mensagens do grupo desde ${cutoffStr}...`);

    const recentMessages = await fetchGroupMessagesSafely(activeClient, activeConfig.groupId, cutoffDate);

    const cycleMessages = recentMessages
      .filter((msg) => {
        const msgDate = new Date(msg.timestamp * 1000);
        return msgDate >= cutoffDate;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    logger.info(`Histórico: ${cycleMessages.length} mensagens encontradas desde ${cutoffStr} para análise.`);

    let foundCount = 0;
    let insertedCount = 0;
    let duplicateCount = 0;
    let discardedCount = 0;

    for (const msg of cycleMessages) {
      try {
        const res = await handleMessage(msg, activeConfig, true); // true = histórico
        if (res && res.isAgendamento) {
          foundCount++;
          if (res.inserted) {
            insertedCount++;
          } else {
            duplicateCount++;
          }
        } else {
          discardedCount++;
        }
      } catch (e) {
        logger.warn(`Erro ao processar mensagem do histórico: ${e.message}`);
      }
      // Pacing para respeitar cotas de requisição da API
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    logger.success(
      `Varredura concluída! ${foundCount} agendamento(s) identificado(s): ${insertedCount} novo(s), ${duplicateCount} já existente(s) e ${discardedCount} descartada(s).`
    );

    return { foundCount, insertedCount, duplicateCount, discardedCount };
  } catch (err) {
    logger.warn(`Aviso na varredura: ${err.message}`);
    return { foundCount: 0, insertedCount: 0, duplicateCount: 0, discardedCount: 0 };
  } finally {
    isScanning = false;
  }
}

/**
 * Busca mensagens do grupo com estratégia resiliente de paginação até a data de corte
 */
async function fetchGroupMessagesSafely(client, groupId, cutoffDate) {
  const cutoffTs = Math.floor(cutoffDate.getTime() / 1000);

  // 1. Abre a janela do chat no WhatsApp Web para ativar e renderizar o histórico
  try {
    if (client.interface && typeof client.interface.openChatWindow === 'function') {
      logger.info('Abrindo grupo no WhatsApp Web para sincronizar conversas...');
      await client.interface.openChatWindow(groupId);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } catch (err) {
    logger.debug(`openChatWindow aviso: ${err.message}`);
  }

  // 2. Rolagem ativa de histórico no WhatsApp Web com intervalo entre requisições
  try {
    logger.info(`Carregando mensagens anteriores do grupo (desde ${cutoffDate.toLocaleDateString('pt-BR')})...`);
    await client.pupPage.evaluate(async (chatId, cutoffTimestamp) => {
      const chatWid = window.require('WAWebWidFactory').createWid(chatId);
      const chat =
        window.require('WAWebCollections').Chat.get(chatWid) ||
        (await window.require('WAWebFindChatAction').findOrCreateLatestChat(chatWid))?.chat;

      if (!chat || !chat.msgs) return;

      const loader = window.require('WAWebChatLoadMessages');

      for (let i = 0; i < 40; i++) {
        const models = chat.msgs.getModelsArray ? chat.msgs.getModelsArray() : chat.msgs;
        const oldestMsg = models && models.length > 0 ? models[0] : null;
        if (oldestMsg && oldestMsg.t <= cutoffTimestamp) {
          break;
        }

        try {
          if (loader && typeof loader.loadEarlierMsgs === 'function') {
            await loader.loadEarlierMsgs({ chat });
          }
        } catch (e) {}

        // Simula rolagem no contêiner de mensagens
        const pane = document.querySelector('div[role="application"] [tabindex="-1"]');
        if (pane) pane.scrollTop = 0;

        await new Promise((r) => setTimeout(r, 600));
      }
    }, groupId, cutoffTs);
  } catch (err) {
    logger.debug(`Aviso na rolagem de histórico: ${err.message}`);
  }

  // 3. Extrai todas as mensagens acumuladas no chat
  try {
    const rawMsgs = await client.pupPage.evaluate((chatId) => {
      const chatWid = window.require('WAWebWidFactory').createWid(chatId);
      const chat =
        window.require('WAWebCollections').Chat.get(chatWid) ||
        (window.require('WAWebFindChatAction')?.findOrCreateLatestChat(chatWid))?.chat;

      if (!chat || !chat.msgs) return [];

      return chat.msgs
        .getModelsArray()
        .filter((m) => !m.isNotification)
        .sort((a, b) => (a.t > b.t ? 1 : -1))
        .map((m) => window.WWebJS.getMessageModel(m));
    }, groupId);

    if (rawMsgs && rawMsgs.length > 0) {
      logger.info(`Total de ${rawMsgs.length} mensagens recuperadas no grupo.`);
      return rawMsgs.map((m) => new Message(client, m));
    }
  } catch (err) {
    logger.debug(`Extração direta falhou, usando chat.fetchMessages: ${err.message}`);
  }

  // 4. Fallback padrão via fetchMessages
  try {
    const chat = await client.getChatById(groupId);
    if (chat && typeof chat.fetchMessages === 'function') {
      const msgs = await chat.fetchMessages({ limit: 400 });
      if (msgs && msgs.length > 0) {
        logger.info(`Fallback: ${msgs.length} mensagens recuperadas.`);
        return msgs;
      }
    }
  } catch (err) {
    logger.warn(`Aviso no fallback de leitura: ${err.message}`);
  }

  return [];
}

/**
 * Processa uma mensagem recebida.
 */
async function handleMessage(message, config, isHistorical = false) {
  // Ignora se não é do grupo alvo (suporta msgs recebidas e enviadas por você)
  const remote = message.id?.remote?._serialized || message.id?.remote || '';
  const isFromTargetGroup =
    isHistorical ||
    message.from === config.groupId ||
    message.to === config.groupId ||
    remote === config.groupId;

  if (!isFromTargetGroup) return;
  if (!isFromTargetGroup) return { isAgendamento: false };
  const chatId = message.from === config.groupId ? message.from : message.to;

  // Ignora mensagens sem texto (imagens, áudios, stickers, etc.)
  const body = message.body;
  if (!body || body.trim().length === 0) return;
  if (!body || body.trim().length === 0) return { isAgendamento: false };

  // Ignora respostas geradas pelo próprio bot para evitar loop infinito
  if (body.includes('AGENDAMENTO REGISTRADO') || body.includes('AGENDAMENTO DUPLICADO')) {
    return;
    return { isAgendamento: false };
  }

  const msgId = message.id?._serialized || message.id?.id || String(message.timestamp);
  const msgDate = new Date(message.timestamp * 1000);

  // Monta identificação do remetente
  let sender = message.author || message._data?.notifyName || chatId;
  if (!isHistorical) {
    try {
      const contact = await message.getContact();
      sender = contact.pushname || contact.name || sender;
    } catch (e) {}
  }

  logger.info(`[DEBUG] Mensagem recebida no grupo Agenda guincho: "${body.substring(0, 50)}..."`);

  // 1. Tenta extrair com o parser rápido (padrão de texto com rótulos)
  // 1. Contexto recente para IA
  const recentContext = getRecentContext();
  pushRecentMessage(sender, body);

  // 1. Pré-Filtro: Se for ruído operacional (confirmação simples, aviso de guincho livre, etc.)
  if (isOperationalNoise(body)) {
    history.recordMessage({
      messageId: msgId,
      timestamp: msgDate,
      author: sender,
      body,
      status: 'DESCARTADO',
      status: 'AVISO_OPERACIONAL',
      reason: 'Aviso operacional ou confirmação simples (sem pedido de transporte)',
    });
    logger.debug(`Mensagem descartada pelo pré-filtro de ruído operacional.`);
    return { isAgendamento: false };
  }

  // 2. Parser Regex Rápido
  let agendamento = parseAgendamento(body);

  // 2. Se o formato for livre ou informal, aciona o Gemini AI
  // 3. Fallback inteligente com Google Gemini AI
  // 3. Fallback com Classificador Gemini AI (com contexto e data)
  let classification = null;
  if (!agendamento) {
    logger.info('Tentando interpretar mensagem com Gemini AI...');
    logger.info('Interpretando mensagem com Gemini AI...');
    agendamento = await gemini.parseWithGemini(body);
    if (agendamento) {
    const dataAtual = msgDate ? new Date(msgDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    classification = await gemini.classifyWithGemini(body, {
      contextoMensagens: recentContext,
      dataAtual,
    });

    if (classification && classification.isAgendamento === true) {
      agendamento = classification;
      logger.success('Gemini AI identificou com sucesso o agendamento! 🤖');
    }
  }

  // Se não foi identificado como agendamento
  if (!agendamento) {
<<<<<<< HEAD
    return;
=======
    // Caso especial: Solicitação de viagem operacional para aprovação humana no painel
    if (classification && (classification.tipoMensagem === 'SOLICITACAO_VIAGEM' || classification.necessitaAprovacao === true)) {
      logger.info(`📋 Viagem operacional identificada ("${body.substring(0, 50)}..."). Enviada para Fila de Aprovação no Painel de Controle!`);
      history.recordMessage({
        messageId: msgId,
        timestamp: msgDate,
        author: sender,
        body,
        status: 'PENDENTE_APROVACAO',
        reason: classification.motivo || 'Ordem de transporte operacional aguardando decisão no painel',
        extractedData: classification,
      });
      return { isAgendamento: false, requiresApproval: true };
    }

>>>>>>> e16184e (feat: adiciona aba de transparencia, padronizacao de concessionarias, controle de respostas e app desktop)
    const statusType = classification ? (classification.tipoMensagem || 'DESCARTADO') : 'DESCARTADO';
    const reasonText = classification
      ? (classification.motivo || classification.motivoRevisao || classification.tipoMensagem)
      : 'Conversa ou texto sem veículo/rota identificados';

    if (classification && classification.tipoMensagem === 'ALTERACAO') {
      logger.warn(`[ALTERAÇÃO] Solicitada mudança no transporte: ${classification.veiculo || ''} (${classification.campoAlterado || ''} -> ${classification.novoValor || ''})`);
    } else if (classification && classification.tipoMensagem === 'CANCELAMENTO') {
      logger.warn(`[CANCELAMENTO] Solicitado cancelamento de transporte: ${classification.veiculo || classification.chassiPlaca || ''}`);
    }

    history.recordMessage({
      messageId: msgId,
      timestamp: msgDate,
      author: sender,
      body,
      status: 'DESCARTADO',
      reason: 'Conversa ou texto sem veículo/rota identificados',
      status: statusType,
      reason: reasonText,
      extractedData: classification || null,
    });
    return { isAgendamento: false };
  }

  // ── Agendamento detectado! ─────────────────────────────────
  // ── VALIDAÇÃO ESTRITA DE VEÍCULO ────────────────────────────
  // Se não houver modelo de veículo claro, JAMAIS insere na planilha!
  const veiculoLimpo = (agendamento.veiculo || '').trim();
  if (!veiculoLimpo || veiculoLimpo === '-' || veiculoLimpo === 'N/D' || veiculoLimpo.length < 2) {
    history.recordMessage({
      messageId: msgId,
      timestamp: msgDate,
      author: sender,
      body,
      status: 'DESCARTADO',
      reason: 'Rejeitado: modelo do veículo não informado ou inválido',
      extractedData: agendamento,
    });
    logger.warn('Agendamento rejeitado: modelo do veículo não informado ou inválido.');
    return { isAgendamento: false };
  }

  // ── Agendamento legítimo detectado! ─────────────────────────
  logger.bot('📋 Agendamento detectado!');
  logger.bot(`   Veículo: ${agendamento.veiculo}`);
  logger.bot(`   Origem:  ${agendamento.origem || '-'}`);
  logger.bot(`   Destino: ${agendamento.destino || '-'}`);
  if (agendamento.agendarPara) {
    logger.bot(`   Data:    ${agendamento.agendarPara}`);
  }

  // Converte para linha da planilha e tenta inserir
  const row = toSheetRow(agendamento, msgDate);
  const inserted = await sheets.appendRow(config.spreadsheetId, row, msgDate);

  if (inserted) {
    logger.success(`Agendamento registrado: ${agendamento.veiculo} → ${agendamento.destino}`);

    // Registra no histórico com status AGENDAMENTO
    history.recordMessage({
      messageId: msgId,
      timestamp: msgDate,
      author: sender,
      body,
      status: 'AGENDAMENTO',
      reason: 'Agendamento cadastrado com sucesso na planilha',
      extractedData: agendamento,
    });

    // Resposta no WhatsApp apenas para mensagens em tempo real (se habilitado nas configurações)
    if (!isHistorical) {
      if (!settings.isGroupRepliesEnabled()) {
        logger.info('Envio de resposta no WhatsApp desativado pelo Painel (modo silencioso ativo).');
      } else {
        try {
          let replyText = `✅ *AGENDAMENTO REGISTRADO!* 🚛\n\n`;
          replyText += `🚗 *Veículo:* ${agendamento.veiculo || 'N/D'}`;
          if (agendamento.cor) replyText += ` (${agendamento.cor})`;
          replyText += `\n`;

          if (agendamento.chassiPlaca) replyText += `🔖 *Chassi / Placa:* ${agendamento.chassiPlaca}\n`;
          if (agendamento.freioEletronico) replyText += `⚡ *Freio Eletrônico:* ${agendamento.freioEletronico}\n`;
          if (agendamento.veiculoImobilizado) replyText += `🛑 *Veículo Imobilizado:* ${agendamento.veiculoImobilizado}\n`;

          const depto = agendamento.departamento || agendamento.deptoEntrega;
          if (depto) {
            replyText += `🏢 *Departamento:* ${depto}\n`;
          }

          replyText += `\n📍 *Origem (Coleta):* ${agendamento.origem}\n`;
          if (agendamento.responsavelEntrega) replyText += `👤 *Resp. Entrega:* ${agendamento.responsavelEntrega}\n`;

          replyText += `\n🏁 *Destino (Entrega):* ${agendamento.destino}\n`;
          if (agendamento.responsavelRecebimento) replyText += `🤝 *Resp. Recebimento:* ${agendamento.responsavelRecebimento}\n`;

          if (agendamento.agendarPara) replyText += `📅 *Agendar Para:* ${agendamento.agendarPara}\n`;
          const nf = resolveNotaFiscal(agendamento);
          if (nf) replyText += `🧾 *Nota Fiscal:* ${nf}\n`;

          await message.reply(replyText);
          logger.success('Resposta enviada no grupo do WhatsApp!');
        } catch (replyErr) {
          logger.warn(`Não foi possível responder no WhatsApp: ${replyErr.message}`);
        }
      }
    }
  } else {
    // Registro duplicado
    history.recordMessage({
      messageId: msgId,
      timestamp: msgDate,
      author: sender,
      body,
      status: 'DUPLICADO',
      reason: 'Veículo já cadastrado na planilha para esta data',
      extractedData: agendamento,
    });
  }

  return { isAgendamento: true, inserted: !!inserted };
}

module.exports = {
  createClient,
  cleanupStaleBrowserSession,
  scanGroupMessages,
  handleMessage,
};
