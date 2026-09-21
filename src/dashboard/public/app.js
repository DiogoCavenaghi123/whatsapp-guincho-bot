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
};

// ── Elementos DOM ────────────────────────────────────────────────────────
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const themeToggle = document.getElementById('themeToggle');

// Connection badge
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const latencyTag = document.getElementById('latencyTag');

// Metric cards (Overview)
const cardBotStatus = document.getElementById('cardBotStatus');
const cardBotPid = document.getElementById('cardBotPid');
const cardRamUsage = document.getElementById('cardRamUsage');
const cardRamHeap = document.getElementById('cardRamHeap');
const cardUptime = document.getElementById('cardUptime');
const cardTotalLidas = document.getElementById('cardTotalLidas');
const cardAgendamentos = document.getElementById('cardAgendamentos');
const cardDuplicatesHint = document.getElementById('cardDuplicatesHint');
const cardActiveTab = document.getElementById('cardActiveTab');
const cardCycleRange = document.getElementById('cardCycleRange');

// Overview: History & Filters
const historyTableBody = document.getElementById('historyTableBody');
const overviewSearchInput = document.getElementById('overviewSearchInput');
const btnOverviewSearch = document.getElementById('btnOverviewSearch');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const paginationLabel = document.getElementById('paginationLabel');
const btnQuickRescan = document.getElementById('btnQuickRescan');

// Commands View
const cmdProcessBadge = document.getElementById('cmdProcessBadge');
const cmdProcessStatus = document.getElementById('cmdProcessStatus');
const cmdProcessPid = document.getElementById('cmdProcessPid');
const btnCmdStart = document.getElementById('btnCmdStart');
const btnCmdStop = document.getElementById('btnCmdStop');
const radioCycle = document.getElementById('radioCycle');
const radioCustom = document.getElementById('radioCustom');
const customDateContainer = document.getElementById('customDateContainer');
const cmdCustomDate = document.getElementById('cmdCustomDate');
const cmdCycleHelp = document.getElementById('cmdCycleHelp');
const btnCmdRescan = document.getElementById('btnCmdRescan');
const btnCmdSyncSheets = document.getElementById('btnCmdSyncSheets');
const btnCmdClearLogs = document.getElementById('btnCmdClearLogs');

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

    // Conexão Header
    if (data.running) {
      statusDot.className = 'status-pulse-dot online';
      statusLabel.textContent = 'Online';
      cardBotStatus.textContent = 'Ativo';
      cardBotStatus.className = 'metric-number text-success';
      cardBotPid.textContent = `PID: ${data.pid || '--'}`;

      // Comandos view
      cmdProcessBadge.className = 'badge badge-success';
      cmdProcessBadge.textContent = 'Em Execução';
      cmdProcessStatus.textContent = 'Ativo';
      cmdProcessStatus.className = 'summary-val text-success';
      cmdProcessPid.textContent = data.pid || '--';
      btnCmdStart.disabled = true;
      btnCmdStop.disabled = false;
      btnCmdRescan.disabled = false;
    } else {
      statusDot.className = 'status-pulse-dot offline';
      statusLabel.textContent = 'Parado';
      cardBotStatus.textContent = 'Parado';
      cardBotStatus.className = 'metric-number';
      cardBotPid.textContent = 'Bot inativo';

      // Comandos view
      cmdProcessBadge.className = 'badge badge-muted';
      cmdProcessBadge.textContent = 'Parado';
      cmdProcessStatus.textContent = 'Inativo';
      cmdProcessStatus.className = 'summary-val text-muted';
      cmdProcessPid.textContent = '--';
      btnCmdStart.disabled = false;
      btnCmdStop.disabled = true;
      btnCmdRescan.disabled = true;
    }

    // Métricas
    if (data.stats) {
      cardTotalLidas.textContent = data.stats.totalLidas || 0;
      cardAgendamentos.textContent = data.stats.agendamentos || 0;
      cardDuplicatesHint.textContent = `Duplicados prevenidos: ${data.stats.duplicados || 0}`;
    }

    if (data.activeTab) {
      cardActiveTab.textContent = data.activeTab;
      cardCycleRange.textContent = `Ciclo: ${data.cycleRange || ''}`;
      cmdCycleHelp.textContent = `Aba: ${data.activeTab} (${data.cycleRange || ''})`;
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
      let badgeHtml = '<span class="badge badge-muted">Descartado</span>';
      if (item.status === 'AGENDAMENTO') {
        badgeHtml = '<span class="badge badge-success">Agendamento</span>';
      } else if (item.status === 'DUPLICADO') {
        badgeHtml = '<span class="badge badge-warning">Duplicado</span>';
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
});

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
  showToast('Iniciando bot em segundo plano...', 'info');
  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'warn');
    setTimeout(fetchStatus, 1500);
    setTimeout(fetchLogs, 1500);
  } catch (err) {
    showToast('Erro ao iniciar bot: ' + err.message, 'error');
  } finally {
    btnCmdStart.disabled = false;
  }
});

