// ==========================================================================
//  WhatsApp Guincho Bot — Painel de Controle (Front-end App)
//  Arquitetura Moderna: shadcn/ui, Linear & Vercel Design Patterns
// ==========================================================================

// ── Estado da Aplicação ───────────────────────────────────────────────────
const state = {
  activeTab: 'overview',
  theme: 'dark',
  historyStatus: 'TODOS',
  historySearch: '',
  historyOffset: 0,
  historyLimit: 20,
  historyItems: [],
  historyTotal: 0,
  logsRaw: [],
  logsFilterLevel: 'ALL',
  logsSearchTerm: '',
  autoScroll: true,
  isBotRunning: false,
  groupRepliesEnabled: true,
  approvals: [],
  activeSheetTab: 'OUTUBRO 2026',
  cycleRange: '',
  cycleStart: '',
  cycleEnd: '',
};

// ── Elementos DOM ────────────────────────────────────────────────────────
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const themeToggle = document.getElementById('themeToggle');

// Connection badge
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const latencyTag = document.getElementById('latencyTag');
const approvalsTabBadge = document.getElementById('approvalsTabBadge');

// Metric cards (Overview)
const cardBotStatus = document.getElementById('cardBotStatus');
const cardBotPid = document.getElementById('cardBotPid');
const cardRamUsage = document.getElementById('cardRamUsage');
const cardRamHeap = document.getElementById('cardRamHeap');
const cardUptime = document.getElementById('cardUptime');
const cardTotalLidas = document.getElementById('cardTotalLidas');
const cardAgendamentos = document.getElementById('cardAgendamentos');
const cardDuplicatesHint = document.getElementById('cardDuplicatesHint');
const cardApprovalsWrapper = document.getElementById('cardApprovalsWrapper');
const cardPendingApprovals = document.getElementById('cardPendingApprovals');
const cardActiveTab = document.getElementById('cardActiveTab');
const cardCycleRange = document.getElementById('cardCycleRange');

// Approvals View
const approvalsListContainer = document.getElementById('approvalsListContainer');
const btnRefreshApprovals = document.getElementById('btnRefreshApprovals');

// Approval Modal
const approvalModal = document.getElementById('approvalModal');
const modalApprovalQuote = document.getElementById('modalApprovalQuote');
const modalApprovalMsgId = document.getElementById('modalApprovalMsgId');
const modalApprData = document.getElementById('modalApprData');
const modalApprDepto = document.getElementById('modalApprDepto');
const modalApprVeiculo = document.getElementById('modalApprVeiculo');
const modalApprChassiPlaca = document.getElementById('modalApprChassiPlaca');
const modalApprOrigem = document.getElementById('modalApprOrigem');
const modalApprDestino = document.getElementById('modalApprDestino');
const modalApprModalidade = document.getElementById('modalApprModalidade');
const modalApprNotaFiscal = document.getElementById('modalApprNotaFiscal');
const modalApprCusto = document.getElementById('modalApprCusto');
const modalApprQtd = document.getElementById('modalApprQtd');
const btnCloseApprovalModal = document.getElementById('btnCloseApprovalModal');
const btnDismissApprovalModal = document.getElementById('btnDismissApprovalModal');
const btnConfirmApprovalModal = document.getElementById('btnConfirmApprovalModal');

// Overview: History & Filters
const historyTableBody = document.getElementById('historyTableBody');
const overviewSearchInput = document.getElementById('overviewSearchInput');
const btnOverviewSearch = document.getElementById('btnOverviewSearch');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const paginationLabel = document.getElementById('paginationLabel');
const btnQuickRescan = document.getElementById('btnQuickRescan');

// Top System Status Bar
const topCardBot = document.getElementById('topCardBot');
const topBotBadge = document.getElementById('topBotBadge');
const topBotDetail = document.getElementById('topBotDetail');
const topCardSheet = document.getElementById('topCardSheet');
const topSheetBadge = document.getElementById('topSheetBadge');
const topSheetDetail = document.getElementById('topSheetDetail');
const topCardWhatsApp = document.getElementById('topCardWhatsApp');
const topWhatsAppBadge = document.getElementById('topWhatsAppBadge');
const topWhatsAppDetail = document.getElementById('topWhatsAppDetail');
const topCardSync = document.getElementById('topCardSync');
const topSyncBadge = document.getElementById('topSyncBadge');
const topSyncDetail = document.getElementById('topSyncDetail');

// Commands View (Hero & Operational Cards)
const cmdServiceBox = document.getElementById('cmdServiceBox');
const cmdServicePulse = document.getElementById('cmdServicePulse');
const cmdServiceBigText = document.getElementById('cmdServiceBigText');
const cmdProcessPidDisplay = document.getElementById('cmdProcessPidDisplay');
const btnCmdStart = document.getElementById('btnCmdStart');
const btnCmdStop = document.getElementById('btnCmdStop');
const cmdReplyStatusBadge = document.getElementById('cmdReplyStatusBadge');
const cmdReplyBanner = document.getElementById('cmdReplyBanner');
const cmdReplyBannerTitle = document.getElementById('cmdReplyBannerTitle');
const cmdReplyBannerDesc = document.getElementById('cmdReplyBannerDesc');
const btnCmdToggleReplies = document.getElementById('btnCmdToggleReplies');
const btnCmdToggleRepliesIcon = document.getElementById('btnCmdToggleRepliesIcon');
const btnCmdToggleRepliesText = document.getElementById('btnCmdToggleRepliesText');

// Reprocess Card & Confirmation Modal
const radioCycle = document.getElementById('radioCycle');
const radioCustom = document.getElementById('radioCustom');
const labelRadioCycle = document.getElementById('labelRadioCycle');
const labelRadioCustom = document.getElementById('labelRadioCustom');
const rescanCycleTab = document.getElementById('rescanCycleTab');
const rescanCycleRange = document.getElementById('rescanCycleRange');
const customDateContainer = document.getElementById('customDateContainer');
const cmdCustomDateStart = document.getElementById('cmdCustomDateStart');
const cmdCustomDateEnd = document.getElementById('cmdCustomDateEnd');
const btnOpenRescanModal = document.getElementById('btnOpenRescanModal');
const rescanConfirmModal = document.getElementById('rescanConfirmModal');
const btnCloseRescanModal = document.getElementById('btnCloseRescanModal');
const btnCancelRescanModal = document.getElementById('btnCancelRescanModal');
const btnConfirmRescanModal = document.getElementById('btnConfirmRescanModal');
const modalRescanPeriodText = document.getElementById('modalRescanPeriodText');
const modalRescanDestTab = document.getElementById('modalRescanDestTab');
const rescanProgressBox = document.getElementById('rescanProgressBox');
const rescanProgressText = document.getElementById('rescanProgressText');
const rescanModalFooter = document.getElementById('rescanModalFooter');

// Maintenance & Sheets
const cmdSheetStatusBadge = document.getElementById('cmdSheetStatusBadge');
const cmdSheetName = document.getElementById('cmdSheetName');
const cmdSheetActiveTab = document.getElementById('cmdSheetActiveTab');
const cmdSheetLastSync = document.getElementById('cmdSheetLastSync');
const btnCmdSyncSheets = document.getElementById('btnCmdSyncSheets');
const btnCmdRecalcCosts = document.getElementById('btnCmdRecalcCosts');
const maintLogSize = document.getElementById('maintLogSize');
const maintTermLines = document.getElementById('maintTermLines');
const btnOpenClearLogsModal = document.getElementById('btnOpenClearLogsModal');
const btnOpenClearTermModal = document.getElementById('btnOpenClearTermModal');
const cleanConfirmModal = document.getElementById('cleanConfirmModal');
const btnCloseCleanModal = document.getElementById('btnCloseCleanModal');
const btnCancelCleanModal = document.getElementById('btnCancelCleanModal');
const btnConfirmCleanModal = document.getElementById('btnConfirmCleanModal');
const cleanModalDesc = document.getElementById('cleanModalDesc');

// Configuration summary
const cfgDisplayCycle = document.getElementById('cfgDisplayCycle');
const cfgDisplayCycleDates = document.getElementById('cfgDisplayCycleDates');
const cfgDisplayGeminiModel = document.getElementById('cfgDisplayGeminiModel');
const cfgDisplayGroupId = document.getElementById('cfgDisplayGroupId');

// Terminal View
const terminalScreen = document.getElementById('terminalScreen');
const terminalBody = document.getElementById('terminalBody');
const chkAutoScroll = document.getElementById('chkAutoScroll');
const btnCopyLogs = document.getElementById('btnCopyLogs');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');
const termSearchInput = document.getElementById('termSearchInput');
const termLinesCount = document.getElementById('termLinesCount');

// Settings View
const cfgGroupId = document.getElementById('cfgGroupId');
const cfgGroupBadge = document.getElementById('cfgGroupBadge');
const cfgSheetId = document.getElementById('cfgSheetId');
const cfgSheetBadge = document.getElementById('cfgSheetBadge');
const cfgGeminiModel = document.getElementById('cfgGeminiModel');
const cfgGeminiBadge = document.getElementById('cfgGeminiBadge');
const sysNodeVer = document.getElementById('sysNodeVer');
const sysPlatform = document.getElementById('sysPlatform');
const sysPort = document.getElementById('sysPort');

// Group Replies Toggle Elements
const btnHeaderToggleReplies = document.getElementById('btnHeaderToggleReplies');
const headerReplyIcon = document.getElementById('headerReplyIcon');
const headerReplyText = document.getElementById('headerReplyText');
const btnSettingsToggleReplies = document.getElementById('btnSettingsToggleReplies');
const cfgGroupRepliesBadge = document.getElementById('cfgGroupRepliesBadge');
const cfgGroupRepliesDesc = document.getElementById('cfgGroupRepliesDesc');

