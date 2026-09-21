// =============================================================
//  Dashboard Client App — Lógica do Painel de Controle
// =============================================================

let currentStatusFilter = 'TODOS';
let currentSearch = '';
let currentOffset = 0;
const LIMIT = 25;
let currentItems = [];

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnOpenRescan = document.getElementById('btnOpenRescan');

const statTotal = document.getElementById('statTotal');
const statAgendamentos = document.getElementById('statAgendamentos');
const statDuplicados = document.getElementById('statDuplicados');
const statDescartados = document.getElementById('statDescartados');
const statAba = document.getElementById('statAba');
const statCiclo = document.getElementById('statCiclo');

const historyTableBody = document.getElementById('historyTableBody');
const paginationInfo = document.getElementById('paginationInfo');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');

const logsContent = document.getElementById('logsContent');
const logsTerminal = document.getElementById('logsTerminal');
const chkAutoScroll = document.getElementById('chkAutoScroll');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');

// Modals
const rescanModal = document.getElementById('rescanModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelRescan = document.getElementById('btnCancelRescan');
const btnConfirmRescan = document.getElementById('btnConfirmRescan');
const customRescanDate = document.getElementById('customRescanDate');

const detailModal = document.getElementById('detailModal');
const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
const detailModalBody = document.getElementById('detailModalBody');

// ── Funções de API ───────────────────────────────────────────

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.running) {
      statusBadge.className = 'status-badge status-online';
      statusText.textContent = `Ativo (PID: ${data.pid})`;
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnOpenRescan.disabled = false;
    } else {
      statusBadge.className = 'status-badge status-offline';
      statusText.textContent = 'Parado';
      btnStart.disabled = false;
      btnStop.disabled = true;
      btnOpenRescan.disabled = true;
    }

    if (data.stats) {
      statTotal.textContent = data.stats.totalLidas || 0;
      statAgendamentos.textContent = data.stats.agendamentos || 0;
      statDuplicados.textContent = data.stats.duplicados || 0;
      statDescartados.textContent = data.stats.descartados || 0;
    }

    if (data.activeTab) {
      statAba.textContent = data.activeTab;
      statCiclo.textContent = `Ciclo: ${data.cycleRange || ''}`;
    }
  } catch (e) {
    statusBadge.className = 'status-badge status-offline';
    statusText.textContent = 'Servidor Indisponível';
  }
}

async function fetchHistory() {
  try {
    const params = new URLSearchParams({
      status: currentStatusFilter,
      search: currentSearch,
      limit: LIMIT,
      offset: currentOffset,
    });

    const res = await fetch(`/api/history?${params.toString()}`);
    const data = await res.json();
    currentItems = data.items || [];

    renderHistoryTable(data);
  } catch (e) {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Erro ao carregar histórico: ${e.message}</td></tr>`;
  }
}

function renderHistoryTable(data) {
  const items = data.items || [];
  const total = data.total || 0;

  if (items.length === 0) {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma mensagem encontrada para os filtros selecionados.</td></tr>`;
    paginationInfo.textContent = 'Mostrando 0 de 0 mensagens';
    btnPrevPage.disabled = true;
    btnNextPage.disabled = true;
    return;
  }

  historyTableBody.innerHTML = items
    .map((item, index) => {
      let badgeClass = 'badge-descartado';
      let badgeText = 'Descartado';

      if (item.status === 'AGENDAMENTO') {
        badgeClass = 'badge-agendamento';
        badgeText = 'Agendamento';
      } else if (item.status === 'DUPLICADO') {
        badgeClass = 'badge-duplicado';
        badgeText = 'Duplicado';
      }

      let detailsHtml = '';
      if (item.extractedData && item.extractedData.veiculo) {
        const d = item.extractedData;
        detailsHtml = `
          <div class="detail-highlight">🚗 ${escapeHtml(d.veiculo)} ${d.cor ? `(${escapeHtml(d.cor)})` : ''}</div>
          <div class="route-text">📍 ${escapeHtml(d.origem || 'N/D')} ➔ 🏁 ${escapeHtml(d.destino || 'N/D')}</div>
        `;
      } else {
        detailsHtml = `<div class="reason-text">${escapeHtml(item.reason || item.body.substring(0, 70))}</div>`;
      }

      return `
        <tr>
          <td><small>${escapeHtml(item.date)}</small></td>
          <td><strong>${escapeHtml(item.author || 'Grupo')}</strong></td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>${detailsHtml}</td>
          <td style="text-align: center;">
            <button class="btn btn-sm btn-outline" onclick="showDetailModal(${index})">Ver</button>
          </td>
        </tr>
      `;
    })
    .join('');

  const start = data.offset + 1;
  const end = Math.min(data.offset + data.limit, total);
  paginationInfo.textContent = `Mostrando ${start} a ${end} de ${total} mensagens`;

  btnPrevPage.disabled = data.offset <= 0;
  btnNextPage.disabled = data.offset + data.limit >= total;
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) return;
    const data = await res.json();
    if (data.lines && data.lines.length > 0) {
      logsContent.textContent = data.lines.join('\n');
    } else if (!logsContent.textContent) {
      logsContent.textContent = 'Nenhum log registrado ainda.';
    }

    if (chkAutoScroll.checked) {
      logsTerminal.scrollTop = logsTerminal.scrollHeight;
    }
  } catch (e) {
    if (!logsContent.textContent || logsContent.textContent.includes('Aguardando')) {
      logsContent.textContent = 'Aguardando conexão com o servidor do painel...';
    }
  }
}

// ── Ações dos Botões ─────────────────────────────────────────

btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  btnStart.innerHTML = '<span class="btn-icon">⏳</span> Iniciando...';
  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    setTimeout(fetchStatus, 2000);
  } catch (e) {
    alert('Erro ao iniciar bot: ' + e.message);
  } finally {
    btnStart.innerHTML = '<span class="btn-icon">▶</span> Iniciar Bot';
  }
});

btnStop.addEventListener('click', async () => {
  if (!confirm('Deseja realmente parar o WhatsApp Guincho Bot?')) return;

  btnStop.disabled = true;
  btnStop.innerHTML = '<span class="btn-icon">⏳</span> Parando...';
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    setTimeout(fetchStatus, 1500);
  } catch (e) {
    alert('Erro ao parar bot: ' + e.message);
  } finally {
    btnStop.innerHTML = '<span class="btn-icon">⏹</span> Parar Bot';
  }
});

// Releitura
btnOpenRescan.addEventListener('click', () => {
  rescanModal.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
  rescanModal.classList.remove('active');
});

btnCancelRescan.addEventListener('click', () => {
  rescanModal.classList.remove('active');
});

document.querySelectorAll('input[name="rescanOption"]').forEach((r) => {
  r.addEventListener('change', (e) => {
    customRescanDate.disabled = e.target.value !== 'custom';
  });
});

btnConfirmRescan.addEventListener('click', async () => {
  const isCustom = document.querySelector('input[name="rescanOption"]:checked').value === 'custom';
  let sinceDate = null;

  if (isCustom) {
    if (!customRescanDate.value) {
      alert('Selecione uma data para a releitura!');
      return;
    }
    sinceDate = customRescanDate.value;
  }

  btnConfirmRescan.disabled = true;
  btnConfirmRescan.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/rescan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinceDate }),
    });
    const data = await res.json();
    alert(data.message);
    rescanModal.classList.remove('active');
    setTimeout(fetchLogs, 1000);
  } catch (e) {
    alert('Erro ao disparar releitura: ' + e.message);
  } finally {
    btnConfirmRescan.disabled = false;
    btnConfirmRescan.textContent = 'Iniciar Releitura Agora';
  }
});

// Filtros de Histórico
document.querySelectorAll('.filter-tab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    e.target.classList.add('active');
    currentStatusFilter = e.target.dataset.status;
    currentOffset = 0;
    fetchHistory();
  });
});

btnSearch.addEventListener('click', () => {
  currentSearch = searchInput.value;
  currentOffset = 0;
  fetchHistory();
});

searchInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    currentSearch = searchInput.value;
    currentOffset = 0;
    fetchHistory();
  }
});

btnPrevPage.addEventListener('click', () => {
  if (currentOffset >= LIMIT) {
    currentOffset -= LIMIT;
    fetchHistory();
  }
});

btnNextPage.addEventListener('click', () => {
  currentOffset += LIMIT;
  fetchHistory();
});

btnRefreshLogs.addEventListener('click', fetchLogs);

// Modal de Detalhes
window.showDetailModal = function (index) {
  const item = currentItems[index];
  if (!item) return;

  let extHtml = '';
  if (item.extractedData) {
    const d = item.extractedData;
    extHtml = `
      <div class="detail-section">
        <h4>Dados Estruturados Extraídos</h4>
        <div class="fields-grid">
          <div class="field-item"><span>Veículo</span><strong>${escapeHtml(d.veiculo || '-')}</strong></div>
          <div class="field-item"><span>Cor</span><strong>${escapeHtml(d.cor || '-')}</strong></div>
          <div class="field-item"><span>Chassi / Placa</span><strong>${escapeHtml(d.chassiPlaca || '-')}</strong></div>
          <div class="field-item"><span>Departamento</span><strong>${escapeHtml(d.departamento || '-')}</strong></div>
          <div class="field-item"><span>Origem</span><strong>${escapeHtml(d.origem || '-')}</strong></div>
          <div class="field-item"><span>Destino</span><strong>${escapeHtml(d.destino || '-')}</strong></div>
          <div class="field-item"><span>Transporte</span><strong>${escapeHtml(d.transporte || 'PLATAFORMA')}</strong></div>
          <div class="field-item"><span>Nota Fiscal</span><strong>${escapeHtml(d.faturarPara || '-')}</strong></div>
          <div class="field-item"><span>Data Agendada</span><strong>${escapeHtml(d.agendarPara || '-')}</strong></div>
        </div>
      </div>
    `;
  }

  detailModalBody.innerHTML = `
    <div class="detail-section">
      <h4>Status da Classificação</h4>
      <p><strong>${escapeHtml(item.status)}</strong> — <span class="reason-text">${escapeHtml(item.reason || '')}</span></p>
      <p style="margin-top: 4px;"><small>Recebida em: ${escapeHtml(item.date)} | Remetente: ${escapeHtml(item.author || '')}</small></p>
    </div>

    ${extHtml}

    <div class="detail-section">
      <h4>Texto Original da Mensagem</h4>
      <div class="raw-message-box">${escapeHtml(item.body)}</div>
    </div>
  `;

  detailModal.classList.add('active');
};

btnCloseDetailModal.addEventListener('click', () => {
  detailModal.classList.remove('active');
});

// Fechar modal ao clicar fora
window.addEventListener('click', (e) => {
  if (e.target === rescanModal) rescanModal.classList.remove('active');
  if (e.target === detailModal) detailModal.classList.remove('active');
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Inicialização & Polling Automático ────────────────────────
fetchStatus();
fetchHistory();
fetchLogs();

// Atualiza status e logs a cada 4 segundos
setInterval(() => {
  fetchStatus();
  fetchLogs();
}, 4000);

// Atualiza histórico a cada 10 segundos
setInterval(fetchHistory, 10000);