btnCmdStop.addEventListener('click', async () => {
  if (!confirm('Deseja realmente parar o WhatsApp Guincho Bot?')) return;
  btnCmdStop.disabled = true;
  showToast('Finalizando processo do bot...', 'warn');
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'warn');
    setTimeout(fetchStatus, 1500);
    setTimeout(fetchLogs, 1500);
  } catch (err) {
    showToast('Erro ao parar bot: ' + err.message, 'error');
  } finally {
    btnCmdStop.disabled = false;
  }
});

// Releitura options
radioCycle.addEventListener('change', () => {
  customDateContainer.style.display = 'none';
});

radioCustom.addEventListener('change', () => {
  customDateContainer.style.display = 'flex';
  if (!cmdCustomDate.value) {
    const today = new Date().toISOString().split('T')[0];
    cmdCustomDate.value = today;
  }
});

btnCmdRescan.addEventListener('click', async () => {
  if (!state.isBotRunning) {
    showToast('O bot precisa estar em execução para ler o grupo.', 'error');
    return;
  }

  let sinceDate = null;
  if (radioCustom.checked) {
    if (!cmdCustomDate.value) {
      showToast('Por favor, selecione a data inicial.', 'warn');
      return;
    }
    sinceDate = cmdCustomDate.value;
  }

  btnCmdRescan.disabled = true;
  showToast('Enviando comando de releitura...', 'info');

  try {
    const res = await fetch('/api/rescan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinceDate }),
    });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    setTimeout(fetchLogs, 1500);
  } catch (err) {
    showToast('Erro ao solicitar releitura: ' + err.message, 'error');
  } finally {
    btnCmdRescan.disabled = false;
  }
});

btnCmdSyncSheets.addEventListener('click', async () => {
  btnCmdSyncSheets.disabled = true;
  showToast('Testando conexão com Google Sheets...', 'info');
  try {
    const res = await fetch('/api/sync-sheets', { method: 'POST' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
  } catch (err) {
    showToast('Falha na sincronização: ' + err.message, 'error');
  } finally {
    btnCmdSyncSheets.disabled = false;
  }
});

btnCmdClearLogs.addEventListener('click', async () => {
  if (!confirm('Deseja realmente limpar os registros de log do terminal?')) return;
  try {
    const res = await fetch('/api/clear-logs', { method: 'POST' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    fetchLogs();
  } catch (err) {
    showToast('Erro ao limpar logs: ' + err.message, 'error');
  }
});

// ── Inicialização e Ciclos de Polling ──────────────────────────────────────
initTheme();
fetchStatus();
fetchHistory();
fetchLogs();

// Polling suave: Status a cada 3.5s, logs a cada 4s, histórico a cada 10s
setInterval(fetchStatus, 3500);
setInterval(fetchLogs, 4000);
setInterval(fetchHistory, 10000);