// Detail Modal
const detailModal = document.getElementById('detailModal');
const detailModalBody = document.getElementById('detailModalBody');
const modalMessageDate = document.getElementById('modalMessageDate');
const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
const btnDismissModal = document.getElementById('btnDismissModal');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// ── Sistema de Notificações Toast ─────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warn') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Tema Claro / Escuro ───────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('hz_theme');
  if (saved === 'light' || saved === 'dark') {
    setTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
  } else {
    setTheme('dark');
  }
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hz_theme', theme);
}

themeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// ── Navegação por Abas ────────────────────────────────────────────────────
function switchTab(targetTabId) {
  state.activeTab = targetTabId;

  navTabs.forEach((tab) => {
    const isTarget = tab.dataset.tab === targetTabId;
    tab.classList.toggle('active', isTarget);
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `view-${targetTabId}`);
  });

  // Se navegou para o terminal, ajusta scroll
  if (targetTabId === 'logs' && chkAutoScroll.checked) {
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }

  if (targetTabId === 'approvals') {
    fetchApprovals();
  }

  if (targetTabId === 'transparency') {
    fetchTransparency();
  }
}

navTabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

btnQuickRescan.addEventListener('click', () => {
  switchTab('commands');
  const rescanCard = document.querySelector('#btnCmdRescan');
  if (rescanCard) {
    rescanCard.scrollIntoView({ behavior: 'smooth' });
    rescanCard.focus();
  }
});

if (cardApprovalsWrapper) {
  cardApprovalsWrapper.addEventListener('click', () => switchTab('approvals'));
}

// ── Formatação de Utilitários ─────────────────────────────────────────────
function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── API: Status & Telemetria ──────────────────────────────────────────────
async function fetchStatus() {
  const t0 = performance.now();
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    latencyTag.textContent = `${latency} ms`;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.isBotRunning = !!data.running;
    if (data.groupRepliesEnabled !== undefined) {
      updateRepliesUI(data.groupRepliesEnabled);
    }

    // 1. Bloco Superior: Status do Sistema (4 indicadores principais)
    if (topBotBadge) {
      if (data.running) {
        topBotBadge.className = 'indicator-badge badge-running';
        topBotBadge.textContent = '🟢 Em execução';
      } else {
        topBotBadge.className = 'indicator-badge badge-stopped';
        topBotBadge.textContent = '🔴 Parado';
      }
    }
    if (topBotDetail) {
      topBotDetail.textContent = 'Rotina: 07:00 → 19:00';
    }

    if (topSheetBadge) {
      if (data.config && data.config.sheetConfigured) {
        topSheetBadge.className = 'indicator-badge badge-connected';
        topSheetBadge.textContent = '🟢 Conectado';
      } else {
        topSheetBadge.className = 'indicator-badge badge-error';
        topSheetBadge.textContent = '🔴 Conexão indisponível';
      }
    }
    if (topSheetDetail) {
      topSheetDetail.textContent = `Aba ativa: ${data.activeTab || 'OUTUBRO 2026'}`;
    }

    if (topWhatsAppBadge) {
      if (data.groupRepliesEnabled) {
        topWhatsAppBadge.className = 'indicator-badge badge-active';
        topWhatsAppBadge.textContent = '🟢 Respostas ativas';
      } else {
        topWhatsAppBadge.className = 'indicator-badge badge-silent';
        topWhatsAppBadge.textContent = '🔕 Modo silencioso';
      }
    }
    if (topWhatsAppDetail) {
      topWhatsAppDetail.textContent = data.groupRepliesEnabled ? 'Respostas ativas no grupo' : 'Respostas desativadas';
    }

    if (topSyncBadge) {
      topSyncBadge.textContent = `Última: ${data.lastSyncTime || new Date().toLocaleTimeString('pt-BR')}`;
    }
    if (topSyncDetail) {
      topSyncDetail.textContent = `Latência: ${latency} ms`;
    }

    // 2. Conexão Header & Hero Serviço do Bot
    if (data.running) {
      statusDot.className = 'status-pulse-dot online';
      statusLabel.textContent = 'Online';
      cardBotStatus.textContent = 'Ativo';
      cardBotStatus.className = 'metric-number text-success';
      cardBotPid.textContent = `PID: ${data.pid || '--'}`;

      if (cmdServiceBigText) {
        cmdServiceBigText.textContent = '🟢 EM EXECUÇÃO';
        cmdServiceBigText.className = 'service-status-text text-success';
      }
      if (cmdServicePulse) {
        cmdServicePulse.className = 'status-pulse-dot large online';
      }
      if (cmdProcessPidDisplay) {
        cmdProcessPidDisplay.textContent = `PID: ${data.pid || '--'}`;
      }
      if (btnCmdStart) btnCmdStart.style.display = 'none';
      if (btnCmdStop) btnCmdStop.style.display = 'inline-flex';
    } else {
      statusDot.className = 'status-pulse-dot offline';
      statusLabel.textContent = 'Parado';
      cardBotStatus.textContent = 'Parado';
      cardBotStatus.className = 'metric-number';
      cardBotPid.textContent = 'Bot inativo';

      if (cmdServiceBigText) {
        cmdServiceBigText.textContent = '🔴 PARADO';
        cmdServiceBigText.className = 'service-status-text text-muted';
      }
      if (cmdServicePulse) {
        cmdServicePulse.className = 'status-pulse-dot large offline';
      }
      if (cmdProcessPidDisplay) {
        cmdProcessPidDisplay.textContent = 'PID: inativo';
      }
      if (btnCmdStart) btnCmdStart.style.display = 'inline-flex';
      if (btnCmdStop) btnCmdStop.style.display = 'none';
    }

    // 3. Métricas
    if (data.stats) {
      cardTotalLidas.textContent = data.stats.totalLidas || 0;
      cardAgendamentos.textContent = data.stats.agendamentos || 0;
      cardDuplicatesHint.textContent = `Duplicados prevenidos: ${data.stats.duplicados || 0}`;

      const pending = data.stats.pendentesAprovacao || 0;
      if (cardPendingApprovals) cardPendingApprovals.textContent = pending;
      if (approvalsTabBadge) {
        if (pending > 0) {
          approvalsTabBadge.textContent = pending;
          approvalsTabBadge.style.display = 'inline-flex';
        } else {
          approvalsTabBadge.style.display = 'none';
        }
      }
    }

    // 4. Ciclo e Abas
    if (data.activeTab) {
      state.activeSheetTab = data.activeTab;
      state.cycleRange = data.cycleRange || '';
      state.cycleStart = data.cycleStart || '';
      state.cycleEnd = data.cycleEnd || '';
      cardActiveTab.textContent = data.activeTab;
      cardCycleRange.textContent = `Ciclo: ${data.cycleRange || ''}`;
      if (rescanCycleTab) rescanCycleTab.textContent = data.activeTab;
      if (rescanCycleRange) rescanCycleRange.textContent = data.cycleRange || `${data.cycleStart || '24/09/2026'} → ${data.cycleEnd || '23/10/2026'}`;
      if (cfgDisplayCycleDates) cfgDisplayCycleDates.textContent = `Aba: ${data.activeTab}`;
      if (cmdSheetActiveTab) cmdSheetActiveTab.textContent = data.activeTab;
    }

    // 5. Google Sheets e Manutenção
    if (cmdSheetName) {
      cmdSheetName.textContent = data.sheetName || 'Guincho';
    }
    if (cmdSheetLastSync) {
      cmdSheetLastSync.textContent = data.lastSyncTime || new Date().toLocaleTimeString('pt-BR');
    }
    if (cmdSheetStatusBadge) {
      cmdSheetStatusBadge.className = (data.config && data.config.sheetConfigured) ? 'badge badge-success' : 'badge badge-danger';
      cmdSheetStatusBadge.textContent = (data.config && data.config.sheetConfigured) ? '🟢 Conectado' : '🔴 Conexão indisponível';
    }
    if (maintLogSize) {
      maintLogSize.textContent = `${data.logSizeMB || 0} MB`;
    }
    if (maintTermLines) {
      maintTermLines.textContent = `${state.logsRaw ? state.logsRaw.length : 0} linhas`;
    }

    // Sistema e RAM
    if (data.system) {
      cardRamUsage.textContent = data.system.memoryRssMB || '--';
      cardRamHeap.textContent = `Heap: ${data.system.memoryHeapMB || '--'} MB`;
      cardUptime.textContent = formatUptime(data.system.uptimeSeconds);
      sysNodeVer.textContent = data.system.nodeVersion || '--';
      sysPlatform.textContent = data.system.platform || 'Windows';
    }

    // Configurações
    if (data.config) {
      cfgGroupId.textContent = data.config.groupId;
      cfgGroupBadge.className = data.config.groupConfigured ? 'badge badge-success' : 'badge badge-danger';
      cfgGroupBadge.textContent = data.config.groupConfigured ? 'Ativo' : 'Pendente';

      cfgSheetId.textContent = data.config.sheetId;
      cfgSheetBadge.className = data.config.sheetConfigured ? 'badge badge-success' : 'badge badge-danger';
      cfgSheetBadge.textContent = data.config.sheetConfigured ? 'Conectado' : 'Pendente';

      cfgGeminiModel.textContent = `Modelo: ${data.config.geminiModel}`;
      cfgGeminiBadge.className = data.config.geminiConfigured ? 'badge badge-success' : 'badge badge-danger';
      cfgGeminiBadge.textContent = data.config.geminiConfigured ? 'Chave Ativa' : 'Sem Chave';

      sysPort.textContent = `${data.config.port} (http://localhost:${data.config.port})`;
    }
  } catch (err) {
    statusDot.className = 'status-pulse-dot offline';
    statusLabel.textContent = 'Offline';
    latencyTag.textContent = 'Erro';
    cardBotStatus.textContent = 'Indisponível';
    cardBotStatus.className = 'metric-number';
  }
}

// ── API: Auditoria & Histórico de Mensagens ────────────────────────────────
async function fetchHistory() {
  try {
    const params = new URLSearchParams({
      status: state.historyStatus,
      search: state.historySearch,
      limit: state.historyLimit,
      offset: state.historyOffset,
    });

    const res = await fetch(`/api/history?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.historyItems = data.items || [];
    state.historyTotal = data.total || 0;

    renderHistoryTable();
  } catch (err) {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="table-state-cell">Erro ao carregar histórico: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderHistoryTable() {
  const items = state.historyItems;
  const total = state.historyTotal;

  if (items.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-state-cell">Nenhuma mensagem encontrada para os filtros selecionados.</td>
      </tr>
    `;
    paginationLabel.textContent = 'Mostrando 0 de 0 registros';
    btnPrevPage.disabled = true;
    btnNextPage.disabled = true;
    return;
  }

  historyTableBody.innerHTML = items
    .map((item, idx) => {
      let badgeHtml = `<span class="badge badge-muted">${escapeHtml(item.status || 'Descartado')}</span>`;
      if (item.status === 'AGENDAMENTO' || item.status === 'NOVO_AGENDAMENTO') {
        badgeHtml = '<span class="badge badge-success">Agendamento</span>';
      } else if (item.status === 'DUPLICADO') {
        badgeHtml = '<span class="badge badge-warning">Duplicado</span>';
      } else if (item.status === 'ALTERACAO') {
        badgeHtml = '<span class="badge badge-info">Alteração</span>';
      } else if (item.status === 'CANCELAMENTO') {
        badgeHtml = '<span class="badge badge-danger">Cancelado</span>';
      } else if (item.status === 'CONFIRMACAO') {
        badgeHtml = '<span class="badge badge-muted">Confirmação</span>';
      } else if (item.status === 'AVISO_OPERACIONAL') {
        badgeHtml = '<span class="badge badge-muted">Aviso Operac.</span>';
      } else if (item.status === 'PERGUNTA') {
        badgeHtml = '<span class="badge badge-muted">Pergunta</span>';
      }

      let infoHtml = '';
      if (item.extractedData && item.extractedData.veiculo) {
        const d = item.extractedData;
        const color = d.cor ? ` (${escapeHtml(d.cor)})` : '';
        const plate = d.chassiPlaca ? ` • ${escapeHtml(d.chassiPlaca)}` : '';
        infoHtml = `
          <div class="row-vehicle-title">🚗 ${escapeHtml(d.veiculo)}${color}${plate}</div>
          <div class="row-route-text">📍 ${escapeHtml(d.origem || 'Origem')} ➔ 🏁 ${escapeHtml(d.destino || 'Destino')}</div>
        `;
      } else {
        const snippet = item.reason || item.body || 'Sem dados adicionais';
        infoHtml = `<div class="row-reason-text">${escapeHtml(snippet.substring(0, 95))}</div>`;
      }

      return `
        <tr>
          <td><small style="font-family: var(--font-mono); font-size: 0.75rem;">${escapeHtml(item.date)}</small></td>
          <td><strong>${escapeHtml(item.author || 'Grupo')}</strong></td>
          <td>${badgeHtml}</td>
          <td>${infoHtml}</td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline" onclick="openDetailModal(${idx})">Ver</button>
          </td>
        </tr>
      `;
    })
    .join('');

  const start = state.historyOffset + 1;
  const end = Math.min(state.historyOffset + state.historyLimit, total);
  paginationLabel.textContent = `Mostrando ${start} a ${end} de ${total} mensagens`;

  btnPrevPage.disabled = state.historyOffset <= 0;
  btnNextPage.disabled = state.historyOffset + state.historyLimit >= total;
}

// Filtros de Histórico
document.querySelectorAll('.segment-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.segment-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    state.historyStatus = e.target.dataset.status;
    state.historyOffset = 0;
    fetchHistory();
  });
});

btnOverviewSearch.addEventListener('click', () => {
  state.historySearch = overviewSearchInput.value.trim();
  state.historyOffset = 0;
  fetchHistory();
});

overviewSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    state.historySearch = overviewSearchInput.value.trim();
    state.historyOffset = 0;
    fetchHistory();
  }
});

btnPrevPage.addEventListener('click', () => {
  if (state.historyOffset >= state.historyLimit) {
    state.historyOffset -= state.historyLimit;
    fetchHistory();
  }
});

btnNextPage.addEventListener('click', () => {
  if (state.historyOffset + state.historyLimit < state.historyTotal) {
    state.historyOffset += state.historyLimit;
    fetchHistory();
  }
});

// ── Modal de Detalhes da Mensagem ─────────────────────────────────────────
window.openDetailModal = function (idx) {
  const item = state.historyItems[idx];
  if (!item) return;

  modalMessageDate.textContent = `${item.date} • Remetente: ${item.author || 'Grupo'}`;

  let extDataHtml = '';
  if (item.extractedData) {
    const d = item.extractedData;
    extDataHtml = `
      <div>
        <h4 style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Dados Extraídos para a Planilha</h4>
        <div class="modal-data-grid">
          <div class="data-cell"><span class="data-cell-label">Veículo</span><span class="data-cell-val">${escapeHtml(d.veiculo || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Cor</span><span class="data-cell-val">${escapeHtml(d.cor || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Chassi / Placa</span><span class="data-cell-val">${escapeHtml(d.chassiPlaca || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Departamento</span><span class="data-cell-val">${escapeHtml(d.departamento || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Origem</span><span class="data-cell-val">${escapeHtml(d.origem || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Destino</span><span class="data-cell-val">${escapeHtml(d.destino || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Tipo Transporte</span><span class="data-cell-val">${escapeHtml(d.transporte || 'PLATAFORMA')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Faturar Para</span><span class="data-cell-val">${escapeHtml(d.faturarPara || '-')}</span></div>
          <div class="data-cell"><span class="data-cell-label">Data Agendada</span><span class="data-cell-val">${escapeHtml(d.agendarPara || '-')}</span></div>
        </div>
      </div>
    `;
  }

  let statusBadge = '<span class="badge badge-muted">Descartado</span>';
  if (item.status === 'AGENDAMENTO') statusBadge = '<span class="badge badge-success">Agendamento Válido</span>';
  if (item.status === 'DUPLICADO') statusBadge = '<span class="badge badge-warning">Duplicado</span>';

  detailModalBody.innerHTML = `
    <div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="font-size: 0.8125rem; font-weight: 600;">Resultado:</span>
        ${statusBadge}
      </div>
      <p style="font-size: 0.8125rem; color: var(--text-secondary);">${escapeHtml(item.reason || 'Mensagem avaliada pela inteligência artificial.')}</p>
    </div>

    ${extDataHtml}

    <div>
      <h4 style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">Texto Original do WhatsApp</h4>
      <div class="raw-message-box">${escapeHtml(item.body || '(Mensagem vazia)')}</div>
    </div>
  `;

  detailModal.classList.add('active');
  detailModal.setAttribute('aria-hidden', 'false');
};

function closeDetailModal() {
  detailModal.classList.remove('active');
  detailModal.setAttribute('aria-hidden', 'true');
}

btnCloseDetailModal.addEventListener('click', closeDetailModal);
btnDismissModal.addEventListener('click', closeDetailModal);
window.addEventListener('click', (e) => {
  if (e.target === detailModal) closeDetailModal();
  if (e.target === approvalModal) closeApprovalModal();
});

// ── Painel de Aprovações de Transporte ─────────────────────────────────────
async function fetchApprovals() {
  try {
    const res = await fetch('/api/approvals', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.approvals = data.items || [];
    renderApprovals();
  } catch (err) {
    if (approvalsListContainer) {
      approvalsListContainer.innerHTML = `<div class="empty-state">Erro ao carregar aprovações: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderApprovals() {
  if (!approvalsListContainer) return;

  const items = state.approvals;
  if (!items || items.length === 0) {
    approvalsListContainer.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 48px 20px; background: var(--bg-card); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">
        <div style="font-size: 2rem; margin-bottom: 12px;">🎉</div>
        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">Nenhuma aprovação pendente</h3>
        <p style="font-size: 0.8125rem; color: var(--text-muted); max-width: 420px; margin: 0 auto;">Todas as mensagens operacionais com intenção de cobrança ou transporte foram revisadas ou processadas.</p>
      </div>
    `;
    return;
  }

  let html = '';
  items.forEach((item) => {
    const ext = item.dadosExtraidos || {};
    const dateStr = item.date || (item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '--');
    const authorStr = item.author ? `Remetente: ${escapeHtml(item.author)}` : 'Grupo Hazul';
    const desc = ext.veiculo || 'VIAGEM GUINCHO';
    const rota = (ext.origem && ext.destino) ? `${escapeHtml(ext.origem)} ➔ ${escapeHtml(ext.destino)}` : 'Não informada';
    const valorEst = ext.custoViagem || 'A calcular';

    html += `
      <div class="approval-card" data-id="${escapeHtml(item.id)}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="badge badge-warning">Pendente de Decisão</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(dateStr)}</span>
            </div>
            <span style="font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);">${escapeHtml(authorStr)}</span>
          </div>
          <span style="font-family: var(--font-mono); font-size: 0.875rem; font-weight: 600; color: var(--primary);">${escapeHtml(valorEst)}</span>
        </div>

        <div class="approval-quote-box">
          "${escapeHtml(item.texto || item.body || '')}"
        </div>

        <div class="approval-details-grid">
          <div class="approval-detail-item">
            <span class="approval-detail-label">Data Prevista</span>
            <span class="approval-detail-val">${escapeHtml(ext.data || '--')}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-label">Rota Identificada</span>
            <span class="approval-detail-val">${rota}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-label">Veículo / Descrição</span>
            <span class="approval-detail-val">${escapeHtml(desc)}</span>
          </div>
          <div class="approval-detail-item">
            <span class="approval-detail-label">Departamento</span>
            <span class="approval-detail-val">${escapeHtml(ext.departamento || 'SEMI NOVOS')}</span>
          </div>
        </div>

        <div class="approval-actions">
          <button class="btn btn-sm btn-outline" onclick="rejectApproval('${escapeHtml(item.id)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Descartar
          </button>
          <button class="btn btn-sm btn-primary" onclick="openApprovalModal('${escapeHtml(item.id)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-svg"><polyline points="20 6 9 17 4 12"/></svg>
            Aprovar &amp; Lançar na Planilha...
          </button>
        </div>
      </div>
    `;
  });

  approvalsListContainer.innerHTML = html;
}

window.openApprovalModal = async function(id) {
  const item = state.approvals.find((x) => x.id === id);
  if (!item) return;

  const ext = item.dadosExtraidos || {};
  modalApprovalMsgId.value = item.id;
  modalApprovalQuote.textContent = `"${item.texto || item.body || ''}"`;

  modalApprData.value = ext.data || new Date().toLocaleDateString('pt-BR');
  modalApprDepto.value = ext.departamento || 'SEMI NOVOS';
  modalApprVeiculo.value = ext.veiculo || 'VIAGEM GUINCHO - TONHÃO';
  modalApprChassiPlaca.value = ext.chassiPlaca || '-';
  modalApprOrigem.value = ext.origem || 'ITAPIRA';
  modalApprDestino.value = ext.destino || 'CAMPINAS';
  modalApprModalidade.value = ext.veiculoTransporte || 'PLATAFORMA';
  modalApprNotaFiscal.value = ext.notaFiscal || '-';
  modalApprQtd.value = ext.veiculosPorViagem || 1;

  if (ext.custoViagem) {
    modalApprCusto.value = ext.custoViagem;
  } else {
    modalApprCusto.value = 'Calculando...';
    try {
      const res = await fetch(`/api/costs/estimate?origem=${encodeURIComponent(modalApprOrigem.value)}&destino=${encodeURIComponent(modalApprDestino.value)}&transporte=${encodeURIComponent(modalApprModalidade.value)}&qtd=${encodeURIComponent(modalApprQtd.value)}`);
      const data = await res.json();
      if (data.success && data.cost) {
        modalApprCusto.value = data.cost.formattedTotal;
      } else {
        modalApprCusto.value = 'R$ 760,61';
      }
    } catch (e) {
      modalApprCusto.value = 'R$ 760,61';
    }
  }

  approvalModal.classList.add('active');
  approvalModal.setAttribute('aria-hidden', 'false');
};

function closeApprovalModal() {
  approvalModal.classList.remove('active');
  approvalModal.setAttribute('aria-hidden', 'true');
}

window.rejectApproval = async function(id) {
  if (!confirm('Deseja realmente descartar esta solicitação sem lançar na planilha?')) return;

  try {
    const res = await fetch('/api/approvals/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason: 'Descartado manualmente pelo operador no painel' }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Solicitação descartada.', 'info');
      fetchApprovals();
      fetchStatus();
      fetchHistory();
    } else {
      showToast('Erro ao descartar: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação: ' + err.message, 'error');
  }
};

async function confirmApproval() {
  const id = modalApprovalMsgId.value;
  if (!id) return;

  btnConfirmApprovalModal.disabled = true;
  btnConfirmApprovalModal.textContent = 'Lançando na Planilha...';

  try {
    const payload = {
      id,
      data: modalApprData.value.trim(),
      departamento: modalApprDepto.value.trim(),
      veiculo: modalApprVeiculo.value.trim(),
      chassiPlaca: modalApprChassiPlaca.value.trim(),
      origem: modalApprOrigem.value.trim(),
      destino: modalApprDestino.value.trim(),
      transporte: modalApprModalidade.value.trim(),
      faturarPara: modalApprNotaFiscal.value.trim(),
      custoViagem: modalApprCusto.value.trim(),
      veiculosPorViagem: parseInt(modalApprQtd.value, 10) || 1,
    };

    const res = await fetch('/api/approvals/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeApprovalModal();
      fetchApprovals();
      fetchHistory();
      fetchStatus();
    } else {
      showToast('Erro ao lançar: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Falha ao comunicar com o servidor: ' + err.message, 'error');
  } finally {
    btnConfirmApprovalModal.disabled = false;
    btnConfirmApprovalModal.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-svg"><polyline points="20 6 9 17 4 12"/></svg>
      Confirmar e Lançar na Planilha
    `;
  }
}

if (btnCloseApprovalModal) btnCloseApprovalModal.addEventListener('click', closeApprovalModal);
if (btnDismissApprovalModal) btnDismissApprovalModal.addEventListener('click', closeApprovalModal);
if (btnConfirmApprovalModal) btnConfirmApprovalModal.addEventListener('click', confirmApproval);
if (btnRefreshApprovals) {
  btnRefreshApprovals.addEventListener('click', () => {
    fetchApprovals();
    showToast('Lista de aprovações atualizada.', 'info');
  });
}

// ── API: Terminal de Logs ─────────────────────────────────────────────────
async function fetchLogs() {
  try {
    const res = await fetch('/api/logs', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    state.logsRaw = data.lines || [];
    renderLogs();
  } catch (e) {}
}

function renderLogs() {
  const lines = state.logsRaw;
  const filter = state.logsFilterLevel;
  const query = state.logsSearchTerm.toLowerCase();

  const filtered = lines.filter((line) => {
    if (filter === 'INFO' && !line.includes('[INFO]')) return false;
    if (filter === 'WARN' && !line.includes('[WARN]') && !line.includes('[AVISO]')) return false;
    if (filter === 'ERROR' && !line.includes('[ERRO]') && !line.includes('[ERROR]')) return false;
    if (query && !line.toLowerCase().includes(query)) return false;
    return true;
  });

  termLinesCount.textContent = `${filtered.length} de ${lines.length} linhas`;

  if (filtered.length === 0) {
    terminalBody.innerHTML = '<span class="term-line term-dim">Nenhum log encontrado para o filtro selecionado.</span>';
    return;
  }

  terminalBody.innerHTML = filtered
    .map((raw) => {
      let lineClass = 'term-dim';
      if (raw.includes('[INFO]')) lineClass = 'term-info';
      if (raw.includes('[WARN]') || raw.includes('[AVISO]')) lineClass = 'term-warn';
      if (raw.includes('[ERRO]') || raw.includes('[ERROR]')) lineClass = 'term-error';
      if (raw.includes('[OK]') || raw.includes('[AGENDAMENTO]')) lineClass = 'term-success';

      return `<span class="term-line ${lineClass}">${escapeHtml(raw)}</span>`;
    })
    .join('');

  if (chkAutoScroll.checked) {
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }
}

// Filtros do terminal
document.querySelectorAll('.log-filter-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.log-filter-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    state.logsFilterLevel = e.target.dataset.level;
    renderLogs();
  });
});

termSearchInput.addEventListener('input', (e) => {
  state.logsSearchTerm = e.target.value.trim();
  renderLogs();
});

btnCopyLogs.addEventListener('click', async () => {
  if (state.logsRaw.length === 0) {
    showToast('Não há logs para copiar.', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(state.logsRaw.join('\n'));
    showToast('Logs copiados para a área de transferência!', 'success');
  } catch (err) {
    showToast('Falha ao copiar logs: ' + err.message, 'error');
  }
});

btnRefreshLogs.addEventListener('click', () => {
  fetchLogs();
  showToast('Terminal atualizado.', 'info');
});

// ── Comandos: Iniciar / Parar / Releitura / Sync ───────────────────────────
btnCmdStart.addEventListener('click', async () => {
  btnCmdStart.disabled = true;
  const originalText = btnCmdStart.innerHTML;
  btnCmdStart.innerHTML = `
    <span class="spinner-sm" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.75s linear infinite;margin-right:6px;vertical-align:middle;"></span>
    Iniciando...
  `;
  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('🟢 Bot iniciado com sucesso.', 'success');
    } else {
      showToast(data.message || 'Falha ao iniciar bot.', 'warn');
    }
    setTimeout(fetchStatus, 600);
    setTimeout(fetchStatus, 1800);
    setTimeout(fetchStatus, 3500);
    setTimeout(fetchLogs, 1000);
    setTimeout(fetchLogs, 2500);
  } catch (err) {
    showToast('Erro ao iniciar bot: ' + err.message, 'error');
  } finally {
    btnCmdStart.disabled = false;
    btnCmdStart.innerHTML = originalText;
  }
});

btnCmdStop.addEventListener('click', async () => {
  if (!confirm('Deseja realmente parar o WhatsApp Guincho Bot?')) return;
  btnCmdStop.disabled = true;
  const originalText = btnCmdStop.innerHTML;
  btnCmdStop.innerHTML = `
    <span class="spinner-sm" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.75s linear infinite;margin-right:6px;vertical-align:middle;"></span>
    Parando...
  `;
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('🔴 Bot parado.', 'warn');
    } else {
      showToast(data.message || 'Falha ao parar bot.', 'warn');
    }
    setTimeout(fetchStatus, 600);
    setTimeout(fetchStatus, 2000);
    setTimeout(fetchLogs, 1200);
  } catch (err) {
    showToast('Erro ao parar bot: ' + err.message, 'error');
  } finally {
    btnCmdStop.disabled = false;
    btnCmdStop.innerHTML = originalText;
  }
});

// ── Controle de Respostas no Grupo (Modo Silencioso) ──────────────────────
function updateRepliesUI(enabled) {
  state.groupRepliesEnabled = !!enabled;

  if (btnHeaderToggleReplies) {
    btnHeaderToggleReplies.classList.toggle('active', enabled);
    btnHeaderToggleReplies.classList.toggle('inactive', !enabled);
    if (headerReplyIcon) headerReplyIcon.textContent = enabled ? '🔔' : '🔕';
    if (headerReplyText) headerReplyText.textContent = enabled ? 'Mensagens no Grupo: ON' : 'Modo Silencioso: OFF';
    btnHeaderToggleReplies.title = enabled
      ? 'Respostas ativadas no grupo. Clique para ativar Modo Silencioso.'
      : 'Modo silencioso ativo (sem mensagens no grupo). Clique para reativar.';
  }

  // Top Bar indicator
  if (topWhatsAppBadge) {
    topWhatsAppBadge.className = enabled ? 'indicator-badge badge-active' : 'indicator-badge badge-silent';
    topWhatsAppBadge.textContent = enabled ? '🟢 Respostas ativas' : '🔕 Modo silencioso';
  }
  if (topWhatsAppDetail) {
    topWhatsAppDetail.textContent = enabled ? 'Enviando mensagens no grupo' : 'Respostas desativadas';
  }

  // Card Respostas no WhatsApp
  if (cmdReplyStatusBadge) {
    cmdReplyStatusBadge.className = enabled ? 'badge badge-success' : 'badge badge-warning';
    cmdReplyStatusBadge.textContent = enabled ? '🟢 RESPOSTAS ATIVAS' : '🔕 MODO SILENCIOSO ATIVO';
  }

  if (cmdReplyBanner) {
    cmdReplyBanner.className = `reply-status-banner ${enabled ? 'active-mode' : 'silent-mode'}`;
  }

  if (cmdReplyBannerTitle) {
    cmdReplyBannerTitle.textContent = enabled ? '🟢 Respostas ativas no grupo do WhatsApp' : '🔕 MODO SILENCIOSO ATIVO';
  }

  if (cmdReplyBannerDesc) {
    cmdReplyBannerDesc.textContent = enabled
      ? 'O bot envia mensagens de confirmação e resumo diretamente no grupo após processar os agendamentos.'
      : 'O bot continua lendo, classificando e registrando as mensagens, mas não envia respostas ao grupo.';
  }

  if (btnCmdToggleReplies) {
    btnCmdToggleReplies.className = enabled ? 'btn btn-warning' : 'btn btn-success';
  }

  if (btnCmdToggleRepliesIcon) {
    btnCmdToggleRepliesIcon.textContent = enabled ? '🔕' : '🔔';
  }

  if (btnCmdToggleRepliesText) {
    btnCmdToggleRepliesText.textContent = enabled
      ? 'Ativar modo silencioso'
      : 'Ativar respostas no grupo';
  }

  // Config tab
  if (cfgGroupRepliesBadge) {
    cfgGroupRepliesBadge.textContent = enabled ? '🔔 Ativado' : '🔕 Desativado';
    cfgGroupRepliesBadge.className = enabled ? 'text-success' : 'text-warning';
  }

  if (cfgGroupRepliesDesc) {
    cfgGroupRepliesDesc.textContent = enabled
      ? 'O bot responde no grupo confirmando cada agendamento'
      : 'Modo Silencioso: sem mensagens no grupo. Gravação na planilha continua normal.';
  }
}

async function toggleGroupReplies() {
  try {
    const res = await fetch('/api/settings/toggle-replies', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      updateRepliesUI(data.groupRepliesEnabled);
      if (data.groupRepliesEnabled) {
        showToast('🔔 Respostas no grupo ativadas.', 'success');
      } else {
        showToast('🔕 Modo silencioso ativado.', 'warn');
      }
    } else {
      showToast('Erro ao alternar modo: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação: ' + err.message, 'error');
  }
}

if (btnHeaderToggleReplies) btnHeaderToggleReplies.addEventListener('click', toggleGroupReplies);
if (btnCmdToggleReplies) btnCmdToggleReplies.addEventListener('click', toggleGroupReplies);
if (btnSettingsToggleReplies) btnSettingsToggleReplies.addEventListener('click', toggleGroupReplies);

// ── Releitura / Reprocessamento de Mensagens ───────────────────────────────
function updateRescanSelection(mode) {
  if (mode === 'cycle') {
    if (radioCycle) radioCycle.checked = true;
    if (radioCustom) radioCustom.checked = false;
    if (labelRadioCycle) labelRadioCycle.classList.add('selected');
    if (labelRadioCustom) labelRadioCustom.classList.remove('selected');
    if (customDateContainer) customDateContainer.style.display = 'none';
  } else {
    if (radioCycle) radioCycle.checked = false;
    if (radioCustom) radioCustom.checked = true;
    if (labelRadioCycle) labelRadioCycle.classList.remove('selected');
    if (labelRadioCustom) labelRadioCustom.classList.add('selected');
    if (customDateContainer) customDateContainer.style.display = 'flex';
    const todayStr = new Date().toISOString().split('T')[0];
    if (cmdCustomDateStart && !cmdCustomDateStart.value) {
      cmdCustomDateStart.value = state.cycleStart || todayStr;
    }
    if (cmdCustomDateEnd && !cmdCustomDateEnd.value) {
      cmdCustomDateEnd.value = todayStr;
    }
  }
}

if (labelRadioCycle) {
  labelRadioCycle.addEventListener('click', () => updateRescanSelection('cycle'));
}
if (labelRadioCustom) {
  labelRadioCustom.addEventListener('click', () => updateRescanSelection('custom'));
}
if (radioCycle) {
  radioCycle.addEventListener('change', () => updateRescanSelection('cycle'));
}
if (radioCustom) {
  radioCustom.addEventListener('change', () => updateRescanSelection('custom'));
}

// Abrir Modal de Confirmação de Reprocessamento
if (btnOpenRescanModal) {
  btnOpenRescanModal.addEventListener('click', () => {
    if (!state.isBotRunning) {
      showToast('O bot precisa estar em execução para ler o grupo.', 'error');
      return;
    }

    let periodLabel = '';
    if (radioCustom && radioCustom.checked) {
      if (!cmdCustomDateStart || !cmdCustomDateStart.value) {
        showToast('Por favor, selecione a data inicial.', 'warn');
        return;
      }
      const sVal = cmdCustomDateStart.value;
      const eVal = (cmdCustomDateEnd && cmdCustomDateEnd.value) ? cmdCustomDateEnd.value : sVal;
      const sBr = sVal.split('-').reverse().join('/');
      const eBr = eVal.split('-').reverse().join('/');
      periodLabel = `${sBr} → ${eBr}`;
    } else {
      periodLabel = state.cycleRange || (rescanCycleRange ? rescanCycleRange.textContent : 'Ciclo atual');
    }

    if (modalRescanPeriodText) modalRescanPeriodText.textContent = periodLabel;
    if (modalRescanDestTab) modalRescanDestTab.textContent = `Aba ${state.activeSheetTab || 'OUTUBRO 2026'}`;
    if (rescanProgressBox) rescanProgressBox.style.display = 'none';
    if (rescanModalFooter) rescanModalFooter.style.display = 'flex';
    if (rescanConfirmModal) rescanConfirmModal.classList.add('active');
  });
}

if (btnCloseRescanModal) {
  btnCloseRescanModal.addEventListener('click', () => {
    if (rescanConfirmModal) rescanConfirmModal.classList.remove('active');
  });
}
if (btnCancelRescanModal) {
  btnCancelRescanModal.addEventListener('click', () => {
    if (rescanConfirmModal) rescanConfirmModal.classList.remove('active');
  });
}

if (btnConfirmRescanModal) {
  btnConfirmRescanModal.addEventListener('click', async () => {
    if (rescanProgressBox) rescanProgressBox.style.display = 'block';
    if (rescanModalFooter) rescanModalFooter.style.display = 'none';
    if (rescanProgressText) rescanProgressText.textContent = 'Analisando mensagens do período selecionado...';

    showToast('🔄 Reprocessando mensagens...', 'info');

    let sinceDate = null;
    let untilDate = null;
    if (radioCustom && radioCustom.checked) {
      sinceDate = cmdCustomDateStart ? cmdCustomDateStart.value : null;
      untilDate = (cmdCustomDateEnd && cmdCustomDateEnd.value) ? cmdCustomDateEnd.value : null;
    } else {
      sinceDate = state.cycleStart || null;
    }

    try {
      const res = await fetch('/api/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sinceDate, untilDate }),
      });
      const data = await res.json();
      if (data.success) {
        if (rescanProgressText) rescanProgressText.textContent = 'Mensagens analisadas com sucesso!';
        setTimeout(() => {
          if (rescanConfirmModal) rescanConfirmModal.classList.remove('active');
          showToast('🟢 Reprocessamento concluído.', 'success');
          fetchStatus();
          fetchHistory();
          fetchApprovals();
          fetchLogs();
        }, 1100);
      } else {
        if (rescanProgressBox) rescanProgressBox.style.display = 'none';
        if (rescanModalFooter) rescanModalFooter.style.display = 'flex';
        showToast(data.message || 'Erro durante o reprocessamento.', 'error');
      }
    } catch (err) {
      if (rescanProgressBox) rescanProgressBox.style.display = 'none';
      if (rescanModalFooter) rescanModalFooter.style.display = 'flex';
      showToast('Erro de comunicação: ' + err.message, 'error');
    }
  });
}

// ── Google Sheets: Teste de Conexão ───────────────────────────────────────
if (btnCmdSyncSheets) {
  btnCmdSyncSheets.addEventListener('click', async () => {
    btnCmdSyncSheets.disabled = true;
    showToast('🔄 Testando conexão...', 'info');
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('🟢 Conexão realizada com sucesso.', 'success');
        fetchStatus();
      } else {
        showToast(data.message || 'Falha ao conectar com Google Sheets', 'error');
      }
    } catch (err) {
      showToast('Falha na sincronização: ' + err.message, 'error');
    } finally {
      btnCmdSyncSheets.disabled = false;
    }
  });
}

if (btnCmdRecalcCosts) {
  btnCmdRecalcCosts.addEventListener('click', async () => {
    const defaultTab = 'SETEMBRO 2026';
    const targetTab = prompt('Informe a aba da planilha para recalcular custos e veículos (ex: SETEMBRO 2026 ou OUTUBRO 2026):', defaultTab);
    if (!targetTab) return;

    btnCmdRecalcCosts.disabled = true;
    showToast(`🔄 Recalculando custos e agrupamentos na aba "${targetTab}"...`, 'info');
    try {
      const res = await fetch('/api/recalculate-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: targetTab }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🟢 ${data.message}`, 'success');
        fetchStatus();
      } else {
        showToast(data.message || 'Erro ao recalcular custos.', 'error');
      }
    } catch (err) {
      showToast('Falha na comunicação: ' + err.message, 'error');
    } finally {
      btnCmdRecalcCosts.disabled = false;
    }
  });
}

// ── Manutenção e Limpeza com Modal de Confirmação ───────────────────────────
let activeCleanAction = null;

if (btnOpenClearLogsModal) {
  btnOpenClearLogsModal.addEventListener('click', () => {
    activeCleanAction = 'logs';
    if (cleanModalDesc) {
      cleanModalDesc.textContent = 'Deseja realmente limpar o arquivo de logs do sistema em disco? Essa ação liberará espaço em armazenamento.';
    }
    if (cleanConfirmModal) cleanConfirmModal.classList.add('active');
  });
}

if (btnOpenClearTermModal) {
  btnOpenClearTermModal.addEventListener('click', () => {
    activeCleanAction = 'terminal';
    if (cleanModalDesc) {
      cleanModalDesc.textContent = 'Deseja realmente limpar a visualização do terminal? O arquivo de logs em disco permanecerá preservado.';
    }
    if (cleanConfirmModal) cleanConfirmModal.classList.add('active');
  });
}

if (btnCloseCleanModal) {
  btnCloseCleanModal.addEventListener('click', () => {
    if (cleanConfirmModal) cleanConfirmModal.classList.remove('active');
  });
}
if (btnCancelCleanModal) {
  btnCancelCleanModal.addEventListener('click', () => {
    if (cleanConfirmModal) cleanConfirmModal.classList.remove('active');
  });
}

if (btnConfirmCleanModal) {
  btnConfirmCleanModal.addEventListener('click', async () => {
    if (cleanConfirmModal) cleanConfirmModal.classList.remove('active');
    if (activeCleanAction === 'logs') {
      try {
        const res = await fetch('/api/clear-logs', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('🟢 Logs do sistema limpos com sucesso.', 'success');
          fetchLogs();
          fetchStatus();
        } else {
          showToast(data.message || 'Falha ao limpar logs.', 'error');
        }
      } catch (err) {
        showToast('Erro ao limpar logs: ' + err.message, 'error');
      }
    } else if (activeCleanAction === 'terminal') {
      state.logsRaw = [];
      renderLogs();
      if (maintTermLines) maintTermLines.textContent = '0 linhas';
      showToast('🟢 Visualização do terminal limpa.', 'info');
    }
  });
}

// ==========================================================================
//  PAINEL DE TRANSPARÊNCIA & MEMÓRIA DE CÁLCULO
// ==========================================================================
state.transparencyTab = '';
state.transparencyItems = [];
state.transparencyStats = null;
state.transparencyFilter = 'TODOS';
state.transparencySearch = '';

// DOM Elements: Transparency
const transparencyTabSelect = document.getElementById('transparencyTabSelect');
const btnRefreshTransparency = document.getElementById('btnRefreshTransparency');
const transpTotalCount = document.getElementById('transpTotalCount');
const transpTotalCost = document.getElementById('transpTotalCost');
const transpGroupedCount = document.getElementById('transpGroupedCount');
const transpGroupedPercent = document.getElementById('transpGroupedPercent');
const transpAvgCars = document.getElementById('transpAvgCars');
const btnFilterTranspAll = document.getElementById('btnFilterTranspAll');
const btnFilterTranspGrouped = document.getElementById('btnFilterTranspGrouped');
const btnFilterTranspSingle = document.getElementById('btnFilterTranspSingle');
const transparencySearchInput = document.getElementById('transparencySearchInput');
const transparencyTableBody = document.getElementById('transparencyTableBody');

// Route Edit Modal Elements
const routeEditModal = document.getElementById('routeEditModal');
const modalRouteSubtitle = document.getElementById('modalRouteSubtitle');
const modalRouteRowNumber = document.getElementById('modalRouteRowNumber');
const modalRouteTabName = document.getElementById('modalRouteTabName');
const modalRouteDate = document.getElementById('modalRouteDate');
const modalRouteCar = document.getElementById('modalRouteCar');
const modalRoutePlate = document.getElementById('modalRoutePlate');
const inputOrigem = document.getElementById('inputOrigem');
const inputDestino = document.getElementById('inputDestino');
const routePreviewPath = document.getElementById('routePreviewPath');
const routePreviewDesc = document.getElementById('routePreviewDesc');
const btnCloseRouteModal = document.getElementById('btnCloseRouteModal');
const btnCancelRouteModal = document.getElementById('btnCancelRouteModal');
const btnSaveRouteModal = document.getElementById('btnSaveRouteModal');

// Helper de detecção rápida de cidade para o preview no front-end
function detectCityPreview(name) {
  if (!name) return 'Desconhecido';
  const u = name.toUpperCase();
  if (u.includes('VALINHOS') || u.includes('VAL')) return 'Valinhos';
  if (u.includes('VINHEDO') || u.includes('VIN')) return 'Vinhedo';
  if (u.includes('CAMPINAS') || u.includes('DOM PEDRO') || u.includes('CASTELO') || u.includes('CPS') || u.includes('ASSINATURA') || u.includes('EXPRESS')) return 'Campinas';
  if (u.includes('SAO JOAO') || u.includes('SÃO JOÃO') || u.includes('SJBV') || u.includes('SJ')) return 'São João da Boa Vista';
  if (u.includes('GUACU') || u.includes('GUAÇU') || u.includes('HYMAX') || u.includes('MG')) return 'Mogi Guaçu';
  if (u.includes('POSSE')) return 'Santo Antônio de Posse';
  if (u.includes('INDAIATUBA') || u.includes('INDAIA')) return 'Indaiatuba';
  if (u.includes('ITAPIRA') || u.includes('ITA')) return 'Itapira';
  if (u.includes('MOGI') || u.includes('MM') || u.includes('DIVEM') || u.includes('KENTO') || u.includes('KODYVE') || u.includes('XIAN') || u.includes('SERVICE') || u.includes('PERFEITO') || u.includes('TYREPLUS') || u.includes('BUSINESS')) return 'Mogi Mirim';
  return name.trim();
}

const HIGHWAY_DISTANCES_CLIENT = {
  'MOGI MIRIM|MOGI GUAÇU': 14,
  'MOGI MIRIM|CAMPINAS': 68,
  'MOGI MIRIM|VALINHOS': 76,
  'MOGI MIRIM|VINHEDO': 84,
  'MOGI MIRIM|SJBV': 72,
  'MOGI MIRIM|SANTO ANTÔNIO DE POSSE': 22,
  'MOGI MIRIM|ITAPIRA': 32,
  'MOGI MIRIM|INDAIATUBA': 92,
  'MOGI GUAÇU|CAMPINAS': 75,
  'MOGI GUAÇU|VALINHOS': 82,
  'MOGI GUAÇU|VINHEDO': 90,
  'MOGI GUAÇU|SJBV': 62,
  'CAMPINAS|VALINHOS': 14,
  'CAMPINAS|VINHEDO': 22,
  'CAMPINAS|SJBV': 138,
  'VALINHOS|VINHEDO': 10,
  'VALINHOS|SJBV': 145,
  'VINHEDO|SJBV': 152,
};

function getClientDistanceKm(c1, c2) {
  if (!c1 || !c2) return 0;
  if (c1 === c2) return 8;
  const k1 = `${c1}|${c2}`;
  const k2 = `${c2}|${c1}`;
  return HIGHWAY_DISTANCES_CLIENT[k1] || HIGHWAY_DISTANCES_CLIENT[k2] || 45;
}

function updateRoutePreview() {
  if (!inputOrigem || !inputDestino || !routePreviewPath) return;
  const oVal = inputOrigem.value.trim();
  const dVal = inputDestino.value.trim();

  if (!oVal && !dVal) {
    routePreviewPath.textContent = '-- ➔ --';
    routePreviewDesc.textContent = 'Informe o local de saída e de chegada para calcular a rota.';
    return;
  }

  const cOrigem = detectCityPreview(oVal);
  const cDestino = detectCityPreview(dVal);

  routePreviewPath.innerHTML = `<strong>${escapeHtml(oVal || '?')}</strong> (${cOrigem}) ➔ <strong>${escapeHtml(dVal || '?')}</strong> (${cDestino})`;

  const cO = cOrigem.toUpperCase();
  const cD = cDestino.toUpperCase();

  let codeO = cO;
  if (cO.includes('SAO JOAO') || cO.includes('SÃO JOÃO')) codeO = 'SJBV';
  let codeD = cD;
  if (cD.includes('SAO JOAO') || cD.includes('SÃO JOÃO')) codeD = 'SJBV';

  const km = getClientDistanceKm(codeO, codeD);

  routePreviewPath.innerHTML = `<strong>${escapeHtml(oVal || '?')}</strong> (${cOrigem}) ➔ <strong>${escapeHtml(dVal || '?')}</strong> (${cDestino}) &nbsp;•&nbsp; <span class="km-badge">🛣️ ${km} km</span>`;

  let motivoValorHtml = '';
  let motivoCalcHtml = '<strong>Motivo do Cálculo:</strong> Os custos unitários serão recalculados com base no agrupamento de veículos da mesma data.';

  if (cO === cD) {
    routePreviewDesc.innerHTML = '🎯 <strong>Viagem Local (Mesma Cidade):</strong> Tabela fixa em <strong>R$ 180,00</strong> por transporte.';
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela fixa em <strong>R$ 180,00</strong> para deslocamento local (~' + km + ' km).';
  } else if ((cO.includes('MOGI MIRIM') && cD.includes('MOGI GUA')) || (cO.includes('MOGI GUA') && cD.includes('MOGI MIRIM'))) {
    routePreviewDesc.innerHTML = '🎯 <strong>Rota Mogi Mirim ⟷ Mogi Guaçu:</strong> Tabela intermunicipal curta em <strong>R$ 180,00</strong> por transporte.';
  } else if ((cO.includes('MOGI') && cD.includes('SAO JOAO')) || (cO.includes('SAO JOAO') && cD.includes('MOGI'))) {
    routePreviewDesc.innerHTML = '🚛 <strong>Rota Mogi ⟷ São João da Boa Vista:</strong> Custo total da prancha em <strong>R$ 900,00</strong> (rateado igualmente entre os carros que viajarem na mesma data).';
  } else if ((cO.includes('CAMPINAS') || cO.includes('VALINHOS') || cO.includes('VINHEDO')) && (cD.includes('SAO JOAO') || cD.includes('SÃO JOÃO')) ||
             (cD.includes('CAMPINAS') || cD.includes('VALINHOS') || cD.includes('VINHEDO')) && (cO.includes('SAO JOAO') || cO.includes('SÃO JOÃO'))) {
    routePreviewDesc.innerHTML = '🚛 <strong>Rota Região Campinas ⟷ São João da Boa Vista:</strong> Custo total da prancha em <strong>R$ 900,00</strong> (rateado entre carros da mesma data).';
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela intermunicipal curta em <strong>R$ 180,00</strong> entre Mogi Mirim e Mogi Guaçu (~' + km + ' km).';
  } else if ((cO.includes('MOGI') && (cD.includes('SAO JOAO') || cD.includes('SJBV'))) || ((cO.includes('SAO JOAO') || cO.includes('SJBV')) && cD.includes('MOGI'))) {
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela oficial Grupo Hazul para São João da Boa Vista (~' + km + ' km). Custo base da prancha: <strong>R$ 900,00</strong>.';
    motivoCalcHtml = '<strong>Motivo do Cálculo:</strong> O custo de R$ 900,00 da prancha será rateado igualmente entre os veículos que viajarem na mesma data.';
  } else if ((cO.includes('CAMPINAS') || cO.includes('VALINHOS') || cO.includes('VINHEDO')) && (cD.includes('SAO JOAO') || cD.includes('SJBV')) ||
             (cD.includes('CAMPINAS') || cD.includes('VALINHOS') || cD.includes('VINHEDO')) && (cO.includes('SAO JOAO') || cO.includes('SJBV'))) {
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela Grupo Hazul para Região de Campinas ⟷ São João da Boa Vista (~' + km + ' km). Custo base da prancha: <strong>R$ 900,00</strong>.';
    motivoCalcHtml = '<strong>Motivo do Cálculo:</strong> Rateio do custo total entre os veículos agrupados na mesma data.';
  } else if ((cO.includes('MOGI') && (cD.includes('CAMPINAS') || cD.includes('VALINHOS') || cD.includes('VINHEDO'))) ||
             (cD.includes('MOGI') && (cO.includes('CAMPINAS') || cO.includes('VALINHOS') || cO.includes('VINHEDO')))) {
    routePreviewDesc.innerHTML = '🚛 <strong>Rota Mogi ⟷ Região Campinas/Valinhos/Vinhedo:</strong> Custo total da prancha em <strong>R$ 500,00</strong> (rateado igualmente entre os carros que viajarem na mesma data).';
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela oficial Grupo Hazul para Região de Campinas / Valinhos / Vinhedo (~' + km + ' km). Custo base da prancha: <strong>R$ 500,00</strong>.';
    motivoCalcHtml = '<strong>Motivo do Cálculo:</strong> O custo de R$ 500,00 da prancha será rateado igualmente entre os carros que viajarem na mesma data.';
  } else {
    routePreviewDesc.innerHTML = 'ℹ️ <strong>Rota com Custo Personalizado:</strong> O bot recalculará o valor da prancha e dividirá pela quantidade de veículos transportados na data.';
    motivoValorHtml = '<strong>Motivo do Valor Inserido:</strong> Tabela de custo proporcional rodoviário (~' + km + ' km).';
  }

  routePreviewDesc.innerHTML = `<div style="display:flex; flex-direction:column; gap:4px;"><div>${motivoValorHtml}</div><div>${motivoCalcHtml}</div></div>`;
}

async function fetchTransparency(tabName) {
  try {
    const activeTabToUse = tabName || state.transparencyTab || state.activeSheetTab || '';
    const url = activeTabToUse ? `/api/transparency?tab=${encodeURIComponent(activeTabToUse)}` : '/api/transparency';
    
    if (transparencyTableBody) {
      transparencyTableBody.innerHTML = `<tr><td colspan="8" class="table-state-cell">Carregando dados da aba ${escapeHtml(activeTabToUse || 'ativa')}...</td></tr>`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      if (transparencyTableBody) {
        transparencyTableBody.innerHTML = `<tr><td colspan="8" class="table-state-cell text-danger">Erro ao carregar transparência: ${escapeHtml(data.error || 'Falha de comunicação')}</td></tr>`;
      }
      return;
    }

    state.transparencyTab = data.sheetName;
    state.transparencyItems = data.transports || [];
    state.transparencyStats = data.stats || null;

    // Preencher select de abas
    if (transparencyTabSelect && Array.isArray(data.availableMonthTabs) && data.availableMonthTabs.length > 0) {
      transparencyTabSelect.innerHTML = data.availableMonthTabs.map(tab => 
        `<option value="${escapeHtml(tab)}" ${tab === data.sheetName ? 'selected' : ''}>${escapeHtml(tab)}</option>`
      ).join('');
    }

    // Atualizar métricas
    if (data.stats) {
      if (transpTotalCount) transpTotalCount.textContent = data.stats.totalTrips || data.stats.totalViagens || 0;
      if (transpTotalCost) {
        transpTotalCost.textContent = data.stats.totalCostFormatted || ('R$ ' + (data.stats.custoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      if (transpGroupedCount) transpGroupedCount.textContent = data.stats.sharedVehiclesCount || data.stats.veiculosCompartilhados || 0;
      if (transpGroupedPercent) {
        const shared = data.stats.sharedVehiclesCount || data.stats.veiculosCompartilhados || 0;
        const total = data.stats.totalTrips || data.stats.totalViagens || 0;
        transpGroupedPercent.textContent = `${shared} de ${total} fretes em viagens compartilhadas`;
      }
      if (transpAvgCars) {
        const avg = parseFloat(data.stats.avgVehiclesPerTrip || data.stats.mediaCarrosPorViagem || 1.0);
        transpAvgCars.textContent = avg.toFixed(1);
      }
    }

    renderTransparency();

  } catch (err) {
    console.error('Erro em fetchTransparency:', err);
    if (transparencyTableBody) {
      transparencyTableBody.innerHTML = `<tr><td colspan="10" class="table-state-cell text-danger">Falha na requisição de transparência: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function renderTransparency() {
  if (!transparencyTableBody) return;

  const items = state.transparencyItems || [];
  const filter = state.transparencyFilter || 'TODOS';
  const search = (state.transparencySearch || '').toLowerCase().trim();

  const filtered = items.filter(item => {
    const vCount = item.veicPorViagem || item.veiculosPorViagem || 1;
    // Filtro por tipo de rateio
    if (filter === 'COMPARTILHADO') {
      if (vCount <= 1) return false;
    } else if (filter === 'INDIVIDUAL') {
      if (vCount > 1) return false;
    }

    // Filtro de busca textual
    if (search) {
      const matchText = [
        item.carro,
        item.veiculo,
        item.placa,
        item.chassi,
        item.coleta,
        item.origem,
        item.entrega,
        item.destino,
        item.origemCity,
        item.origemCidade,
        item.destinoCity,
        item.destinoCidade,
        item.data,
        item.motivoTitulo,
        item.motivoDetalhe,
        String(item.rowNumber)
      ].join(' ').toLowerCase();

      if (!matchText.includes(search)) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    transparencyTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="table-state-cell">
          Nenhum agendamento encontrado para o filtro selecionado na aba <strong>${escapeHtml(state.transparencyTab)}</strong>.
        </td>
      </tr>
    `;
    return;
  }

  transparencyTableBody.innerHTML = filtered.map(item => {
    const veicName = item.carro || item.veiculo || 'Não informado';
    const placaChassi = item.placa || item.chassi || '--';
    const origemName = item.coleta || item.origem || '--';
    const destinoName = item.entrega || item.destino || '--';
    const origemCity = item.origemCity || item.origemCidade || '';
    const destinoCity = item.destinoCity || item.destinoCidade || '';
    const vCount = item.veicPorViagem || item.veiculosPorViagem || 1;
    const isGrouped = vCount > 1;
    const km = item.distanciaKm || 0;

    const custoUnitStr = item.custoUnit || (typeof item.numCustoUnit === 'number' ? 'R$ ' + item.numCustoUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (item.custoUnitario ? 'R$ ' + item.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'));
    const custoViagemStr = item.custoViagem || (item.custoTotalViagem ? 'R$ ' + item.custoTotalViagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--');

    const motivoValorBadge = item.motivoValorBadge || 'Tabela Cegonha';
    const motivoValorText = item.motivoValor || item.motivoValorCurto || 'Valor registrado na planilha';

    const motivoCalcBadge = item.motivoCalculoBadge || (isGrouped ? `Rateio (${vCount} veículos)` : 'Frete Exclusivo (1 carro)');
    const motivoCalcText = item.motivoCalculo || item.motivoCalculoCurto || (isGrouped ? `Rateio entre ${vCount} veículos da mesma data` : 'Custo integral atribuído ao único veículo');

    return `
      <tr>
        <td style="text-align: center; font-weight: 600; color: var(--text-muted);">#${item.rowNumber}</td>
        <td style="font-weight: 500; font-size: 0.8125rem;">${escapeHtml(item.data || '--')}</td>
        <td>
          <div style="font-weight: 600; font-size: 0.8125rem; color: var(--text-primary);">${escapeHtml(veicName)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(placaChassi)}</div>
        </td>
        <td>
          <div class="route-cell">
            <span class="route-badge origem">📍 ${escapeHtml(origemName)}</span>
            ${origemCity ? `<span class="route-badge-city">Base: ${escapeHtml(origemCity)}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="route-cell">
            <span class="route-badge destino">🏁 ${escapeHtml(destinoName)}</span>
            ${destinoCity ? `<span class="route-badge-city">Base: ${escapeHtml(destinoCity)}</span>` : ''}
          </div>
        </td>
        <td style="text-align: center;">
          <span class="km-badge">🛣️ ${km} km</span>
        </td>
        <td>
          <div class="reason-box">
            <span class="reason-badge value-badge">${escapeHtml(motivoValorBadge)}</span>
            <span class="reason-text">${escapeHtml(motivoValorText)}</span>
          </div>
        </td>
        <td>
          <div class="reason-box">
            <span class="reason-badge ${isGrouped ? 'calc-badge' : 'single-badge'}">${escapeHtml(motivoCalcBadge)}</span>
            <span class="reason-text">${escapeHtml(motivoCalcText)}</span>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="unit-cost-val">${escapeHtml(custoUnitStr)}</div>
          <div class="total-cost-sub">Total: ${escapeHtml(custoViagemStr)}</div>
        </td>
        <td style="text-align: center;">
          <button class="btn-edit-route" data-row="${item.rowNumber}" title="Alterar rota do transporte">
            ✏️ Alterar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openRouteEditModal(item) {
  if (!item || !routeEditModal) return;

  modalRouteRowNumber.value = item.rowNumber;
  modalRouteTabName.value = item.tabName || state.transparencyTab;
  modalRouteSubtitle.textContent = `Linha #${item.rowNumber} • Aba ${item.tabName || state.transparencyTab}`;

  modalRouteDate.textContent = item.data || '--';
  modalRouteCar.textContent = item.carro || item.veiculo || '--';
  modalRoutePlate.textContent = item.placa || item.chassi || '--';

  inputOrigem.value = item.coleta || item.origem || '';
  inputDestino.value = item.entrega || item.destino || '';

  updateRoutePreview();

  routeEditModal.classList.add('active');
  routeEditModal.setAttribute('aria-hidden', 'false');
  inputOrigem.focus();
}

function closeRouteEditModal() {
  if (!routeEditModal) return;
  routeEditModal.classList.remove('active');
  routeEditModal.setAttribute('aria-hidden', 'true');
}

async function saveRouteEdit() {
  const rowNumber = parseInt(modalRouteRowNumber.value, 10);
  const tab = modalRouteTabName.value || state.transparencyTab;
  const origem = inputOrigem.value.trim();
  const destino = inputDestino.value.trim();

  if (!rowNumber || isNaN(rowNumber)) {
    showToast('Número da linha inválido.', 'error');
    return;
  }
  if (!origem || !destino) {
    showToast('Informe tanto o local de saída quanto o de chegada.', 'warn');
    return;
  }

  const originalBtnHtml = btnSaveRouteModal.innerHTML;
  btnSaveRouteModal.disabled = true;
  btnSaveRouteModal.innerHTML = 'Salvando e recalculando...';

  try {
    const res = await fetch('/api/transports/update-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, rowNumber, origem, destino }),
    });

    const data = await res.json();

    if (data.success) {
      showToast(`🟢 Rota atualizada na planilha (Linha #${rowNumber})!`, 'success');
      closeRouteEditModal();
      await fetchTransparency(tab);
      fetchHistory(); // Atualiza histórico se visível
    } else {
      showToast(data.error || 'Erro ao atualizar rota na planilha.', 'error');
    }
  } catch (err) {
    console.error('Erro ao salvar rota:', err);
    showToast('Falha na comunicação ao atualizar rota: ' + err.message, 'error');
  } finally {
    btnSaveRouteModal.disabled = false;
    btnSaveRouteModal.innerHTML = originalBtnHtml;
  }
}

// Event Listeners: Transparência
if (transparencyTabSelect) {
  transparencyTabSelect.addEventListener('change', () => {
    fetchTransparency(transparencyTabSelect.value);
  });
}

if (btnRefreshTransparency) {
  btnRefreshTransparency.addEventListener('click', () => {
    fetchTransparency(transparencyTabSelect ? transparencyTabSelect.value : '');
  });
}

if (transparencySearchInput) {
  transparencySearchInput.addEventListener('input', (e) => {
    state.transparencySearch = e.target.value;
    renderTransparency();
  });
}

if (btnFilterTranspAll) {
  btnFilterTranspAll.addEventListener('click', () => {
    state.transparencyFilter = 'TODOS';
    btnFilterTranspAll.classList.add('active');
    btnFilterTranspGrouped.classList.remove('active');
    btnFilterTranspSingle.classList.remove('active');
    renderTransparency();
  });
}

if (btnFilterTranspGrouped) {
  btnFilterTranspGrouped.addEventListener('click', () => {
    state.transparencyFilter = 'COMPARTILHADO';
    btnFilterTranspGrouped.classList.add('active');
    btnFilterTranspAll.classList.remove('active');
    btnFilterTranspSingle.classList.remove('active');
    renderTransparency();
  });
}

if (btnFilterTranspSingle) {
  btnFilterTranspSingle.addEventListener('click', () => {
    state.transparencyFilter = 'INDIVIDUAL';
    btnFilterTranspSingle.classList.add('active');
    btnFilterTranspAll.classList.remove('active');
    btnFilterTranspGrouped.classList.remove('active');
    renderTransparency();
  });
}

if (transparencyTableBody) {
  transparencyTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit-route');
    if (!btn) return;
    const rowNum = parseInt(btn.dataset.row, 10);
    const item = state.transparencyItems.find(i => i.rowNumber === rowNum);
    if (item) {
      openRouteEditModal(item);
    }
  });
}

if (btnCloseRouteModal) btnCloseRouteModal.addEventListener('click', closeRouteEditModal);
if (btnCancelRouteModal) btnCancelRouteModal.addEventListener('click', closeRouteEditModal);
if (btnSaveRouteModal) btnSaveRouteModal.addEventListener('click', saveRouteEdit);

if (inputOrigem) inputOrigem.addEventListener('input', updateRoutePreview);
if (inputDestino) inputDestino.addEventListener('input', updateRoutePreview);

// Fechamento de modais ao clicar no backdrop escuro
window.addEventListener('click', (e) => {
  if (rescanConfirmModal && e.target === rescanConfirmModal) {
    rescanConfirmModal.classList.remove('active');
  }
  if (cleanConfirmModal && e.target === cleanConfirmModal) {
    cleanConfirmModal.classList.remove('active');
  }
  if (approvalModal && e.target === approvalModal) {
    approvalModal.classList.remove('active');
  }
  if (routeEditModal && e.target === routeEditModal) {
    routeEditModal.classList.remove('active');
  }
});

// ── Inicialização e Ciclos de Polling ──────────────────────────────────────
initTheme();
fetchStatus();
fetchHistory();
fetchApprovals();
fetchLogs();

// Polling suave: Status a cada 3.5s, logs a cada 4s, aprovações a cada 5s, histórico a cada 10s
setInterval(fetchStatus, 3500);
setInterval(fetchLogs, 4000);
setInterval(fetchApprovals, 5000);
setInterval(fetchHistory, 10000);
