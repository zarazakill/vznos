// Список вкладок приложения — используется для назначения прав пользователям.
// Объявлено в самом начале script, т.к. блок авторизации ниже уже использует ALL_TAB_IDS.
const ALL_TABS = [
    { id: 'dashboard', label: '📊 Дашборд' },
    { id: 'debtors',   label: '📋 Должники' },
    { id: 'receipts',  label: '🧾 Квитанции' },
    { id: 'passport',  label: '🏠 Паспорт участка' },
    { id: 'finance',   label: '💰 Финансы' },
    { id: 'electricity', label: '⚡ Электроэнергия' },
    { id: 'settings',  label: '⚙️ Настройки' }
];
const ALL_TAB_IDS = ALL_TABS.map(t => t.id);

// ===================== ПРОСТАЯ АВТОРИЗАЦИЯ =====================
// ВНИМАНИЕ: это клиентская защита от случайного просмотра посторонними
// (ссылку не открыть без пароля), а не полноценная серверная авторизация —
// сам файл и код всё равно можно скачать и посмотреть в исходниках.
// Для более надёжной защиты рекомендуется закрыть доступ на уровне хостинга
// (Basic Auth, приватный репозиторий/прокси и т.п.).
//
// Пользователи и права хранятся в файле users.json в том же репозитории,
// что и данные (base.ods и т.п.) — читаются так же, как остальные файлы.
// Если users.json недоступен или пуст (например, самый первый запуск,
// пока администратор ещё не завёл ни одного пользователя), используется
// встроенная резервная учётная запись администратора — её пароль задан
// ниже как хеш и НЕ позволяет постороннему создать себе доступ самостоятельно
// (в отличие от прежней схемы, где первый посетитель мог сам придумать пароль).
//
// Резервный логин: admin / Berezka2-2026!  — войдите под ним и заведите
// настоящих пользователей на вкладке «Пользователи» (доступна только admin).
const DEFAULT_PASS_HASH = 'ca9ae49aa19e7665b5cc7674bb9fff10533a4936794969bde31cbceda73faf01';
const FALLBACK_ADMIN = { username: 'admin', passHash: DEFAULT_PASS_HASH, role: 'admin', allowedTabs: ALL_TAB_IDS.slice() };

let usersList = [];
let usersSource = 'fallback'; // 'remote' | 'fallback'
let currentUser = null; // {username, role, allowedTabs}

async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchJsonSmart(url) {
    const ab = await fetchArrayBufferSmart(url);
    const text = new TextDecoder('utf-8').decode(ab);
    return JSON.parse(text);
}

async function loadUsers() {
    try {
        const data = await fetchJsonSmart(BASE_URL + FILES.users);
        if (data && Array.isArray(data.users) && data.users.some(u => u.role === 'admin')) {
            usersList = data.users;
            usersSource = 'remote';
            return;
        }
        throw new Error('users.json пуст или без администратора');
    } catch (e) {
        usersList = [FALLBACK_ADMIN];
        usersSource = 'fallback';
    }
}

function findUser(username) {
    const u = String(username || '').trim().toLowerCase();
    return usersList.find(x => String(x.username || '').trim().toLowerCase() === u) || null;
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.style.display = 'block';
}

function hideAuthOverlay() {
    document.getElementById('authOverlay').style.display = 'none';
}

async function initAuthGate() {
    const overlay = document.getElementById('authOverlay');
    const savedUser = sessionStorage.getItem('snt_current_user');

    document.getElementById('authSubtitle').textContent = 'Загрузка списка пользователей…';
    document.getElementById('authForm').style.display = 'none';
    await loadUsers();
    document.getElementById('authForm').style.display = '';

    if (savedUser) {
        try {
            const parsed = JSON.parse(savedUser);
            // Подтверждаем, что пользователь всё ещё существует и не был удалён/изменён
            const fresh = findUser(parsed.username);
            if (fresh) {
                currentUser = { username: fresh.username, role: fresh.role, allowedTabs: fresh.allowedTabs || [] };
                overlay.style.display = 'none';
                startApp();
                return;
            }
        } catch (e) { /* ignore, покажем экран входа */ }
    }

    document.getElementById('authTitle').textContent = 'Вход в систему';
    document.getElementById('authSubtitle').textContent = 'Доступ к данным СНТ «Берёзка-2» только для правления.';
    const submitBtn = document.getElementById('authSubmitBtn');
    const userInp = document.getElementById('authUsernameInput');
    const passInp = document.getElementById('authPasswordInput');
    submitBtn.textContent = 'Войти';

    submitBtn.onclick = async () => {
        document.getElementById('authError').style.display = 'none';
        const username = userInp.value.trim();
        const pass = passInp.value;
        if (!username || !pass) { showAuthError('Введите логин и пароль'); return; }

        const user = findUser(username);
        if (!user) { showAuthError('Пользователь не найден'); return; }
        const hash = await sha256Hex(pass);
        if (hash !== user.passHash) { showAuthError('Неверный пароль'); return; }

        currentUser = { username: user.username, role: user.role, allowedTabs: user.allowedTabs || [] };
        sessionStorage.setItem('snt_current_user', JSON.stringify(currentUser));
        hideAuthOverlay();
        startApp();
    };

    userInp.onkeydown = (e) => { if (e.key === 'Enter') passInp.focus(); };
    passInp.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };
}

// Показывает только те вкладки/страницы, которые разрешены текущему пользователю;
// у admin есть доступ ко всем вкладкам плюс отдельная вкладка «Пользователи».
function applyRolePermissions() {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin';
    const allowed = new Set(isAdmin ? ALL_TAB_IDS : (currentUser.allowedTabs || []));

    document.querySelectorAll('.nav-tab').forEach(tab => {
        const page = tab.dataset.page;
        if (page === 'users') return; // управляется отдельно ниже
        tab.style.display = allowed.has(page) ? '' : 'none';
    });

    const usersTab = document.getElementById('navTabUsers');
    if (usersTab) usersTab.style.display = isAdmin ? '' : 'none';

    // Если активная вкладка недоступна — переключаемся на первую разрешённую
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab && activeTab.style.display === 'none') {
        const firstAllowed = document.querySelector('.nav-tab:not([style*="display: none"])');
        if (firstAllowed) firstAllowed.click();
    }

    const userBadge = document.getElementById('currentUserBadge');
    if (userBadge) userBadge.textContent = `👤 ${currentUser.username}${isAdmin ? ' (админ)' : ''}`;
}

// ===================== ЛОГГЕР =====================
const logContainer = document.getElementById('logContainer');
function addLog(msg, type='info') {
  const time = new Date().toLocaleTimeString();
  const colors = { info: '#d4d4d4', success: '#4caf50', error: '#ef5350', loading: '#42a5f5', warning: '#ffa726' };
  const entry = document.createElement('div');
  entry.style.color = colors[type] || colors.info;
  entry.textContent = `[${time}] ${msg}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}
addLog('🚀 Страница загружена, ожидание данных...', 'info');

// ===================== КОНСТАНТЫ =====================
const BASE_URL = 'https://raw.githubusercontent.com/zarazakill/vznos/main/';
const FILES = {
  base: 'base.ods',
  debit: 'debit.ods',
  ee: 'ee.ods',
  '50': '50.ods',
  '51': '51.ods',
  '71': '71.ods',
  users: 'users.json'
};

// Разбираем владельца/репозиторий/ветку из BASE_URL — нужно для записи users.json
// через GitHub Contents API (чтение всегда идёт через raw/CDN, запись — только через API с токеном).
const GH_MATCH = BASE_URL.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\//);
const GH_OWNER = GH_MATCH ? GH_MATCH[1] : '';
const GH_REPO = GH_MATCH ? GH_MATCH[2] : '';
const GH_BRANCH = GH_MATCH ? GH_MATCH[3] : 'main';

// ===================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====================
let allPlots = [];
let allPlotsAll = []; // все участки, без фильтра по долгу — для квитанций
let filteredPlots = [];
let selectedIds = new Set();
let selectedEeIds = new Set();
let receiptSelectedIds = new Set();
let receiptGroupFilter = 'all'; // all | debt | nodebt | electricity | member | nonmember
let receiptItemsState = new Map(); // plotId -> {membership,target,arrears,work,electricity,extra,manualPurpose}
let receiptOpenRows = new Set(); // ids of rows with the "состав платежа" panel expanded

// Поиск по номеру участка: если ввод похож на номер (цифры/буква),
// ищем по НАЧАЛУ номера, а не по вхождению — иначе "1" находит "10,11,21,31...".
// Поиск по ФИО/адресу/телефону остаётся подстрочным (includes), как ожидается для текста.
function plotSearchMatch(plotNumber, ownerName, query, extra) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const pn = String(plotNumber || '').toLowerCase();
    const isPlotLikeQuery = /^\d+[а-яё]?$/i.test(q);
    const plotMatch = isPlotLikeQuery ? pn.startsWith(q) : pn.includes(q);
    const ownerMatch = String(ownerName || '').toLowerCase().includes(q);
    const extraMatch = extra ? extra.some(v => String(v || '').toLowerCase().includes(q)) : false;
    return plotMatch || ownerMatch || extraMatch;
}
const receiptCustomAmounts = new Map(); // plotId -> {amount, mode, purpose} mode: 'debt'|'advance'|'custom'
let sortCol = 'totalDebt';
let sortDir = -1;
let currentReceiptPlot = null;
let passportService = null;
let currentPassport = null;
let originalPlotsBackup = [];
let financialAnalyzer = null;
let financeChartInstance = null;
let financePieInstance = null;

// ===================== НАСТРОЙКА КОЛОНОК ЭЛЕКТРОЭНЕРГИИ =====================
const EE_COLUMNS = [
  { id: 'plotNumber',  label: '№ уч.',                         icon: '🔢' },
  { id: 'owner',       label: 'ФИО владельца',                 icon: '👤' },
  { id: 'prevReading', label: 'Пред. показания',               icon: '📉' },
  { id: 'currReading', label: 'Тек. показания',                icon: '📈' },
  { id: 'consumption', label: 'Расход кВт·ч',                  icon: '⚡' },
  { id: 'tariff',      label: 'Тариф ₽',                       icon: '💵' },
  { id: 'amount',      label: 'Сумма ₽',                       icon: '💰' },
  { id: 'readingDate', label: 'Дата съёма',                    icon: '📅' },
  { id: 'newReading',  label: 'Новые показания (для вписывания)', icon: '✍️' }
];
const EE_DEFAULT_COLS = ['plotNumber','owner','prevReading','currReading','consumption','tariff','amount','readingDate'];

function getEeColumnsConfig() {
  try {
    const saved = localStorage.getItem('snt_ee_cols');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        const validIds = new Set(EE_COLUMNS.map(c => c.id));
        const seenIds = new Set();
        const config = [];
        parsed.forEach(col => {
          if (!col || !validIds.has(col.id) || seenIds.has(col.id)) return;
          seenIds.add(col.id);
          config.push({ id: col.id, visible: col.visible !== false });
        });
        const haveIds = new Set(config.map(c => c.id));
        EE_COLUMNS.forEach(def => {
          if (!haveIds.has(def.id)) config.push({ id: def.id, visible: def.id !== 'newReading' });
        });
        if (!config.some(c => c.visible)) config[0].visible = true;
        return config;
      }
    }
  } catch(e) {}
  return EE_COLUMNS.map(col => ({ id: col.id, visible: EE_DEFAULT_COLS.includes(col.id) }));
}
function saveEeColumnsConfig(cfg) { localStorage.setItem('snt_ee_cols', JSON.stringify(cfg)); }
function getActiveEeColumns() { return getEeColumnsConfig().filter(c => c.visible); }

function getEeColHeader(colId, mode) {
  const def = EE_COLUMNS.find(c => c.id === colId);
  if (!def) return mode === 'print' ? '<th style="border:1px solid #ccc;padding:6px;background:#e8f5e9;"></th>' : '<th></th>';
  const widths = { plotNumber:'90px', prevReading:'120px', currReading:'120px', consumption:'100px', tariff:'100px', amount:'120px', readingDate:'120px', newReading:'130px' };
  const aligns = { prevReading:'text-align:right;', currReading:'text-align:right;', consumption:'text-align:right;', tariff:'text-align:right;', amount:'text-align:right;', readingDate:'text-align:center;', newReading:'text-align:center;' };
  const w = widths[colId] ? `width:${widths[colId]};` : '';
  const a = aligns[colId] || '';
  if (mode === 'print') return `<th style="border:1px solid #ccc;padding:6px;${w}${a}background:#e8f5e9;">${def.icon} ${def.label}</th>`;
  return `<th style="${w}${a}">${def.icon} ${def.label}</th>`;
}

function renderEeCellHtml(item, colId, mode) {
  const consumption = Math.max(0, (item.currReading || 0) - (item.prevReading || 0));
  const amount = consumption * (item.tariff || 3.82);
  const p = (mode === 'print') ? 'border:1px solid #ccc;padding:6px;' : '';
  switch(colId) {
    case 'plotNumber':
      return mode === 'print'
        ? `<td style="${p}text-align:center;">${escapeHtml(String(item.plotNumber || ''))}</td>`
        : `<td><span class="plot-num-badge">${escapeHtml(String(item.plotNumber || ''))}</span></td>`;
    case 'owner':
      return `<td style="${p}">${escapeHtml(item.owner || '—')}</td>`;
    case 'prevReading':
      return `<td style="${p}text-align:right;">${(item.prevReading || 0).toFixed(2)}</td>`;
    case 'currReading':
      return `<td style="${p}text-align:right;">${(item.currReading || 0).toFixed(2)}</td>`;
    case 'consumption':
      return mode === 'print'
        ? `<td style="${p}text-align:right;">${consumption.toFixed(2)}</td>`
        : `<td style="${p}text-align:right;font-weight:600;">${consumption.toFixed(2)}</td>`;
    case 'tariff':
      return `<td style="${p}text-align:right;">${(item.tariff || 3.82).toFixed(2)}</td>`;
    case 'amount':
      return mode === 'print'
        ? `<td style="${p}text-align:right;">${fmt(amount)}</td>`
        : `<td style="${p}text-align:right;font-weight:600;color:var(--gray-800);">${fmt(amount)}</td>`;
    case 'readingDate':
      return `<td style="${p}text-align:center;">${escapeHtml(item.readingDate || '—')}</td>`;
    case 'newReading':
      return mode === 'print'
        ? `<td style="${p}text-align:center;background:#fffde7;min-width:120px;">&nbsp;</td>`
        : `<td style="text-align:center;background:#fffde7;border:1px dashed #f9a825;min-width:100px;color:var(--gray-400);font-size:.8rem;">—</td>`;
  }
  return '<td></td>';
}

function renderEeColumnList() {
  const config = getEeColumnsConfig();
  const list = document.getElementById('eeColumnList');
  if (!list) return;
  list.innerHTML = config.map((col, idx) => {
    const def = EE_COLUMNS.find(c => c.id === col.id);
    if (!def) return '';
    return `<div class="ee-col-item" draggable="true" data-id="${col.id}" data-idx="${idx}"
      style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border:1px solid var(--gray-200);border-radius:6px;cursor:move;user-select:none;">
      <span style="color:var(--gray-400);cursor:grab;font-size:1rem;line-height:1;" title="Перетащите">⋮⋮</span>
      <input type="checkbox" ${col.visible ? 'checked' : ''} class="ee-col-vis-cb" data-id="${col.id}" style="width:16px;height:16px;accent-color:var(--green-600);cursor:pointer;">
      <span style="flex:1;font-size:.85rem;">${def.icon} ${def.label}</span>
      <button class="btn btn-secondary btn-sm ee-col-up" data-idx="${idx}" ${idx===0?'disabled':''} style="padding:2px 8px;">↑</button>
      <button class="btn btn-secondary btn-sm ee-col-down" data-idx="${idx}" ${idx===config.length-1?'disabled':''} style="padding:2px 8px;">↓</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.ee-col-vis-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const cfg = getEeColumnsConfig();
      const item = cfg.find(c => c.id === cb.dataset.id);
      if (item) item.visible = cb.checked;
      saveEeColumnsConfig(cfg);
      renderElectricityPage();
      updateEeColsInfo();
    });
    cb.addEventListener('click', e => e.stopPropagation());
  });
  list.querySelectorAll('.ee-col-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const cfg = getEeColumnsConfig();
      if (idx > 0) { [cfg[idx-1], cfg[idx]] = [cfg[idx], cfg[idx-1]]; saveEeColumnsConfig(cfg); renderEeColumnList(); renderElectricityPage(); }
    });
  });
  list.querySelectorAll('.ee-col-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const cfg = getEeColumnsConfig();
      if (idx < cfg.length - 1) { [cfg[idx], cfg[idx+1]] = [cfg[idx+1], cfg[idx]]; saveEeColumnsConfig(cfg); renderEeColumnList(); renderElectricityPage(); }
    });
  });

  let dragIdx = null;
  list.querySelectorAll('.ee-col-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragIdx = parseInt(item.dataset.idx);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.ee-col-item').forEach(i => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIdx = parseInt(item.dataset.idx);
      item.classList.remove('drag-over');
      if (dragIdx === null || dragIdx === dropIdx) return;
      const cfg = getEeColumnsConfig();
      const [moved] = cfg.splice(dragIdx, 1);
      cfg.splice(dropIdx, 0, moved);
      saveEeColumnsConfig(cfg);
      renderEeColumnList();
      renderElectricityPage();
    });
  });
  updateEeColsInfo();
}
function updateEeColsInfo() {
  const active = getActiveEeColumns();
  const info = document.getElementById('eeActiveColsInfo');
  if (info) info.textContent = `Активно колонок: ${active.length} из ${EE_COLUMNS.length}`;
}
    
// ===================== ЭЛЕКТРОЭНЕРГИЯ =====================
function parseElectricityDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    // В таблицах встречаются ISO-даты, даты с точками и серийные даты Excel/ODS.
    if (/^\d{4,6}(?:[.,]\d+)?$/.test(raw)) {
        const serial = Number(raw.replace(',', '.'));
        if (serial >= 20000 && serial <= 90000) {
            const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        }
    }

    const datePart = raw.split(/[ T]/)[0];
    let year, month, day;
    let match = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
        [, year, month, day] = match;
    } else {
        match = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
        if (!match) return '';
        [, day, month, year] = match;
        if (year.length === 2) year = `20${year}`;
    }
    const y = Number(year), m = Number(month), d = Number(day);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return '';
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getElectricityDateRange() {
    return {
        from: document.getElementById('electricityDateFrom').value,
        to: document.getElementById('electricityDateTo').value
    };
}

function getFilteredElectricityItems() {
    const search = document.getElementById('electricitySearchInput').value.trim().toLocaleLowerCase('ru-RU');
    const { from, to } = getElectricityDateRange();
    const dateError = document.getElementById('electricityDateError');
    const invalidRange = Boolean(from && to && from > to);
    dateError.textContent = invalidRange ? 'Начальная дата должна быть не позже конечной.' : '';
    dateError.hidden = !invalidRange;
    if (invalidRange || !eeRepo || !eeRepo.getAll) return [];

    const items = eeRepo.getAll().filter(item => {
        if (search) {
            const plot = String(item.plotNumber || '').toLocaleLowerCase('ru-RU');
            const owner = String(item.owner || '').toLocaleLowerCase('ru-RU');
            const isPlotLike = /^\d+[а-яё]?$/i.test(search);
            const matchesSearch = isPlotLike ? plot.startsWith(search) : plot.includes(search) || owner.includes(search);
            if (!matchesSearch) return false;
        }
        if (from || to) {
            const date = parseElectricityDate(item.readingDate);
            if (!date || (from && date < from) || (to && date > to)) return false;
        }
        return true;
    });

    return items.sort((a, b) => String(a.plotNumber || '').localeCompare(String(b.plotNumber || ''), 'ru', { numeric: true, sensitivity: 'base' }));
}

function getVisibleSelectedElectricityItems(items = getFilteredElectricityItems()) {
    return items.filter(item => selectedEeIds.has(String(item.plotNumber)));
}

function updateEeSelectionBadge(items = getFilteredElectricityItems()) {
    const selectedVisible = getVisibleSelectedElectricityItems(items).length;
    const badge = document.getElementById('eeSelectedCountBadge');
    if (badge) badge.textContent = `Выбрано: ${selectedEeIds.size}`;
    const printSelected = document.getElementById('printElectricityBtn');
    const printAll = document.getElementById('printAllElectricityBtn');
    if (printSelected) {
        printSelected.textContent = `🖨 Печать выбранных (${selectedVisible})`;
        printSelected.disabled = selectedVisible === 0;
    }
    if (printAll) {
        printAll.textContent = `🖨 Печать всех видимых (${items.length})`;
        printAll.disabled = items.length === 0;
    }
    const selectAll = document.getElementById('eeSelectAllCb');
    if (selectAll) {
        selectAll.checked = items.length > 0 && items.every(item => selectedEeIds.has(String(item.plotNumber)));
        selectAll.indeterminate = selectedVisible > 0 && selectedVisible < items.length;
        selectAll.disabled = items.length === 0;
    }
}

function renderElectricityPage() {
    const noData = document.getElementById('electricityNoData');
    const dataView = document.getElementById('electricityDataView');
    if (!eeRepo || !eeRepo.getAll || eeRepo.getAll().length === 0) {
        if (noData) noData.style.display = '';
        if (dataView) dataView.style.display = 'none';
        updateEeSelectionBadge([]);
        return;
    }
    if (noData) noData.style.display = 'none';
    if (dataView) dataView.style.display = '';

    const items = getFilteredElectricityItems();
    const activeCols = getActiveEeColumns();
    const thead = document.getElementById('electricityTableHead');
    const tbody = document.getElementById('electricityTableBody');
    if (thead) thead.innerHTML = '<tr><th class="ee-row-select" aria-label="Выбор участка">✓</th>' + activeCols.map(col => getEeColHeader(col.id, 'screen')).join('') + '</tr>';

    let totalConsumption = 0;
    let totalSum = 0;
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="${Math.max(2, activeCols.length + 1)}" class="ee-empty-cell">Ничего не найдено</td></tr>`;
    } else {
        tbody.innerHTML = items.map(item => {
            const consumption = Math.max(0, (item.currReading || 0) - (item.prevReading || 0));
            const amount = consumption * (item.tariff || 3.82);
            totalConsumption += consumption;
            totalSum += amount;
            const checked = selectedEeIds.has(String(item.plotNumber));
            return `<tr class="${checked ? 'selected' : ''}">
              <td class="ee-row-select"><input type="checkbox" class="ee-row-cb" data-id="${escapeHtml(String(item.plotNumber))}" ${checked ? 'checked' : ''} aria-label="Выбрать участок ${escapeHtml(String(item.plotNumber))}"></td>
              ${activeCols.map(col => renderEeCellHtml(item, col.id, 'screen')).join('')}
            </tr>`;
        }).join('');
    }

    const footer = document.getElementById('electricityTotal');
    if (footer) footer.textContent = `Показано участков: ${items.length} · Расход: ${totalConsumption.toFixed(2)} кВт·ч · Начислено: ${fmt(totalSum)} ₽`;
    updateEeSelectionBadge(items);
}

function getElectricityRangeLabel() {
    const { from, to } = getElectricityDateRange();
    const display = date => date ? new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU') : '';
    if (from && to) return `Период: ${display(from)} — ${display(to)}`;
    if (from) return `Начиная с ${display(from)}`;
    if (to) return `По ${display(to)}`;
    return 'Все даты';
}

function printElectricityItems(items, title) {
    if (!items.length) {
        alert('Нет участков для печати по текущим фильтрам.');
        return;
    }
    const activeCols = getActiveEeColumns();
    const headers = activeCols.map(col => getEeColHeader(col.id, 'print')).join('');
    const rows = items.map(item => `<tr>${activeCols.map(col => renderEeCellHtml(item, col.id, 'print')).join('')}</tr>`).join('');
    const totalConsumption = items.reduce((sum, item) => sum + Math.max(0, (item.currReading || 0) - (item.prevReading || 0)), 0);
    const totalSum = items.reduce((sum, item) => sum + Math.max(0, (item.currReading || 0) - (item.prevReading || 0)) * (item.tariff || 3.82), 0);
    const hasNewReading = activeCols.some(col => col.id === 'newReading');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Браузер заблокировал окно печати. Разрешите всплывающие окна и повторите попытку.');
        return;
    }
    printWindow.document.write(`<html lang="ru"><head><meta charset="UTF-8"><title>Электроэнергия — СНТ Берёзка-2</title>
      <style>
        body{font:14px Arial,sans-serif;padding:20px;color:#222}h2{font-size:18px;margin:0 0 6px}.print-meta{color:#555;font-size:12px;margin:0 0 14px}
        table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px}th{background:#edf5ed}.footer{margin-top:12px;font-size:12px;color:#444}
        @media print{@page{size:landscape;margin:10mm}}
      </style></head><body>
      <h2>⚡ Показания электросчётчиков — СНТ «Берёзка-2»</h2>
      <p class="print-meta">${escapeHtml(title)} · Напечатано ${new Date().toLocaleDateString('ru-RU')} · Участков: ${items.length}</p>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Итого: ${items.length} участков · Расход: ${totalConsumption.toFixed(2)} кВт·ч · Начислено: ${fmt(totalSum)} ₽</div>
      ${hasNewReading ? '<p class="footer">✍️ Колонка «Новые показания» предназначена для заполнения от руки.</p>' : ''}
      </body></html>`);
    printWindow.document.close();
    let printStarted = false;
    const startPrint = () => {
        if (printStarted || printWindow.closed) return;
        printStarted = true;
        printWindow.print();
    };
    printWindow.addEventListener('load', startPrint, { once: true });
    setTimeout(startPrint, 700);
}

function exportElectricityCsv() {
    const visibleItems = getFilteredElectricityItems();
    const selectedVisible = getVisibleSelectedElectricityItems(visibleItems);
    const items = selectedVisible.length ? selectedVisible : visibleItems;
    if (!items.length) {
        alert('Нет участков для экспорта по текущим фильтрам.');
        return;
    }
    const activeCols = getActiveEeColumns();
    const header = activeCols.map(col => EE_COLUMNS.find(def => def.id === col.id)?.label || col.id);
    const rows = items.map(item => activeCols.map(col => {
        const consumption = Math.max(0, (item.currReading || 0) - (item.prevReading || 0));
        switch (col.id) {
            case 'plotNumber': return item.plotNumber;
            case 'owner': return item.owner || '—';
            case 'prevReading': return (item.prevReading || 0).toFixed(2);
            case 'currReading': return (item.currReading || 0).toFixed(2);
            case 'consumption': return consumption.toFixed(2);
            case 'tariff': return (item.tariff || 3.82).toFixed(2);
            case 'amount': return fmt(consumption * (item.tariff || 3.82));
            case 'readingDate': return item.readingDate || '';
            case 'newReading': return '';
            default: return '';
        }
    }));
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'elektroenergiya_snt.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('electricitySearchInput').addEventListener('input', renderElectricityPage);
document.getElementById('electricityDateFrom').addEventListener('change', renderElectricityPage);
document.getElementById('electricityDateTo').addEventListener('change', renderElectricityPage);
document.getElementById('eeSelectAllCb').addEventListener('change', event => {
    const items = getFilteredElectricityItems();
    items.forEach(item => {
        const id = String(item.plotNumber);
        if (event.target.checked) selectedEeIds.add(id);
        else selectedEeIds.delete(id);
    });
    renderElectricityPage();
});
document.getElementById('electricityTableBody').addEventListener('change', event => {
    if (!event.target.classList.contains('ee-row-cb')) return;
    if (event.target.checked) selectedEeIds.add(event.target.dataset.id);
    else selectedEeIds.delete(event.target.dataset.id);
    renderElectricityPage();
});
document.getElementById('resetElectricityFilters').addEventListener('click', () => {
    document.getElementById('electricitySearchInput').value = '';
    document.getElementById('electricityDateFrom').value = '';
    document.getElementById('electricityDateTo').value = '';
    renderElectricityPage();
});
document.getElementById('printElectricityBtn').addEventListener('click', () => {
    const items = getVisibleSelectedElectricityItems();
    printElectricityItems(items, `${getElectricityRangeLabel()} · Выбранные участки`);
});
document.getElementById('printAllElectricityBtn').addEventListener('click', () => {
    printElectricityItems(getFilteredElectricityItems(), `${getElectricityRangeLabel()} · Все видимые участки`);
});
document.getElementById('exportElectricityCsv').addEventListener('click', exportElectricityCsv);

// ===================== НАСТРОЙКИ =====================
let REQ = {
  Name: localStorage.getItem('snt_Name') || 'СНТ «Берёзка-2»',
  PayeeINN: localStorage.getItem('snt_INN') || '5433118499',
  PersonalAcc: localStorage.getItem('snt_Acc') || '40703810644050040322',
  BankName: localStorage.getItem('snt_BankName') || 'Сибирский Банк ПАО Сбербанк г. Новосибирск',
  BIC: localStorage.getItem('snt_BIC') || '045004641',
  CorrespAcc: localStorage.getItem('snt_Corr') || '30101810500000000641',
};
let CFG = {
  year: localStorage.getItem('snt_Year') || '2026',
  showQr: localStorage.getItem('snt_QR') !== '0',
  duplicate: localStorage.getItem('snt_Dup') !== '0',
  minDebt: parseFloat(localStorage.getItem('snt_MinDebt') || '0.01'),
};

// ===================== ФИНАНСОВЫЙ АНАЛИЗАТОР =====================
class FinancialAnalyzer {
    constructor() {
        this.operations = [];
        this.incomeOps = [];
        this.expenseOps = [];
        this.internalOps = [];
        this.advanceOps = [];
        this.monthlyIncome = {};
        this.monthlyExpense = {};
        this.categoryExpense = {};
        this.monthlySummary = {};
        this.rawData = { '50': [], '51': [], '71': [] };
        this.categoryColors = {
            'Членские взносы': '#2e7d32',
            'Плата за электроэнергию': '#ff9800',
            'Целевые взносы': '#1565c0',
            'Погашение задолженности': '#e65100',
            'Авансовые взносы': '#7b1fa2',
            'Возврат подотчетных': '#00897b',
            'Заработная плата': '#2196f3',
            'Налоги и сборы': '#f44336',
            'Банковские услуги': '#607d8b',
            'Электроэнергия': '#ff9800',
            'ГСМ и транспорт': '#795548',
            'Материалы и оборудование': '#009688',
            'Охрана': '#9c27b0',
            'Содержание и ИТ': '#3f51b5',
            'Хозяйственные нужды': '#8bc34a',
            'Ремонт и услуги': '#ff5722',
            'Выдача под отчет': '#78909c',
            'Прочие расходы': '#9e9e9e',
            'Внутренние перемещения': '#bdbdbd'
        };
    }

    async loadFromFiles(files) {
        for (const [key, rows] of Object.entries(files)) {
            this.rawData[key] = rows;
            this.parseRows(key, rows);
        }
        this.classifyOperations();
        this.calculateMonthly();
        return this;
    }

    parseRows(accountType, rows) {
        let isDataStarted = false;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 5) continue;

            const firstCell = String(row[0] || '').trim();
            if (firstCell.includes('Период') || firstCell === 'Период') {
                isDataStarted = true;
                continue;
            }

            if (!isDataStarted) continue;
            if (firstCell.includes('Сальдо на начало') || firstCell.includes('Обороты за период')) {
                continue;
            }

            const op = this.parseOperation(row, accountType);
            if (op) {
                this.operations.push(op);
            }
        }
    }

    parseOperation(row, accountType) {
        const date = String(row[0] || '').trim();
        const doc = String(row[1] || '').trim();
        const analDt = String(row[2] || '').trim();
        const analKt = String(row[3] || '').trim();
        const debitAccount = String(row[4] || '').trim();
        const debitAmount = this.parseAmount(row[5]);
        const creditAccount = String(row[7] || '').trim();
        const creditAmount = this.parseAmount(row[8]);

        if (!date || !/^\d{2}\.\d{2}\.\d{4}/.test(date)) return null;
        if (!debitAmount && !creditAmount) return null;
        if (date.includes('Сальдо') || date.includes('Обороты')) return null;

        let operationType = 'unknown';
        let category = 'Прочие';
        let counterparty = '';
        let purpose = doc;

        const docLower = doc.toLowerCase();
        const analDtLower = analDt.toLowerCase();
        const analKtLower = analKt.toLowerCase();

        // === ОПРЕДЕЛЕНИЕ ТИПА ОПЕРАЦИИ ===

        // 1. Внутренние перемещения (51<->50, 51<->50.01)
        if (docLower.includes('внутреннее перемещение') ||
            (debitAccount === '51' && (creditAccount === '50.01' || creditAccount === '50')) ||
            ((debitAccount === '50.01' || debitAccount === '50') && creditAccount === '51') ||
            analDt.includes('Внутреннее') || analKt.includes('Внутреннее')) {
            operationType = 'internal';
            category = 'Внутренние перемещения';
            counterparty = 'Внутренний перевод';
        }
        // 2. Выдача под отчет (из кассы/банка подотчетному лицу)
        else if (debitAmount > 0 && debitAccount.startsWith('71') &&
                (creditAccount === '50.01' || creditAccount === '50' || creditAccount === '51')) {
            operationType = 'advance';
            category = 'Выдача под отчет';
            counterparty = analKt || 'Подотчетное лицо';
        }
        // 3. Возврат подотчетных (в кассу)
        else if (debitAmount > 0 && (debitAccount === '50.01' || debitAccount === '50') &&
                creditAccount.startsWith('71') &&
                (analDtLower.includes('возврат') || analDtLower.includes('подотчет'))) {
            operationType = 'income';
            category = 'Возврат подотчетных';
            counterparty = analKt || 'Подотчетное лицо';
        }
        // 4. Поступление взносов (доход) — Дт51/50, Кт76.61
        else if (debitAmount > 0 && (debitAccount === '50.01' || debitAccount === '50' || debitAccount === '51') &&
                creditAccount === '76.61') {
            operationType = 'income';
            category = this.detectIncomeCategory(analKt, analDt);
            counterparty = this.extractPayer(analKt);
        }
        // 5. Оплата поставщикам — Дт60, Кт51/50
        else if (creditAmount > 0 && (creditAccount === '51' || creditAccount === '50.01' || creditAccount === '50') &&
                (debitAccount.startsWith('60'))) {
            operationType = 'expense';
            category = this.detectCategoryFromPurpose(doc, analDt);
            counterparty = analDt || 'Поставщик';
        }
        // 6. Выплата зарплаты — Дт70, Кт50/51
        else if (creditAmount > 0 && (creditAccount === '50.01' || creditAccount === '50' || creditAccount === '51') &&
                debitAccount === '70') {
            operationType = 'expense';
            category = 'Заработная плата';
            counterparty = analDt || 'Сотрудник';
        }
        // 7. Налоги и сборы — Дт68/69, Кт51
        else if (creditAmount > 0 && (creditAccount === '51' || creditAccount === '50.01' || creditAccount === '50') &&
                (debitAccount.startsWith('68') || debitAccount.startsWith('69'))) {
            operationType = 'expense';
            category = 'Налоги и сборы';
            counterparty = 'ФНС / ПФР / ФСС';
        }
        // 8. Банковские услуги — Дт26/91.02, Кт51
        else if (creditAmount > 0 && (creditAccount === '51' || creditAccount === '50.01' || creditAccount === '50') &&
                (debitAccount.startsWith('26') || debitAccount.startsWith('91'))) {
            operationType = 'expense';
            category = 'Банковские услуги';
            counterparty = 'ПАО Сбербанк';
        }
        // 9. Авансовые отчеты — Дт10/41/91, Кт71 (фактические расходы)
        else if (creditAmount > 0 && creditAccount.startsWith('71') &&
                !debitAccount.startsWith('50') && !debitAccount.startsWith('51')) {
            operationType = 'expense';
            category = this.detectCategoryFromPurpose(doc, analDt);
            counterparty = 'Чернов В.Б. (подотчет)';
        }
        // 10. Прочие расходы — Кт51/50
        else if (creditAmount > 0 && (creditAccount === '51' || creditAccount === '50.01' || creditAccount === '50')) {
            operationType = 'expense';
            category = 'Прочие расходы';
            counterparty = analDt || 'Контрагент';
        }
        // 11. Прочие доходы — Дт51/50
        else if (debitAmount > 0 && (debitAccount === '51' || debitAccount === '50.01' || debitAccount === '50')) {
            operationType = 'income';
            category = 'Прочие поступления';
            counterparty = analKt || 'Контрагент';
        }

        return {
            date: date,
            dateObj: this.parseDateStr(date),
            monthKey: this.getMonthKey(date),
            year: this.getYear(date),
            month: this.getMonth(date),
            document: doc,
            analDt: analDt,
            analKt: analKt,
            debitAccount: debitAccount,
            creditAccount: creditAccount,
            amount: debitAmount > 0 ? debitAmount : creditAmount,
            debitAmount: debitAmount,
            creditAmount: creditAmount,
            type: operationType,
            category: category,
            purpose: purpose,
            counterparty: counterparty,
            accountType: accountType
        };
    }

    detectIncomeCategory(analKt, analDt) {
        // analKt = payer info e.g. "145 уч.: Приходько О.В\nЭлектроэнергия"
        // analDt = bank info e.g. "40703...\nВзносы садоводов"
        const text = (analKt + ' ' + analDt).toLowerCase();
        if (text.includes('электроэнерги')) return 'Плата за электроэнергию';
        if (text.includes('членские взносы') || text.includes('членск')) return 'Членские взносы';
        if (text.includes('целевые')) return 'Целевые взносы';
        if (text.includes('задолженность') || text.includes('прошлых лет') || text.includes('отработка')) return 'Погашение задолженности';
        if (text.includes('аванс')) return 'Авансовые взносы';
        if (text.includes('взносы садоводов') || text.includes('взносы члена')) return 'Членские взносы';
        return 'Взносы';
    }

    extractPayer(analKt) {
        if (!analKt) return 'Садовод';
        // Format: "145 уч.: Фамилия И.О"
        const matchPlot = analKt.match(/(\d+\s*уч\.?:?\s*[^\n]+)/);
        if (matchPlot) return matchPlot[1].split('\n')[0].trim();
        // Full name
        const match = analKt.match(/([А-Я][а-я]+ [А-Я][а-я]+ [А-Я][а-я]+)/);
        if (match) return match[1];
        const match2 = analKt.match(/([А-Я][а-я]+ [А-Я]\.[А-Я]\.)/);
        if (match2) return match2[1];
        return analKt.split('\n')[0].trim() || 'Садовод';
    }

    classifyOperations() {
        this.incomeOps = [];
        this.expenseOps = [];
        this.internalOps = [];
        this.advanceOps = [];

        for (const op of this.operations) {
            switch (op.type) {
                case 'income': this.incomeOps.push(op); break;
                case 'expense': this.expenseOps.push(op); break;
                case 'internal': this.internalOps.push(op); break;
                case 'advance': this.advanceOps.push(op); break;
                default:
                    if (op.debitAmount > 0 && op.creditAccount !== '71.01' &&
                        !op.document.toLowerCase().includes('внутреннее')) {
                        this.incomeOps.push(op);
                    } else if (op.creditAmount > 0 &&
                              !op.document.toLowerCase().includes('внутреннее')) {
                        this.expenseOps.push(op);
                    }
            }
        }
    }

    calculateMonthly() {
        this.monthlyIncome = {};
        this.monthlyExpense = {};
        this.monthlySummary = {};
        this.categoryExpense = {};

        const months = this.getAvailableMonths();
        for (const month of months) {
            this.monthlyIncome[month] = 0;
            this.monthlyExpense[month] = 0;
            this.monthlySummary[month] = { income: 0, expense: 0, balance: 0 };
        }

        for (const op of this.incomeOps) {
            const key = op.monthKey;
            if (this.monthlyIncome[key] !== undefined) {
                this.monthlyIncome[key] += op.amount;
                this.monthlySummary[key].income += op.amount;
            }
        }

        for (const op of this.expenseOps) {
            const key = op.monthKey;
            if (this.monthlyExpense[key] !== undefined) {
                this.monthlyExpense[key] += op.amount;
                this.monthlySummary[key].expense += op.amount;
            }
            if (!this.categoryExpense[op.category]) {
                this.categoryExpense[op.category] = 0;
            }
            this.categoryExpense[op.category] += op.amount;
        }

        for (const key of Object.keys(this.monthlySummary)) {
            this.monthlySummary[key].balance =
                this.monthlySummary[key].income - this.monthlySummary[key].expense;
        }
    }

    getAvailableMonths() {
        const months = new Set();
        for (const op of this.operations) {
            if (op.monthKey) months.add(op.monthKey);
        }
        return Array.from(months).sort();
    }

    parseDateStr(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.trim().split(' ')[0].split('.');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return null;
    }

    getMonthKey(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.trim().split(' ')[0].split('.');
        if (parts.length === 3) {
            return `${parts[2]}-${String(parts[1]).padStart(2, '0')}`;
        }
        return '';
    }

    getYear(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.trim().split(' ')[0].split('.');
        return parts.length === 3 ? parts[2] : '';
    }

    getMonth(dateStr) {
        if (!dateStr) return 0;
        const parts = dateStr.trim().split(' ')[0].split('.');
        return parts.length === 3 ? parseInt(parts[1]) : 0;
    }

    parseAmount(value) {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'number') return value;
        const str = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    detectCategoryFromPurpose(doc, analKt) {
        const text = (doc + ' ' + analKt).toLowerCase();

        if (text.includes('электро') || text.includes('энерг') || text.includes('свет')) {
            return 'Электроэнергия';
        }
        if (text.includes('бенз') || text.includes('топливо') || text.includes('гсм') ||
            text.includes('масло') || text.includes('авто') || text.includes('транспорт')) {
            return 'ГСМ и транспорт';
        }
        if (text.includes('зарплат') || text.includes('заработн') ||
            (text.includes('оплат') && (text.includes('труд') || text.includes('персонал')))) {
            return 'Заработная плата';
        }
        if (text.includes('материал') || text.includes('оборуд') || text.includes('инвентар') ||
            text.includes('инструмент') || text.includes('запчасти')) {
            return 'Материалы и оборудование';
        }
        if (text.includes('охрана') || text.includes('безопас') || text.includes('сторож') ||
            text.includes('чоп') || text.includes('охранн')) {
            return 'Охрана';
        }
        if (text.includes('налог') || text.includes('сбор') || text.includes('фнс') ||
            text.includes('пфр') || text.includes('фсс') || text.includes('страх')) {
            return 'Налоги и сборы';
        }
        if (text.includes('банк') || text.includes('комисс') || text.includes('рко') ||
            text.includes('обслуживани') || text.includes('расчетный')) {
            return 'Банковские услуги';
        }
        if (text.includes('интернет') || text.includes('сайт') || text.includes('программ') ||
            text.includes('ит') || text.includes('компьютер') || text.includes('связь')) {
            return 'Содержание и ИТ';
        }
        if (text.includes('корм') || text.includes('соба') || text.includes('животн') ||
            text.includes('хозяйств') || text.includes('бытов')) {
            return 'Хозяйственные нужды';
        }
        if (text.includes('сервис') || text.includes('ремонт') || text.includes('установк') ||
            text.includes('монтаж') || text.includes('строитель') || text.includes('работ')) {
            return 'Ремонт и услуги';
        }

        return 'Прочие расходы';
    }

    getTotals() {
        let income = 0, expense = 0;
        for (const op of this.incomeOps) income += op.amount;
        for (const op of this.expenseOps) expense += op.amount;
        return { income, expense, balance: income - expense, totalOps: this.operations.length };
    }

    getYearlyTotals(year) {
        let income = 0, expense = 0;
        const months = this.getAvailableMonths().filter(m => m.startsWith(year));
        for (const m of months) {
            income += this.monthlyIncome[m] || 0;
            expense += this.monthlyExpense[m] || 0;
        }
        return { income, expense, balance: income - expense };
    }

    getMonthlyData(year = null) {
        const months = this.getAvailableMonths();
        const result = {};
        for (const m of months) {
            if (year && !m.startsWith(year)) continue;
            result[m] = {
                income: this.monthlyIncome[m] || 0,
                expense: this.monthlyExpense[m] || 0,
                balance: (this.monthlyIncome[m] || 0) - (this.monthlyExpense[m] || 0)
            };
        }
        return result;
    }

    getIncomeDetails(monthKey = null) {
        let ops = this.incomeOps;
        if (monthKey) ops = ops.filter(op => op.monthKey === monthKey);
        return ops.sort((a, b) => {
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });
    }

    getExpenseDetails(monthKey = null, category = null) {
        let ops = this.expenseOps;
        if (monthKey) ops = ops.filter(op => op.monthKey === monthKey);
        if (category) ops = ops.filter(op => op.category === category);
        return ops.sort((a, b) => {
            if (!a.dateObj) return 1;
            if (!b.dateObj) return -1;
            return b.dateObj - a.dateObj;
        });
    }

    getCategorySummary(year = null) {
        const result = {};
        let ops = this.expenseOps;
        if (year) ops = ops.filter(op => op.year === year);
        for (const op of ops) {
            if (!result[op.category]) result[op.category] = 0;
            result[op.category] += op.amount;
        }
        return result;
    }

    getCategoryColor(category) {
        return this.categoryColors[category] || '#9e9e9e';
    }

    getMonthLabel(monthKey) {
        const months = {
            '01': 'Янв', '02': 'Фев', '03': 'Мар', '04': 'Апр',
            '05': 'Май', '06': 'Июн', '07': 'Июл', '08': 'Авг',
            '09': 'Сен', '10': 'Окт', '11': 'Ноя', '12': 'Дек'
        };
        const parts = monthKey.split('-');
        if (parts.length === 2) {
            return months[parts[1]] + ' ' + parts[0];
        }
        return monthKey;
    }

    getFilteredOperations(yearFilter, monthFilter, typeFilter) {
        let ops = [];
        const allOps = this.operations.filter(op => op.type !== 'internal');
        if (typeFilter === 'income' || typeFilter === 'all') {
            ops = ops.concat(allOps.filter(op => op.type === 'income'));
        }
        if (typeFilter === 'expense' || typeFilter === 'all') {
            ops = ops.concat(allOps.filter(op => op.type === 'expense'));
        }
        if (yearFilter !== 'all') {
            ops = ops.filter(op => op.year === yearFilter);
        }
        if (monthFilter !== 'all') {
            ops = ops.filter(op => {
                const parts = op.monthKey.split('-');
                return parts.length === 2 && parts[1] === monthFilter;
            });
        }
        return ops;
    }

    getAccountBalance(accountType) {
        const ops = this.operations.filter(op => op.accountType === accountType);
        let balance = 0;
        for (const op of ops) {
            if (op.debitAccount === accountType) balance += op.amount;
            if (op.creditAccount === accountType) balance -= op.amount;
        }
        return balance;
    }

    getAccountBalanceFromFile(accountType) {
        // Ищем последнюю строку с "Обороты за период и сальдо на конец"
        const rows = this.rawData[accountType] || [];
        let balance = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (!row || row.length < 11) continue;
            const firstCell = String(row[0] || '').trim();
            if (firstCell.includes('Обороты за период') || firstCell.includes('сальдо на конец')) {
                // Сальдо в колонке L (индекс 10)
                const val = this.parseAmount(row[10]);
                if (val !== 0) {
                    balance = val;
                    break;
                }
            }
        }
        return balance;
    }

}
// ===================== ЗАГРУЗКА С ТАЙМАУТОМ И РЕЗЕРВНЫМ CDN =====================
// raw.githubusercontent.com у некоторых провайдеров блокируется/недоступен —
// в этом случае автоматически пробуем тот же файл через jsDelivr CDN (cdn.jsdelivr.net),
// который отдаёт содержимое GitHub-репозитория через другую инфраструктуру.
const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/zarazakill/vznos@main/';

function toCdnUrl(url) {
    if (url.indexOf(BASE_URL) === 0) return CDN_BASE_URL + url.slice(BASE_URL.length);
    return null;
}

async function fetchWithTimeout(url, ms = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchArrayBufferSmart(url) {
    try {
        addLog(`📥 Загрузка: ${url}`, 'loading');
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.arrayBuffer();
    } catch (e) {
        const cdnUrl = toCdnUrl(url);
        if (!cdnUrl) throw e;
        addLog(`⚠️ ${url} недоступен (${e.message || e.name}), пробуем через CDN...`, 'warning');
        const resp2 = await fetchWithTimeout(cdnUrl);
        if (!resp2.ok) throw new Error(`HTTP ${resp2.status} (CDN тоже недоступен)`);
        addLog(`✅ Загружено через резервный CDN`, 'success');
        return await resp2.arrayBuffer();
    }
}

// ===================== РЕПОЗИТОРИИ ДАННЫХ =====================

class BaseRepository {
    constructor() { this.data = new Map(); }

    async load(url) {
        addLog(`📥 Загрузка base: ${url}`, 'loading');
        const rows = await this.fetchOdsRows(url);
        addLog(`📊 Получено ${rows.length} строк из base.ods`, 'info');
        this.parse(rows);
        return this.data;
    }

    async fetchOdsRows(url) {
        const ab = await fetchArrayBufferSmart(url);
        const wb = XLSX.read(ab, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    }

    parse(rows) {
        this.data.clear();
        addLog('🔍 Поиск заголовка в base.ods...', 'info');
        let headerIdx = -1;
        for(let i = 0; i < Math.min(30, rows.length); i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const joined = String(row.join(' ')).toLowerCase();
            if (joined.includes('номер') || joined.includes('участок')) {
                headerIdx = i;
                addLog(`📍 Заголовок найден на строке ${i}`, 'success');
                break;
            }
        }
        if (headerIdx === -1) {
            addLog('⚠️ Заголовок не найден, ищем первую строку с номером участка', 'info');
            for(let i = 0; i < Math.min(30, rows.length); i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const col0 = String(row[0] || '').trim();
                if (/^\d{1,3}[а-яёa-zA-Z]?$/.test(col0)) {
                    headerIdx = Math.max(0, i - 1);
                    addLog(`📍 Данные начинаются со строки ${i}, заголовок на ${headerIdx}`, 'info');
                    break;
                }
            }
        }
        if (headerIdx === -1) { addLog('⚠️ Заголовок не найден, начинаем с 0', 'error'); headerIdx = 0; }

        const headerRow = rows[headerIdx] || [];
        addLog(`📋 Заголовок: ${headerRow.join(' | ')}`, 'info');

        // ВАЖНО: порядок проверок имеет значение — сначала самые специфичные заголовки
        // (кадастровый номер, площадь участка), иначе общее правило "содержит 'участок'"
        // перехватывает их и ломает определение колонки с номером участка.
        const colMap = { plotNumber: 0, owner: 1 };
        headerRow.forEach((cell, idx) => {
            const val = String(cell || '').toLowerCase().trim();
            if (!val) return;
            if (val.includes('кадастров')) { colMap.cadastral = idx; return; }
            if (val.includes('площадь')) { colMap.area = idx; return; }
            if (val.includes('членств')) { colMap.membership = idx; return; }
            if (val.includes('вид собственност')) { colMap.ownershipType = idx; return; }
            if (val.includes('доля')) { colMap.share = idx; return; }
            if (val.includes('дата приобретен')) { colMap.acquisitionDate = idx; return; }
            if (val.includes('юридический адрес')) { colMap.legalAddress = idx; return; }
            if (val.includes('почтовый адрес')) { colMap.postalAddress = idx; return; }
            if (val.includes('адрес участка') || (val.includes('адрес') && val.includes('участ'))) { colMap.plotAddress = idx; return; }
            if (val.includes('номер') || val === '№' || val.includes('участок')) { colMap.plotNumber = idx; return; }
            if (val.includes('владелец') || val.includes('фио')) { colMap.owner = idx; return; }
            if (val.includes('телефон')) { colMap.phone = idx; return; }
            if (val.includes('почта') || val.includes('e-mail') || val.includes('email')) { colMap.email = idx; return; }
        });
        addLog(`📌 Колонки: номер=${colMap.plotNumber}, владелец=${colMap.owner}, членство=${colMap.membership}, площадь=${colMap.area}, кадастр=${colMap.cadastral}`, 'info');

        let count = 0;
        for(let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const plotRaw = String(row[colMap.plotNumber] || '').trim();
            if (!plotRaw) continue;
            if (plotRaw.toLowerCase() === 'итого' || plotRaw.toLowerCase() === 'всего') continue;
            const key = plotRaw.toLowerCase();
            const membershipRaw = colMap.membership !== undefined ? String(row[colMap.membership] || '').trim() : '';
            const isMember = !!membershipRaw && !membershipRaw.toLowerCase().includes('не является');
            this.data.set(key, {
                plotNumber: String(plotRaw),
                owner: String(row[colMap.owner] || ''),
                phone: colMap.phone !== undefined ? String(row[colMap.phone] || '') : '',
                email: colMap.email !== undefined ? String(row[colMap.email] || '') : '',
                plotAddress: colMap.plotAddress !== undefined ? String(row[colMap.plotAddress] || '') : '',
                area: colMap.area !== undefined ? String(row[colMap.area] || '') : '',
                cadastral: colMap.cadastral !== undefined ? String(row[colMap.cadastral] || '') : '',
                membershipRaw: membershipRaw,
                isMember: isMember,
                ownershipType: colMap.ownershipType !== undefined ? String(row[colMap.ownershipType] || '') : '',
                share: colMap.share !== undefined ? String(row[colMap.share] || '') : '',
                acquisitionDate: colMap.acquisitionDate !== undefined ? String(row[colMap.acquisitionDate] || '') : '',
                legalAddress: colMap.legalAddress !== undefined ? String(row[colMap.legalAddress] || '') : '',
                postalAddress: colMap.postalAddress !== undefined ? String(row[colMap.postalAddress] || '') : '',
            });
            count++;
        }
        addLog(`✅ Загружено ${count} участков в base`, 'success');
    }

    get(plotKey){ return this.data.get(plotKey); }
    getAll(){ return Array.from(this.data.values()); }
}

class DebitRepository {
    constructor(){ this.data = new Map(); }

    async load(url){
        addLog(`📥 Загрузка debit: ${url}`, 'loading');
        const rows = await this.fetchOdsRows(url);
        addLog(`📊 Получено ${rows.length} строк из debit.ods`, 'info');
        this.parse(rows);
        return this.data;
    }

    async fetchOdsRows(url){
        const ab = await fetchArrayBufferSmart(url);
        const wb = XLSX.read(ab,{type:'array'});
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    }

    parse(rows){
        this.data.clear();
        let cur = null;
        let started = false;
        let count = 0;

        for(let i = 0; i < rows.length; i++){
            const r = rows[i];
            if (!r || r.length === 0) continue;
            const c0 = String(r[0] || '').trim();
            const c1 = String(r[1] || '').trim();

            if (!started) {
                if (c0.toLowerCase().includes('номер') || /^\d{1,3}[а-яё]?$/i.test(c0)) {
                    started = true;
                } else { continue; }
            }

            const debtEnd = this.toNum(r[7]);
            const overpayEnd = this.toNum(r[8]);

            if(/^\d{1,3}[а-яё]?$/i.test(c0) && c1){
                if(cur) { this.data.set(cur.plotNumber, cur); count++; }
                cur = {
                    plotNumber: c0,
                    owner: c1,
                    totalDebt: debtEnd,
                    overpayEnd: overpayEnd,
                    membership: 0,
                    target: 0,
                    arrears: 0,
                    work: 0,
                    electricity: 0,
                    details: []
                };
            } else if(cur && c0 && !/^\d/.test(c0)){
                const amount = debtEnd;
                if(amount > 0.001){
                    const name = c0.toLowerCase();
                    if(name.includes('членские')) {
                        cur.membership += amount;
                        cur.details.push({type:'membership', amount, label:c0});
                    } else if(name.includes('целевые')) {
                        cur.target += amount;
                        cur.details.push({type:'target', amount, label:c0});
                    } else if(name.includes('отработка')) {
                        cur.work += amount;
                        cur.details.push({type:'work', amount, label:c0});
                    } else if(name.includes('задолженность прошлых лет')) {
                        cur.arrears += amount;
                        cur.details.push({type:'arrears', amount, label:c0});
                    } else if(name.includes('электроэнергия')) {
                        cur.electricity += amount;
                        cur.details.push({type:'electricity', amount, label:c0});
                    }
                }
            }
        }
        if(cur) { this.data.set(cur.plotNumber, cur); count++; }
        addLog(`✅ Загружено ${count} участков в debit`, 'success');
    }

    toNum(v){
        const s = String(v || '').replace(',', '.').replace(/[^\d.-]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    get(plotKey){ return this.data.get(plotKey); }
    getAll(){ return Array.from(this.data.values()); }
}

class ElectricityRepository {
    constructor(){ this.data = new Map(); }

    async load(url){
        addLog(`📥 Загрузка ee: ${url}`, 'loading');
        const rows = await this.fetchOdsRows(url);
        addLog(`📊 Получено ${rows.length} строк из ee.ods`, 'info');
        this.parse(rows);
        return this.data;
    }

    async fetchOdsRows(url){
        const ab = await fetchArrayBufferSmart(url);
        const wb = XLSX.read(ab,{type:'array'});
        return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    }

    parse(rows){
        this.data.clear();
        let started = false;
        let count = 0;

        for(let i = 0; i < rows.length; i++){
            const r = rows[i];
            if (!r || r.length === 0) continue;
            const plotRaw = String(r[0] || '').trim();

            if(!started && (plotRaw.toLowerCase().includes('участок') || plotRaw === '№' || /^\d/.test(plotRaw))) {
                started = true;
            }
            if(!started) continue;
            if(!/^\d{1,3}[а-яё]?$/i.test(plotRaw)) continue;

            const key = plotRaw.toLowerCase();
            this.data.set(key, {
                plotNumber: String(plotRaw),
                owner: String(r[1] || ''),
                readingDate: String(r[4] || ''),
                prevReading: this.toNum(r[5]),
                currReading: this.toNum(r[6]),
                consumption: this.toNum(r[7]),
                tariff: 3.82
            });
            count++;
        }
        addLog(`✅ Загружено ${count} участков в ee`, 'success');
    }

    toNum(v){
        const s = String(v || '').replace(',', '.').replace(/[^\d.-]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    get(plotKey){ return this.data.get(plotKey); }
    getAll(){ return Array.from(this.data.values()); }
}

// ===================== ИНИЦИАЛИЗАЦИЯ РЕПОЗИТОРИЕВ =====================
let baseRepo = new BaseRepository();
let debitRepo = new DebitRepository();
let eeRepo = new ElectricityRepository();
// ===================== СЕРВИС ПАСПОРТА УЧАСТКА =====================
class PlotPassportService {
    constructor(baseRepo, debitRepo, eeRepo){
        this.base = baseRepo;
        this.debit = debitRepo;
        this.ee = eeRepo;
    }

    getFullPassport(plotNumber){
        const norm = String(plotNumber).trim().toLowerCase();
        const base = this.base.get(norm) || null;
        const debit = this.debit.get(norm) || null;
        const ee = this.ee.get(norm) || null;
        if(!base && !debit && !ee) return null;
        return { plotNumber: norm, base, debit, ee };
    }

    searchAll(query){
        const q = String(query || '').trim();
        if(!q) return [];

        const allKeys = new Set();
        this.base.getAll().forEach(b => allKeys.add(String(b.plotNumber).toLowerCase()));
        this.debit.getAll().forEach(d => allKeys.add(String(d.plotNumber).toLowerCase()));
        this.ee.getAll().forEach(e => allKeys.add(String(e.plotNumber).toLowerCase()));

        const results = [];
        for(const key of allKeys){
            const passport = this.getFullPassport(key);
            if(!passport) continue;
            const base = passport.base;
            const plotNumber = (base && base.plotNumber) || passport.plotNumber;
            const ownerName = (base && base.owner) || (passport.debit && passport.debit.owner) || (passport.ee && passport.ee.owner) || '';
            const extra = base ? [base.phone, base.email, base.plotAddress] : [];
            if (plotSearchMatch(plotNumber, ownerName, q, extra)) results.push(passport);
        }
        return results;
    }
}

// ===================== ЗАГРУЗКА ДАННЫХ =====================
async function fetchAndParseFile(url) {
    try {
        const ab = await fetchArrayBufferSmart(url);
        const wb = XLSX.read(ab, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        addLog(`✅ Загружено ${rows.length} строк из ${url}`, 'success');
        return rows;
    } catch(e) {
        addLog(`⚠️ Ошибка загрузки ${url}: ${e.message}`, 'warning');
        return [];
    }
}

async function loadAllData() {
    const statusDiv = document.getElementById('statusMsg');
    const fileInfo = document.getElementById('navFileInfo');
    statusDiv.innerHTML = '⏳ Загрузка файлов...';
    statusDiv.className = 'status-msg loading';
    fileInfo.textContent = '⏳ Загрузка...';
    addLog('🔄 Начинаем загрузку данных с сервера...', 'loading');

    try {
        // Загружаем все файлы параллельно
        const [baseRows, debitRows, eeRows, fiftyRows, fiftyOneRows, seventyOneRows] = await Promise.all([
            baseRepo.fetchOdsRows(BASE_URL + FILES.base),
            debitRepo.fetchOdsRows(BASE_URL + FILES.debit),
            eeRepo.fetchOdsRows(BASE_URL + FILES.ee),
            fetchAndParseFile(BASE_URL + FILES['50']),
            fetchAndParseFile(BASE_URL + FILES['51']),
            fetchAndParseFile(BASE_URL + FILES['71'])
        ]);

        // Парсим базовые данные
        baseRepo.parse(baseRows);
        debitRepo.parse(debitRows);
        eeRepo.parse(eeRows);

        // Создаем финансовый анализатор
        financialAnalyzer = new FinancialAnalyzer();
        await financialAnalyzer.loadFromFiles({
            '50': fiftyRows,
            '51': fiftyOneRows,
            '71': seventyOneRows
        });

        // Строим участки из debit
        passportService = new PlotPassportService(baseRepo, debitRepo, eeRepo);
        const plots = buildPlotsFromDebit();

        if (!plots.length) {
            setStatus('⚠️ Должников с долгом не найдено.', 'warning');
            fileInfo.textContent = 'Нет данных';
            return;
        }

        allPlots = plots;
        allPlotsAll = buildAllPlotsForReceipts();
        originalPlotsBackup = [...plots];

        // Обновляем статистику в навигации
        const totals = financialAnalyzer.getTotals();
        const balance51 = getBalanceFromFile('51');
        const balance71 = getBalanceFromFile('71');
        const balance50 = getBalanceFromFile('50');
        const totalBalance = balance51 + balance71 + balance50;
        fileInfo.textContent = `📊 Остаток: ${fmtShort(totalBalance)} ₽`;

        statusDiv.innerHTML = `✅ Данные успешно загружены. Доходы: ${fmt(totals.income)} ₽, Расходы: ${fmt(totals.expense)} ₽, Баланс: ${fmt(totals.balance)} ₽`;
        statusDiv.className = 'status-msg success';
        addLog(`📊 Финансы: доходы=${totals.income}, расходы=${totals.expense}, баланс=${totals.balance}`, 'success');
        addLog(`📊 Участков с долгами: ${plots.length}`, 'info');

        onDataLoaded();
        renderFinancePage();

    } catch(e) {
        console.error('❌ Ошибка загрузки:', e);
        addLog(`❌ ОШИБКА: ${e.message}`, 'error');
        statusDiv.innerHTML = `❌ Ошибка загрузки: ${e.message}<br><small>Проверьте интернет-соединение. Можно загрузить локальный файл.</small>`;
        statusDiv.className = 'status-msg error';
        fileInfo.textContent = '❌ Ошибка загрузки';
    }
}

function getElectricityInfo(plotNumber) {
    const ee = eeRepo.get(String(plotNumber).toLowerCase());
    return {
        prevReading: ee ? (ee.currReading || ee.prevReading || 0) : null,
        tariff: ee ? (ee.tariff || 3.82) : 3.82,
        readingDate: ee ? (ee.readingDate || '') : ''
    };
}

function buildPlotsFromDebit() {
    const plots = [];
    const debitItems = debitRepo.getAll();

    for (const d of debitItems) {
        if (d.totalDebt < CFG.minDebt) continue;
        const base = baseRepo.get(String(d.plotNumber).toLowerCase()) || {};

        const plot = {
            id: `${d.plotNumber}_${d.owner}`,
            plotNumber: d.plotNumber,
            payerName: base.owner || d.owner || '—',
            phone: base.phone || '',
            totalDebt: d.totalDebt || 0,
            membershipSum: d.membership || 0,
            targetSum: d.target || 0,
            arrearsSum: d.arrears || 0,
            workSum: d.work || 0,
            electricitySum: d.electricity || 0,
            ee: getElectricityInfo(d.plotNumber),
            details: d.details ? d.details.map(det => ({ label: det.label, cat: det.type })) : [],
            qrParts: d.details ? d.details.map(det => {
                const typeMap = {
                    membership: 'Членские взносы',
                    target: 'Целевые взносы',
                    arrears: 'Задолженность прошлых лет',
                    work: 'Отработка',
                    electricity: 'Электроэнергия'
                };
                return `${typeMap[det.type] || det.type}: ${det.amount.toFixed(2)} руб.`;
            }) : []
        };
        plots.push(plot);
    }
    return plots;
}

function buildAllPlotsForReceipts() {
    // Все участки из base (191 участок), дополняем данными из debit если есть
    const plots = [];
    const seen = new Set();
    const debitItems = debitRepo.getAll();
    const debitByPlot = new Map(debitItems.map(d => [String(d.plotNumber).toLowerCase(), d]));

    // Сначала все участки из base
    const baseItems = baseRepo.getAll ? baseRepo.getAll() : [];
    for (const base of baseItems) {
        const key = String(base.plotNumber || base.number || '').toLowerCase();
        if (!key) continue;
        const d = debitByPlot.get(key) || {};
        const plotNum = base.plotNumber || base.number || key;
        const id = `${plotNum}_${base.owner || ''}`;
        seen.add(key);
        plots.push({
            id,
            plotNumber: String(plotNum),
            payerName: base.owner || '—',
            isMember: !!base.isMember,
            hasMembershipInfo: !!base.membershipRaw,
            totalDebt: d.totalDebt || 0,
            membershipSum: d.membership || 0,
            targetSum: d.target || 0,
            arrearsSum: d.arrears || 0,
            workSum: d.work || 0,
            electricitySum: d.electricity || 0,
            ee: getElectricityInfo(plotNum),
            details: d.details ? d.details.map(det => ({ label: det.label, cat: det.type })) : [],
            qrParts: d.details ? d.details.map(det => {
                const typeMap = { membership:'Членские взносы', target:'Целевые взносы', arrears:'Задолженность прошлых лет', work:'Отработка', electricity:'Электроэнергия' };
                return `${typeMap[det.type]||det.type}: ${det.amount.toFixed(2)} руб.`;
            }) : []
        });
    }

    // Добавляем должников которых нет в base
    for (const d of debitItems) {
        const key = String(d.plotNumber).toLowerCase();
        if (seen.has(key)) continue;
        const base = baseRepo.get(key) || {};
        plots.push({
            id: `${d.plotNumber}_${d.owner}`,
            plotNumber: String(d.plotNumber),
            payerName: base.owner || d.owner || '—',
            isMember: !!base.isMember,
            hasMembershipInfo: !!base.membershipRaw,
            totalDebt: d.totalDebt || 0,
            membershipSum: d.membership || 0,
            targetSum: d.target || 0,
            arrearsSum: d.arrears || 0,
            workSum: d.work || 0,
            electricitySum: d.electricity || 0,
            ee: getElectricityInfo(d.plotNumber),
            details: d.details ? d.details.map(det => ({ label: det.label, cat: det.type })) : [],
            qrParts: d.details ? d.details.map(det => {
                const typeMap = { membership:'Членские взносы', target:'Целевые взносы', arrears:'Задолженность прошлых лет', work:'Отработка', electricity:'Электроэнергия' };
                return `${typeMap[det.type]||det.type}: ${det.amount.toFixed(2)} руб.`;
            }) : []
        });
    }

    // Сортируем по номеру участка
    plots.sort((a, b) => {
        const na = parseFloat(a.plotNumber) || 0, nb = parseFloat(b.plotNumber) || 0;
        return na - nb || a.plotNumber.localeCompare(b.plotNumber);
    });
    return plots;
}

function onDataLoaded() {
    document.getElementById('uploadCard').style.display = 'none';
    document.getElementById('dashContent').style.display = '';
    document.getElementById('debtorsNoData').style.display = 'none';
    document.getElementById('debtorsDataView').style.display = '';
    document.getElementById('receiptsNoData').style.display = 'none';
    document.getElementById('receiptsDataView').style.display = '';

    renderDashboard();
    renderDebtorsTable();
    renderReceiptsList();
    setDefaultDates();
    renderPassportList();
}

function setDefaultDates() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    document.getElementById('financeDateFrom').value = formatDate(startOfYear);
    document.getElementById('financeDateTo').value = formatDate(now);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ===================== РАБОТА С ЛОКАЛЬНЫМ ФАЙЛОМ =====================
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));

uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) handleLocalFile(f);
});

fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleLocalFile(e.target.files[0]);
});

async function handleLocalFile(file) {
    setStatus('⏳ Обработка локального файла...', 'loading');
    addLog(`📁 Обработка локального файла: ${file.name}`, 'loading');

    try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, {type:'array'});
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:''});

        // Определяем тип файла по имени
        const fileName = file.name.toLowerCase();
        let fileType = 'unknown';
        if (fileName.includes('base')) fileType = 'base';
        else if (fileName.includes('debit')) fileType = 'debit';
        else if (fileName.includes('ee')) fileType = 'ee';
        else if (fileName.includes('50')) fileType = '50';
        else if (fileName.includes('51')) fileType = '51';
        else if (fileName.includes('71')) fileType = '71';

        // Загружаем остальные файлы с сервера
        const [debitRows, eeRows, fiftyRows, fiftyOneRows, seventyOneRows] = await Promise.all([
            fileType === 'debit' ? Promise.resolve(rows) : debitRepo.fetchOdsRows(BASE_URL + FILES.debit),
            fileType === 'ee' ? Promise.resolve(rows) : eeRepo.fetchOdsRows(BASE_URL + FILES.ee),
            fileType === '50' ? Promise.resolve(rows) : fetchAndParseFile(BASE_URL + FILES['50']),
            fileType === '51' ? Promise.resolve(rows) : fetchAndParseFile(BASE_URL + FILES['51']),
            fileType === '71' ? Promise.resolve(rows) : fetchAndParseFile(BASE_URL + FILES['71'])
        ]);

        // Обрабатываем загруженные данные
        if (fileType === 'base') {
            baseRepo.parse(rows);
        } else if (fileType === 'debit') {
            debitRepo.parse(rows);
        } else if (fileType === 'ee') {
            eeRepo.parse(rows);
        }

        // Всегда пересоздаем финансовый анализатор
        financialAnalyzer = new FinancialAnalyzer();
        await financialAnalyzer.loadFromFiles({
            '50': fiftyRows,
            '51': fiftyOneRows,
            '71': seventyOneRows
        });

        // Пересоздаем passport service
        passportService = new PlotPassportService(baseRepo, debitRepo, eeRepo);

        // Строим участки
        const plots = buildPlotsFromDebit();
        if (!plots.length) {
            setStatus('⚠️ Должников с долгом не найдено.', 'warning');
            return;
        }

        allPlots = plots;
        allPlotsAll = buildAllPlotsForReceipts();
        originalPlotsBackup = [...plots];

        document.getElementById('navFileInfo').textContent = `📁 ${file.name} (локальный)`;
        setStatus(`✅ Локальный файл загружен: ${plots.length} участков`, 'success');
        addLog(`✅ Локальный файл загружен: ${plots.length} участков`, 'success');

        onDataLoaded();
        renderFinancePage();

    } catch(e) {
        addLog(`❌ Ошибка локальной загрузки: ${e.message}`, 'error');
        setStatus('❌ Ошибка: ' + e.message, 'error');
    }
}

// ===================== НАВИГАЦИЯ =====================
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('page-' + tab.dataset.page).classList.add('active');

        if(tab.dataset.page === 'passport' && passportService) renderPassportList();
        if(tab.dataset.page === 'debtors') renderDebtorsTable();
        if(tab.dataset.page === 'receipts') renderReceiptsList();
        if(tab.dataset.page === 'finance') renderFinancePage();
        if(tab.dataset.page === 'electricity') renderElectricityPage();
    });
});

// ===================== СТАТУС =====================
function setStatus(msg, type='info') {
    const el = document.getElementById('statusMsg');
    if(!el) return;
    el.className = 'status-msg ' + type;
    el.innerHTML = msg;
}
// ===================== ДАШБОРД =====================
function renderDashboard() {
    if (!allPlots.length) {
        document.getElementById('statsGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-500);">Нет данных</div>';
        return;
    }

    const total = allPlots.reduce((s, p) => s + p.totalDebt, 0);
    const maxDebt = Math.max(...allPlots.map(p => p.totalDebt));
    const avgDebt = total / allPlots.length;
    const membershipTotal = allPlots.reduce((s, p) => s + p.membershipSum, 0);
    const electricTotal = allPlots.reduce((s, p) => s + p.electricitySum, 0);
    const arrearsTotal = allPlots.reduce((s, p) => s + p.arrearsSum + p.workSum, 0);
    const targetTotal = allPlots.reduce((s, p) => s + p.targetSum, 0);

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card green">
            <div class="stat-label">Всего должников</div>
            <div class="stat-value">${allPlots.length}</div>
            <div class="stat-sub">участков с задолженностью</div>
        </div>
        <div class="stat-card orange">
            <div class="stat-label">Общий долг</div>
            <div class="stat-value">${fmtShort(total)}</div>
            <div class="stat-sub">${fmt(total)} ₽</div>
        </div>
        <div class="stat-card red">
            <div class="stat-label">Максимальный долг</div>
            <div class="stat-value">${fmtShort(maxDebt)}</div>
            <div class="stat-sub">среднее: ${fmtShort(avgDebt)} ₽</div>
        </div>
        <div class="stat-card blue">
            <div class="stat-label">Членские взносы</div>
            <div class="stat-value">${fmtShort(membershipTotal)}</div>
            <div class="stat-sub">${fmt(membershipTotal)} ₽</div>
        </div>
    `;

    // Структура задолженности
    const cats = [
        { label: 'Членские взносы', total: membershipTotal, color: '#2e7d32' },
        { label: 'Задолж. прошлых лет', total: arrearsTotal, color: '#e65100' },
        { label: 'Целевые взносы', total: targetTotal, color: '#1565c0' },
        { label: 'Электроэнергия', total: electricTotal, color: '#7b1fa2' },
    ].filter(c => c.total > 0).sort((a,b) => b.total - a.total);

    const maxCat = Math.max(...cats.map(c => c.total), 1);
    document.getElementById('breakdownChart').innerHTML = cats.map(c => `
        <div class="breakdown-item">
            <div class="breakdown-label">${c.label}</div>
            <div class="breakdown-bar-wrap"><div class="breakdown-bar-fill" style="width:${(c.total/maxCat*100).toFixed(1)}%;background:${c.color};"></div></div>
            <div class="breakdown-amount">${fmt(c.total)} ₽</div>
        </div>
    `).join('');

    // Топ-10 должников
    const top10 = [...allPlots].sort((a,b) => b.totalDebt - a.totalDebt).slice(0, 10);
    document.getElementById('top10List').innerHTML = top10.map((p, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gray-100);">
            <span style="width:22px;text-align:center;font-size:.75rem;color:var(--gray-500);">${i+1}</span>
            <span class="plot-num-badge" style="min-width:55px;">Уч. ${p.plotNumber}</span>
            <span style="flex:1;font-size:.82rem;">${p.payerName}</span>
            <span style="font-weight:700;color:var(--red-600);font-size:.85rem;">${fmt(p.totalDebt)} ₽</span>
        </div>
    `).join('');

    // Распределение сумм долга
    const buckets = [
        { label: '<500', min: 0, max: 500, count: 0 },
        { label: '0.5–1K', min: 500, max: 1000, count: 0 },
        { label: '1–3K', min: 1000, max: 3000, count: 0 },
        { label: '3–5K', min: 3000, max: 5000, count: 0 },
        { label: '5–10K', min: 5000, max: 10000, count: 0 },
        { label: '10–20K', min: 10000, max: 20000, count: 0 },
        { label: '>20K', min: 20000, max: Infinity, count: 0 },
    ];
    allPlots.forEach(p => {
        const b = buckets.find(b => p.totalDebt >= b.min && p.totalDebt < b.max);
        if (b) b.count++;
    });
    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    document.getElementById('debtDistChart').innerHTML = buckets.map(b => `
        <div class="bar-col">
            <div class="bar-label">${b.count}</div>
            <div class="bar" style="height:${Math.max(4, b.count/maxCount*100)}px;background:${b.count > 10 ? 'var(--red-400)' : 'var(--green-400)'}"></div>
            <div class="bar-label">${b.label}</div>
        </div>
    `).join('');
}

// ===================== ТАБЛИЦА ДОЛЖНИКОВ =====================
function getFilteredPlots() {
    const search = document.getElementById('searchInput').value;
    const fType = document.getElementById('filterType').value;
    const fRange = document.getElementById('filterDebtRange').value;

    return allPlots.filter(p => {
        if (search) {
            const detailsText = p.details.map(d => d.label).join(' ');
            if (!plotSearchMatch(p.plotNumber, p.payerName, search, [detailsText])) return false;
        }

        if (fType) {
            if (fType === 'membership' && !p.membershipSum) return false;
            if (fType === 'target' && !p.targetSum) return false;
            if (fType === 'arrears' && !p.arrearsSum) return false;
            if (fType === 'work' && !p.workSum) return false;
            if (fType === 'electricity' && !p.electricitySum) return false;
        }

        if (fRange) {
            if (fRange === 'small' && p.totalDebt >= 1000) return false;
            if (fRange === 'medium' && (p.totalDebt < 1000 || p.totalDebt >= 5000)) return false;
            if (fRange === 'large' && (p.totalDebt < 5000 || p.totalDebt >= 15000)) return false;
            if (fRange === 'huge' && p.totalDebt < 15000) return false;
        }
        return true;
    }).sort((a, b) => {
        const va = a[sortCol] !== undefined ? a[sortCol] : 0;
        const vb = b[sortCol] !== undefined ? b[sortCol] : 0;
        if (typeof va === 'string') return va.localeCompare(vb) * sortDir;
        return (va - vb) * sortDir;
    });
}

// Настройки видимости колонок
const DEFAULT_COLS = { phone: true, membership: true, target: true, arrears: true, work: true, electricity: true, details: true };
function getColVisibility() {
    try {
        const saved = localStorage.getItem('snt_debtor_cols');
        return saved ? { ...DEFAULT_COLS, ...JSON.parse(saved) } : { ...DEFAULT_COLS };
    } catch(e) { return { ...DEFAULT_COLS }; }
}
function saveColVisibility(cols) {
    localStorage.setItem('snt_debtor_cols', JSON.stringify(cols));
}
function applyColVisibility() {
    const cols = getColVisibility();
    document.querySelectorAll('.col-toggle').forEach(cb => {
        cb.checked = !!cols[cb.dataset.col];
    });
    Object.keys(cols).forEach(key => {
        const visible = cols[key];
        document.querySelectorAll(`.col-${key}`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    });
}

document.getElementById('toggleColumnsBtn').addEventListener('click', () => {
    const panel = document.getElementById('columnSettingsPanel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
});

document.querySelectorAll('.col-toggle').forEach(cb => {
    cb.addEventListener('change', () => {
        const cols = getColVisibility();
        cols[cb.dataset.col] = cb.checked;
        saveColVisibility(cols);
        applyColVisibility();
        renderDebtorsTable();
    });
});

function renderDebtorsTable() {
    filteredPlots = getFilteredPlots();
    const tbody = document.getElementById('debtorsTableBody');
    const cols = getColVisibility();
    const visibleCount = 4 + Object.values(cols).filter(v => v).length; // чекбокс + № + ФИО + долг + видимые

    if (!filteredPlots.length) {
        tbody.innerHTML = `<tr><td colspan="${visibleCount}" style="text-align:center;padding:30px;color:var(--gray-500);">Нет данных по заданным фильтрам</td></tr>`;
    } else {
        const totalShown = filteredPlots.reduce((s, p) => s + p.totalDebt, 0);
        tbody.innerHTML = filteredPlots.map(p => {
            const checked = selectedIds.has(p.id);
            const typeBadges = [];
            if (p.membershipSum > 0) typeBadges.push(`<span class="badge badge-green">Чл.</span>`);
            if (p.targetSum > 0) typeBadges.push(`<span class="badge badge-blue">Цел.</span>`);
            if (p.arrearsSum + p.workSum > 0) typeBadges.push(`<span class="badge badge-orange">Пр.г.</span>`);
            if (p.electricitySum > 0) typeBadges.push(`<span class="badge badge-gray">Эл.</span>`);

            const phoneCell = p.phone
                ? `<a href="tel:${p.phone.replace(/[^\d+]/g,'')}" style="color:var(--blue-600);text-decoration:none;font-size:.82rem;white-space:nowrap;" title="Позвонить">📞 ${escapeHtml(p.phone)}</a>`
                : '<span style="color:var(--gray-400);font-size:.82rem;">—</span>';

            return `<tr class="${checked?'selected':''}" data-id="${p.id}">
                <td><input type="checkbox" ${checked?'checked':''} class="row-cb" data-id="${p.id}" style="width:17px;height:17px;accent-color:var(--green-600);cursor:pointer;"></td>
                <td><span class="plot-num-badge">${p.plotNumber}</span></td>
                <td>${p.payerName}</td>
                <td class="plot-debt-amt">${fmt(p.totalDebt)}</td>
                ${cols.phone ? `<td class="col-phone">${phoneCell}</td>` : ''}
                ${cols.membership ? `<td class="col-membership" style="color:${p.membershipSum?'var(--gray-800)':'var(--gray-400)'}">${p.membershipSum>0?fmt(p.membershipSum):'—'}</td>` : ''}
                ${cols.target ? `<td class="col-target" style="color:${p.targetSum?'var(--gray-800)':'var(--gray-400)'}">${p.targetSum>0?fmt(p.targetSum):'—'}</td>` : ''}
                ${cols.arrears ? `<td class="col-arrears" style="color:${p.arrearsSum?'var(--gray-800)':'var(--gray-400)'}">${p.arrearsSum>0?fmt(p.arrearsSum):'—'}</td>` : ''}
                ${cols.work ? `<td class="col-work" style="color:${p.workSum?'var(--gray-800)':'var(--gray-400)'}">${p.workSum>0?fmt(p.workSum):'—'}</td>` : ''}
                ${cols.electricity ? `<td class="col-electricity" style="color:${p.electricitySum?'var(--gray-800)':'var(--gray-400)'}">${p.electricitySum>0?fmt(p.electricitySum):'—'}</td>` : ''}
                ${cols.details ? `<td class="col-details"><div style="display:flex;gap:4px;flex-wrap:wrap;">${typeBadges.join('')} <span style="font-size:.76rem;color:var(--gray-500);">${p.details.map(d=>d.label).join('; ')}</span></div></td>` : ''}
            </tr>`;
        }).join('');
        document.getElementById('tableTotal').textContent = `Показано: ${filteredPlots.length} из ${allPlots.length} | Сумма: ${fmt(totalShown)} ₽`;
    }

    document.getElementById('filteredCountBadge').textContent = `Показано: ${filteredPlots.length}`;
    document.getElementById('selectedCountBadge').textContent = `Выбрано: ${selectedIds.size}`;
    document.getElementById('selectAllCb').indeterminate = selectedIds.size > 0 && selectedIds.size < filteredPlots.length;
    document.getElementById('selectAllCb').checked = filteredPlots.length > 0 && filteredPlots.every(p => selectedIds.has(p.id));

    // Обработчики чекбоксов
    document.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) selectedIds.add(cb.dataset.id);
            else selectedIds.delete(cb.dataset.id);
            renderDebtorsTable();
        });
    });

    document.querySelectorAll('#debtorsTableBody tr').forEach(tr => {
        tr.addEventListener('click', e => {
            if (e.target.type === 'checkbox') return;
            const id = tr.dataset.id;
            if (selectedIds.has(id)) selectedIds.delete(id);
            else selectedIds.add(id);
            renderDebtorsTable();
        });
    });
}

// ===================== СОРТИРОВКА =====================
document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortCol === col) sortDir *= -1;
        else { sortCol = col; sortDir = -1; }

        document.querySelectorAll('.sort-arrow').forEach(a => a.className = 'sort-arrow');
        th.querySelector('.sort-arrow').className = 'sort-arrow ' + (sortDir === 1 ? 'asc' : 'desc');
        renderDebtorsTable();
    });
});

// ===================== ФИЛЬТРЫ =====================
document.getElementById('selectAllCb').addEventListener('change', e => {
    filteredPlots.forEach(p => {
        if (e.target.checked) selectedIds.add(p.id);
        else selectedIds.delete(p.id);
    });
    renderDebtorsTable();
});

document.getElementById('searchInput').addEventListener('input', renderDebtorsTable);
document.getElementById('filterType').addEventListener('change', renderDebtorsTable);
document.getElementById('filterDebtRange').addEventListener('change', renderDebtorsTable);

document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterDebtRange').value = '';
    selectedIds.clear();
    renderDebtorsTable();
});

document.getElementById('openReceiptsForSelected').addEventListener('click', () => {
    if (!selectedIds.size) { alert('Выберите участки для генерации квитанций'); return; }
    receiptSelectedIds = new Set(selectedIds);
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-tab[data-page="receipts"]').classList.add('active');
    document.getElementById('page-receipts').classList.add('active');
    renderReceiptsList();
});

// ===================== ЭКСПОРТ =====================
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    const plots = filteredPlots.length ? filteredPlots : allPlots;
    const cols = getColVisibility();
    const header = ['№ участка','ФИО','Итого долг'];
    if (cols.phone) header.push('Телефон');
    if (cols.membership) header.push('Членские');
    if (cols.target) header.push('Целевые');
    if (cols.arrears) header.push('Задолж. прош.');
    if (cols.work) header.push('Отработка');
    if (cols.electricity) header.push('Электроэнергия');
    if (cols.details) header.push('Состав');
    const rows = plots.map(p => {
        const row = [p.plotNumber, p.payerName, p.totalDebt.toFixed(2)];
        if (cols.phone) row.push(p.phone || '');
        if (cols.membership) row.push(p.membershipSum.toFixed(2));
        if (cols.target) row.push(p.targetSum.toFixed(2));
        if (cols.arrears) row.push(p.arrearsSum.toFixed(2));
        if (cols.work) row.push(p.workSum.toFixed(2));
        if (cols.electricity) row.push(p.electricitySum.toFixed(2));
        if (cols.details) row.push(p.details.map(d=>d.label).join('; '));
        return row;
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dolzhniki_snt.csv';
    a.click();
});

document.getElementById('exportXlsBtn').addEventListener('click', () => {
    const plots = filteredPlots.length ? filteredPlots : allPlots;
    const wb = XLSX.utils.book_new();
    const data = [['№ участка','ФИО','Итого долг','Членские взносы','Целевые взносы','Задолж. прошлых лет','Отработка','Электроэнергия','Состав долга']];
    plots.forEach(p => data.push([p.plotNumber, p.payerName, p.totalDebt, p.membershipSum, p.targetSum, p.arrearsSum, p.workSum, p.electricitySum, p.details.map(d=>d.label).join('; ')]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Должники');
    XLSX.writeFile(wb, 'dolzhniki_snt.xlsx');
});

document.getElementById('printDebtorsBtn').addEventListener('click', () => {
    const plots = filteredPlots.length ? filteredPlots : allPlots;
    const cols = getColVisibility();
    const printCols = [];
    printCols.push('<th>№ уч.</th>');
    printCols.push('<th>ФИО</th>');
    if (cols.phone) printCols.push('<th>Телефон</th>');
    printCols.push('<th>Сумма</th>');
    if (cols.membership) printCols.push('<th>Чл. взносы</th>');
    if (cols.target) printCols.push('<th>Целевые</th>');
    if (cols.arrears) printCols.push('<th>Прош. годы</th>');
    if (cols.work) printCols.push('<th>Отработка</th>');
    if (cols.electricity) printCols.push('<th>Электр.</th>');
    if (cols.details) printCols.push('<th>Состав</th>');

    const rows = plots.map(p => {
        const cells = [];
        cells.push(`<td>${p.plotNumber}</td>`);
        cells.push(`<td>${escapeHtml(p.payerName)}</td>`);
        if (cols.phone) cells.push(`<td>${p.phone ? escapeHtml(p.phone) : '—'}</td>`);
        cells.push(`<td><b>${fmt(p.totalDebt)} ₽</b></td>`);
        if (cols.membership) cells.push(`<td>${p.membershipSum>0?fmt(p.membershipSum):'—'}</td>`);
        if (cols.target) cells.push(`<td>${p.targetSum>0?fmt(p.targetSum):'—'}</td>`);
        if (cols.arrears) cells.push(`<td>${p.arrearsSum>0?fmt(p.arrearsSum):'—'}</td>`);
        if (cols.work) cells.push(`<td>${p.workSum>0?fmt(p.workSum):'—'}</td>`);
        if (cols.electricity) cells.push(`<td>${p.electricitySum>0?fmt(p.electricitySum):'—'}</td>`);
        if (cols.details) cells.push(`<td>${p.details.map(d=>d.label).join('<br>')}</td>`);
        return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><title>Должники СНТ Берёзка-2</title>
        <style>body{font-family:sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;font-size:11px;}th,td{border:1px solid #ccc;padding:5px;}th{background:#e8f5e9;}h2{margin-bottom:12px;}</style>
        </head><body><h2>СНТ «Берёзка-2» — Реестр задолженности (${new Date().toLocaleDateString('ru-RU')})</h2>
        <p>Итого: ${plots.length} участков, сумма: ${fmt(plots.reduce((s,p)=>s+p.totalDebt,0))} ₽</p>
        <table><thead><tr>${printCols.join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
});
// ===================== КВИТАНЦИИ =====================
function getOrInitItemsState(p) {
    if (receiptItemsState.has(p.id)) return receiptItemsState.get(p.id);
    const hasDebt = p.totalDebt > 0;
    const st = {
        membership: { checked: hasDebt && p.membershipSum > 0, amount: p.membershipSum || 0 },
        target: { checked: hasDebt && p.targetSum > 0, amount: p.targetSum || 0 },
        arrears: { checked: hasDebt && p.arrearsSum > 0, amount: p.arrearsSum || 0 },
        work: { checked: hasDebt && p.workSum > 0, amount: p.workSum || 0 },
        electricity: {
            checked: hasDebt && p.electricitySum > 0,
            amount: p.electricitySum || 0,
            prevReading: (p.ee && p.ee.prevReading !== undefined) ? p.ee.prevReading : null,
            currReading: '',
            consumption: 0
        },
        extra: { checked: false, amount: 0, label: '' },
        manualPurpose: ''
    };
    receiptItemsState.set(p.id, st);
    return st;
}

// Пересчитывает сумму э/э по показаниям (если введено текущее показание),
// собирает итоговую сумму и назначение платежа из ВСЕХ отмеченных пунктов сразу
// (можно платить и членские, и целевые, и электричество одной квитанцией).
function recalcRow(p, st, updateDom) {
    const ee = st.electricity;
    if (ee.checked && ee.prevReading !== null && ee.currReading !== '' && ee.currReading !== null) {
        const cur = parseFloat(ee.currReading);
        if (!isNaN(cur) && cur >= ee.prevReading) {
            ee.consumption = Math.round((cur - ee.prevReading) * 100) / 100;
            const tariff = (p.ee && p.ee.tariff) || 3.82;
            ee.amount = Math.round(ee.consumption * tariff * 100) / 100;
        } else {
            ee.consumption = 0;
        }
    }

    let total = 0;
    const parts = [];
    if (st.membership.checked && st.membership.amount > 0) { total += st.membership.amount; parts.push(`Членские взносы: ${st.membership.amount.toFixed(2)} руб.`); }
    if (st.target.checked && st.target.amount > 0) { total += st.target.amount; parts.push(`Целевые взносы: ${st.target.amount.toFixed(2)} руб.`); }
    if (st.arrears.checked && st.arrears.amount > 0) { total += st.arrears.amount; parts.push(`Задолженность прошлых лет: ${st.arrears.amount.toFixed(2)} руб.`); }
    if (st.work.checked && st.work.amount > 0) { total += st.work.amount; parts.push(`Отработка: ${st.work.amount.toFixed(2)} руб.`); }
    if (st.electricity.checked && st.electricity.amount > 0) {
        total += st.electricity.amount;
        if (st.electricity.consumption > 0) {
            parts.push(`Электроэнергия ${st.electricity.consumption} кВт·ч (пок. ${st.electricity.prevReading}→${st.electricity.currReading}): ${st.electricity.amount.toFixed(2)} руб.`);
        } else {
            parts.push(`Электроэнергия: ${st.electricity.amount.toFixed(2)} руб.`);
        }
    }
    if (st.extra.checked && st.extra.amount > 0) {
        total += st.extra.amount;
        parts.push(`${(st.extra.label && st.extra.label.trim()) ? st.extra.label.trim() : 'Прочее'}: ${st.extra.amount.toFixed(2)} руб.`);
    }

    const purpose = (st.manualPurpose && st.manualPurpose.trim()) ? st.manualPurpose.trim() : parts.join(', ');
    receiptCustomAmounts.set(p.id, { amount: total, mode: 'custom', purpose });

    if (updateDom) {
        const totalBadge = document.querySelector(`.receipt-total-badge[data-id="${CSS.escape(p.id)}"]`);
        if (totalBadge) totalBadge.textContent = `${fmt(total)} ₽`;
        const totalText = document.querySelector(`.receipt-total-text[data-id="${CSS.escape(p.id)}"]`);
        if (totalText) totalText.textContent = `${fmt(total)} ₽`;
        const calcText = document.querySelector(`.receipt-ee-calc-text[data-id="${CSS.escape(p.id)}"]`);
        if (calcText) calcText.textContent = st.electricity.consumption > 0 ? `= ${st.electricity.consumption} кВт·ч` : '';
        const eeAmtInp = document.querySelector(`.receipt-item-amount-inp[data-id="${CSS.escape(p.id)}"][data-key="electricity"]`);
        if (eeAmtInp && document.activeElement !== eeAmtInp) eeAmtInp.value = st.electricity.amount.toFixed(2);
        const counter = document.querySelector(`.receipt-purpose-counter[data-id="${CSS.escape(p.id)}"]`);
        if (counter) {
            const overLimit = purpose.length > PURPOSE_MAX_LEN;
            counter.textContent = `${purpose.length} / ${PURPOSE_MAX_LEN} символов (лимит банка на назначение платежа)`;
            counter.style.color = overLimit ? 'var(--red-600)' : 'var(--gray-500)';
        }
    }
    return total;
}

function renderCompositionItem(p, key, label, item) {
    return `<div class="receipt-item-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:6px;flex:1;min-width:160px;font-size:.83rem;cursor:pointer;">
            <input type="checkbox" class="receipt-item-cb" data-id="${p.id}" data-key="${key}" ${item.checked?'checked':''} style="width:16px;height:16px;accent-color:var(--green-600);">
            ${label}
        </label>
        <input type="number" class="receipt-item-amount-inp" data-id="${p.id}" data-key="${key}" min="0" step="0.01" value="${(item.amount||0).toFixed(2)}"
            style="width:100px;font-size:.82rem;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;text-align:right;${item.checked?'':'opacity:.5;'}"> ₽
    </div>`;
}

function renderElectricityItem(p, item) {
    const hasPrev = item.prevReading !== null && item.prevReading !== undefined;
    return `<div class="receipt-item-row receipt-ee-row" style="padding:6px 0;border-top:1px dashed var(--gray-200);margin-top:4px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:.83rem;cursor:pointer;">
            <input type="checkbox" class="receipt-item-cb" data-id="${p.id}" data-key="electricity" ${item.checked?'checked':''} style="width:16px;height:16px;accent-color:var(--green-600);">
            ⚡ Электроэнергия
        </label>
        <div class="receipt-ee-details" data-id="${p.id}" style="display:${item.checked?'flex':'none'};gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-left:22px;">
            <span style="font-size:.78rem;color:var(--gray-600);">Пред. показание: <strong>${hasPrev ? item.prevReading : 'нет данных'}</strong></span>
            <input type="number" class="receipt-ee-current-inp" data-id="${p.id}" placeholder="Текущее показание" value="${item.currReading || ''}"
                style="width:130px;font-size:.82rem;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;">
            <span class="receipt-ee-calc-text" data-id="${p.id}" style="font-size:.78rem;color:var(--green-700);font-weight:600;">${item.consumption>0 ? `= ${item.consumption} кВт·ч` : ''}</span>
            <input type="number" class="receipt-item-amount-inp" data-id="${p.id}" data-key="electricity" min="0" step="0.01" value="${(item.amount||0).toFixed(2)}"
                style="width:100px;font-size:.82rem;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;text-align:right;"> ₽
        </div>
    </div>`;
}

function renderCompositionExtra(p, item) {
    return `<div class="receipt-item-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;flex-wrap:wrap;border-top:1px dashed var(--gray-200);margin-top:4px;">
        <label style="display:flex;align-items:center;gap:6px;flex-shrink:0;font-size:.83rem;cursor:pointer;">
            <input type="checkbox" class="receipt-item-cb" data-id="${p.id}" data-key="extra" ${item.checked?'checked':''} style="width:16px;height:16px;accent-color:var(--green-600);">
            Другое / аванс
        </label>
        <input type="text" class="receipt-extra-label-inp" data-id="${p.id}" placeholder="Описание" value="${escapeHtml(item.label||'')}"
            style="flex:1;min-width:100px;font-size:.8rem;padding:4px 8px;border:1px solid var(--gray-300);border-radius:6px;">
        <input type="number" class="receipt-item-amount-inp" data-id="${p.id}" data-key="extra" min="0" step="0.01" value="${(item.amount||0).toFixed(2)}"
            style="width:100px;font-size:.82rem;padding:4px 6px;border:1px solid var(--gray-300);border-radius:6px;text-align:right;"> ₽
    </div>`;
}


function renderReceiptsList() {
    const search = document.getElementById('receiptSearchInput').value;
    const listEl = document.getElementById('receiptPlotsList');
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    let plots = source.filter(p => plotSearchMatch(p.plotNumber, p.payerName, search));
    switch (receiptGroupFilter) {
        case 'debt': plots = plots.filter(p => p.totalDebt > 0); break;
        case 'nodebt': plots = plots.filter(p => !(p.totalDebt > 0)); break;
        case 'electricity': plots = plots.filter(p => p.electricitySum > 0); break;
        case 'member': plots = plots.filter(p => p.isMember); break;
        case 'nonmember': plots = plots.filter(p => p.hasMembershipInfo && !p.isMember); break;
        default: break;
    }

    const plotsById = new Map(plots.map(p => [p.id, p]));

    listEl.innerHTML = plots.map(p => {
        const sel = receiptSelectedIds.has(p.id);
        const typeTags = [];
        if (p.membershipSum > 0) typeTags.push(`<span class="badge badge-green">Чл.</span>`);
        if (p.targetSum > 0) typeTags.push(`<span class="badge badge-blue">Цел.</span>`);
        if (p.arrearsSum > 0 || p.workSum > 0) typeTags.push(`<span class="badge badge-orange">Пр.г.</span>`);
        if (p.electricitySum > 0) typeTags.push(`<span class="badge badge-gray">Эл.</span>`);

        const st = getOrInitItemsState(p);
        const total = recalcRow(p, st, false);
        const saved = receiptCustomAmounts.get(p.id) || { purpose: '' };
        const isOpen = receiptOpenRows.has(p.id);

        return `<div class="plot-row" data-id="${p.id}" style="flex-direction:column;align-items:stretch;padding:10px 14px;gap:0;">
            <div class="receipt-row-main" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <input type="checkbox" ${sel?'checked':''} class="receipt-row-cb" data-id="${p.id}" style="width:17px;height:17px;accent-color:var(--green-600);cursor:pointer;flex-shrink:0;" onclick="event.stopPropagation()">
                <span class="plot-num-badge" style="flex-shrink:0;">Уч.&nbsp;${p.plotNumber}</span>
                <span class="plot-name" style="flex:1;min-width:80px;">${p.payerName}</span>
                <div class="plot-type-badges" style="flex-shrink:0;">${typeTags.join('')}</div>
                <span class="badge badge-green receipt-total-badge" data-id="${p.id}" style="flex-shrink:0;">${fmt(total)}&nbsp;₽</span>
                <button class="btn btn-outline btn-sm receipt-toggle-btn" data-id="${p.id}" style="padding:4px 10px;flex-shrink:0;" onclick="event.stopPropagation()">${isOpen?'▲':'▼'}&nbsp;Состав</button>
                <button class="btn btn-outline btn-sm preview-receipt-btn receipt-row-btn" data-id="${p.id}" style="padding:4px 10px;flex-shrink:0;" onclick="event.stopPropagation()">👁</button>
            </div>
            <div class="receipt-composition" data-id="${p.id}" style="display:${isOpen?'block':'none'};margin-top:8px;padding:10px;background:var(--gray-50);border-radius:8px;" onclick="event.stopPropagation()">
                <div style="font-size:.75rem;color:var(--gray-500);margin-bottom:4px;">Можно отметить сразу несколько назначений — суммы сложатся в одну квитанцию</div>
                ${renderCompositionItem(p, 'membership', 'Членские взносы', st.membership)}
                ${renderCompositionItem(p, 'target', 'Целевые взносы', st.target)}
                ${renderCompositionItem(p, 'arrears', 'Задолж. прошлых лет', st.arrears)}
                ${renderCompositionItem(p, 'work', 'Отработка', st.work)}
                ${renderElectricityItem(p, st.electricity)}
                ${renderCompositionExtra(p, st.extra)}
                <div style="margin-top:8px;">
                    <input type="text" class="receipt-manual-purpose-inp" data-id="${p.id}" value="${escapeHtml(st.manualPurpose||'')}"
                        placeholder="Назначение платежа — заполняется автоматически, можно переписать вручную"
                        style="width:100%;font-size:.8rem;padding:5px 8px;border:1px solid var(--gray-300);border-radius:6px;background:#fff;">
                    <div style="text-align:right;margin-top:2px;">
                        <span class="receipt-purpose-counter" data-id="${p.id}" style="font-size:.72rem;color:var(--gray-500);">${(saved.purpose||'').length} / ${PURPOSE_MAX_LEN} символов (лимит банка на назначение платежа)</span>
                    </div>
                </div>
                <div style="margin-top:6px;font-size:.82rem;color:var(--gray-700);">Итого к оплате: <strong class="receipt-total-text" data-id="${p.id}">${fmt(total)} ₽</strong></div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('receiptsSelectedBadge').textContent = `Выбрано: ${receiptSelectedIds.size}`;
    document.getElementById('receiptsSelectAll').checked = plots.length > 0 && plots.every(p => receiptSelectedIds.has(p.id));

    // Обработчики чекбоксов выбора участка
    document.querySelectorAll('.receipt-row-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) receiptSelectedIds.add(cb.dataset.id);
            else receiptSelectedIds.delete(cb.dataset.id);
            document.getElementById('receiptsSelectedBadge').textContent = `Выбрано: ${receiptSelectedIds.size}`;
        });
        cb.addEventListener('click', e => e.stopPropagation());
    });

    // Раскрыть/свернуть состав платежа
    document.querySelectorAll('.receipt-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (receiptOpenRows.has(id)) receiptOpenRows.delete(id); else receiptOpenRows.add(id);
            renderReceiptsList();
        });
    });

    // Отметка/снятие пункта назначения платежа
    document.querySelectorAll('.receipt-item-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = cb.dataset.id, key = cb.dataset.key;
            const st = receiptItemsState.get(id);
            if (!st) return;
            st[key].checked = cb.checked;
            const amtInp = document.querySelector(`.receipt-item-amount-inp[data-id="${CSS.escape(id)}"][data-key="${key}"]`);
            if (amtInp) amtInp.style.opacity = cb.checked ? '1' : '.5';
            if (key === 'electricity') {
                const details = document.querySelector(`.receipt-ee-details[data-id="${CSS.escape(id)}"]`);
                if (details) details.style.display = cb.checked ? 'flex' : 'none';
            }
            const plot = plotsById.get(id);
            if (plot) recalcRow(plot, st, true);
        });
        cb.addEventListener('click', e => e.stopPropagation());
    });

    // Ручное изменение суммы по пункту
    document.querySelectorAll('.receipt-item-amount-inp').forEach(inp => {
        inp.addEventListener('input', () => {
            const id = inp.dataset.id, key = inp.dataset.key;
            const st = receiptItemsState.get(id);
            if (!st) return;
            st[key].amount = parseFloat(inp.value) || 0;
            const plot = plotsById.get(id);
            if (plot) recalcRow(plot, st, true);
        });
        inp.addEventListener('click', e => e.stopPropagation());
    });

    // Показания электросчётчика: авторасчёт кВт·ч и суммы
    document.querySelectorAll('.receipt-ee-current-inp').forEach(inp => {
        inp.addEventListener('input', () => {
            const id = inp.dataset.id;
            const st = receiptItemsState.get(id);
            if (!st) return;
            st.electricity.currReading = inp.value;
            const plot = plotsById.get(id);
            if (!plot) return;
            recalcRow(plot, st, true);
            const amtInp = document.querySelector(`.receipt-item-amount-inp[data-id="${CSS.escape(id)}"][data-key="electricity"]`);
            if (amtInp) amtInp.value = st.electricity.amount.toFixed(2);
        });
        inp.addEventListener('click', e => e.stopPropagation());
    });

    // Описание для пункта "Другое / аванс"
    document.querySelectorAll('.receipt-extra-label-inp').forEach(inp => {
        inp.addEventListener('input', () => {
            const id = inp.dataset.id;
            const st = receiptItemsState.get(id);
            if (!st) return;
            st.extra.label = inp.value;
            const plot = plotsById.get(id);
            if (plot) recalcRow(plot, st, true);
        });
        inp.addEventListener('click', e => e.stopPropagation());
    });

    // Ручная правка итогового назначения платежа
    document.querySelectorAll('.receipt-manual-purpose-inp').forEach(inp => {
        inp.addEventListener('input', () => {
            const id = inp.dataset.id;
            const st = receiptItemsState.get(id);
            if (!st) return;
            st.manualPurpose = inp.value;
            const plot = plotsById.get(id);
            if (plot) recalcRow(plot, st, true);
        });
        inp.addEventListener('click', e => e.stopPropagation());
    });

    document.querySelectorAll('.preview-receipt-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const source = allPlotsAll.length ? allPlotsAll : allPlots;
            const plot = source.find(p => p.id === btn.dataset.id);
            if (plot) openReceiptModal(plot);
        });
    });

    // Клик по строке — выбор участка (кроме клика по составу платежа/кнопкам)
    document.querySelectorAll('.plot-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.type === 'checkbox' || e.target.classList.contains('btn')) return;
            const cb = row.querySelector('.receipt-row-cb');
            cb.checked = !cb.checked;
            if (cb.checked) receiptSelectedIds.add(cb.dataset.id);
            else receiptSelectedIds.delete(cb.dataset.id);
            document.getElementById('receiptsSelectedBadge').textContent = `Выбрано: ${receiptSelectedIds.size}`;
        });
    });
}

document.getElementById('receiptSearchInput').addEventListener('input', renderReceiptsList);

document.querySelectorAll('.receipt-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.receipt-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        receiptGroupFilter = btn.dataset.filter;
        renderReceiptsList();
    });
});

document.getElementById('receiptsSelectAll').addEventListener('change', e => {
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    source.forEach(p => {
        if (e.target.checked) receiptSelectedIds.add(p.id);
        else receiptSelectedIds.delete(p.id);
    });
    renderReceiptsList();
});

// ===================== QR И КВИТАНЦИИ =====================
// Поле "Назначение платежа" в платёжных QR (ST00012 / ГОСТ Р 56042-2014, реквизит Purpose
// альбома УФЭБС) официально ограничено 210 символами — это техническое ограничение банков,
// а не наша прихоть. Если что-то не помещается, обрезаем аккуратно (с многоточием), а не
// заменяем весь текст на общую фразу — так теряется меньше полезной информации.
const PURPOSE_MAX_LEN = 210;

function qrPurpose(plot) {
    const suffix = `, уч. ${plot.plotNumber}`;
    // Если задано пользовательское назначение — используем его
    if (plot.customPurpose && plot.customPurpose.trim()) {
        let s = plot.customPurpose.trim() + suffix;
        if (s.length > PURPOSE_MAX_LEN) s = s.slice(0, PURPOSE_MAX_LEN - 1) + '…';
        return s;
    }
    let parts = [...(plot.qrParts || [])];
    if (parts.length === 0) {
        if (plot.membershipSum > 0) parts.push(`Членские взносы: ${plot.membershipSum.toFixed(2)} руб.`);
        if (plot.targetSum > 0) parts.push(`Целевые взносы: ${plot.targetSum.toFixed(2)} руб.`);
        if (plot.arrearsSum > 0) parts.push(`Задолженность прошлых лет: ${plot.arrearsSum.toFixed(2)} руб.`);
        if (plot.workSum > 0) parts.push(`Отработка: ${plot.workSum.toFixed(2)} руб.`);
        if (plot.electricitySum > 0) parts.push(`Электроэнергия: ${plot.electricitySum.toFixed(2)} руб.`);
    }
    let s = parts.join(', ') + suffix;
    if (s.length > PURPOSE_MAX_LEN) s = s.slice(0, PURPOSE_MAX_LEN - 1) + '…';
    return s;
}

function rubleCase(n) {
    const last = n % 10, lastTwo = n % 100;
    if (lastTwo >= 11 && lastTwo <= 19) return 'рублей';
    if (last === 1) return 'рубль';
    if (last >= 2 && last <= 4) return 'рубля';
    return 'рублей';
}

function numberToWordsFull(num) {
    if (num === 0) return 'Ноль рублей 00 копеек';
    const rub = Math.floor(num);
    const kop = Math.round((num - rub) * 100);
    const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', 'десять', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    function convertLess(n, female) {
        if (n === 0) return '';
        let res = '';
        if (n >= 100) { res += hundreds[Math.floor(n / 100)] + ' '; n %= 100; }
        if (n >= 20) { res += tens[Math.floor(n / 10)] + ' '; n %= 10; }
        else if (n >= 10) { res += teens[n - 10] + ' '; n = 0; }
        if (n > 0) res += (female ? unitsFemale[n] : units[n]) + ' ';
        return res;
    }

    let result = '';
    let rubPart = rub;
    if (rubPart >= 1000) {
        const thousands = Math.floor(rubPart / 1000);
        rubPart %= 1000;
        result += convertLess(thousands, true) + ' ';
        const thLast = thousands % 10, thLastTwo = thousands % 100;
        if (thLastTwo >= 11 && thLastTwo <= 19) result += 'тысяч ';
        else if (thLast === 1) result += 'тысяча ';
        else if (thLast >= 2 && thLast <= 4) result += 'тысячи ';
        else result += 'тысяч ';
    }
    if (rubPart > 0 || result === '') result += convertLess(rubPart, false) + ' ';
    result += rubleCase(rub) + ' ';
    result += kop.toString().padStart(2, '0') + ' коп.';
    return result.charAt(0).toUpperCase() + result.slice(1);
}

async function buildReceiptHTML(plot) {
    const today = new Date().toLocaleDateString('ru-RU');
    const purpose = qrPurpose(plot);
    const amountWords = numberToWordsFull(plot.totalDebt);
    const sumKop = Math.round(plot.totalDebt * 100);
    const qrRaw = `ST00012|Name=${REQ.Name}|PersonalAcc=${REQ.PersonalAcc}|BankName=${REQ.BankName}|BIC=${REQ.BIC}|CorrespAcc=${REQ.CorrespAcc}|PayeeINN=${REQ.PayeeINN}|Sum=${sumKop}|Purpose=${purpose}`;
    const qrDataUrl = CFG.showQr ? await QRCode.toDataURL(qrRaw, { width: 320, margin: 1, errorCorrectionLevel: 'H' }) : '';

    let detailsHtml = '';
    if (plot.details && plot.details.length) {
        plot.details.forEach(d => {
            if (d.label && !d.label.includes('Итого')) detailsHtml += `<div style="margin-bottom: 2px; font-size: 8pt;">${d.label}</div>`;
        });
    } else {
        if (plot.membershipSum > 0) detailsHtml += `<div style="margin-bottom: 2px;">Членские взносы ${CFG.year}: ${plot.membershipSum.toFixed(2)} руб.</div>`;
        if (plot.targetSum > 0) detailsHtml += `<div style="margin-bottom: 2px;">Целевые взносы: ${plot.targetSum.toFixed(2)} руб.</div>`;
        if (plot.arrearsSum > 0) detailsHtml += `<div style="margin-bottom: 2px;">Задолженность прошлых лет: ${plot.arrearsSum.toFixed(2)} руб.</div>`;
        if (plot.workSum > 0) detailsHtml += `<div style="margin-bottom: 2px;">Отработка: ${plot.workSum.toFixed(2)} руб.</div>`;
        if (plot.electricitySum > 0) detailsHtml += `<div style="margin-bottom: 2px;">Электроэнергия: ${plot.electricitySum.toFixed(2)} руб.</div>`;
    }

    const partHtml = (title, withQr) => `
        <div style="border: 1px solid #000000; margin-bottom: 5px; display: flex; min-height: 195px; page-break-inside: avoid; background: white;">
            <div style="flex: 3; padding: 8px 10px;">
                <div style="font-weight: bold; font-size: 11pt; text-align: center; margin-bottom: 6px;">Форма № ПД-4</div>
                <div style="margin-bottom: 3px; border-bottom: 1px solid #000;">
                    <div style="font-size: 9pt; font-weight: 500;">${REQ.Name}</div>
                    <div style="font-size: 6pt; color: #555;">(наименование получателя платежа)</div>
                </div>
                <div style="display: flex; gap: 12px; margin-bottom: 3px;">
                    <div style="flex: 1; border-bottom: 1px solid #000;">
                        <div style="font-size: 8pt;">${REQ.PayeeINN}</div>
                        <div style="font-size: 6pt; color: #555;">(ИНН получателя платежа)</div>
                    </div>
                    <div style="flex: 1; border-bottom: 1px solid #000;">
                        <div style="font-size: 8pt;">${REQ.PersonalAcc}</div>
                        <div style="font-size: 6pt; color: #555;">(номер счёта получателя платежа)</div>
                    </div>
                </div>
                <div style="margin-bottom: 3px; border-bottom: 1px solid #000;">
                    <div style="font-size: 8pt;">${REQ.BankName}</div>
                    <div style="font-size: 6pt; color: #555;">(наименование банка получателя платежа)</div>
                </div>
                <div style="display: flex; gap: 12px; margin-bottom: 3px;">
                    <div style="flex: 1; border-bottom: 1px solid #000;">
                        <div style="font-size: 8pt;">${REQ.BIC}</div>
                        <div style="font-size: 6pt; color: #555;">(БИК)</div>
                    </div>
                    <div style="flex: 1; border-bottom: 1px solid #000;">
                        <div style="font-size: 8pt;">${REQ.CorrespAcc}</div>
                        <div style="font-size: 6pt; color: #555;">(номер кор./сч. банка получателя платежа)</div>
                    </div>
                </div>
                <div style="margin-bottom: 3px; border-bottom: 1px solid #000;">
                    <div style="font-size: 8pt;">${purpose}</div>
                    <div style="font-size: 6pt; color: #555;">(наименование платежа)</div>
                </div>
                <div style="margin-bottom: 3px; border-bottom: 1px solid #000;">
                    <div style="font-size: 8pt;">${plot.payerName}</div>
                    <div style="font-size: 6pt; color: #555;">(Ф.И.О. плательщика, адрес)</div>
                </div>
                <div style="margin-top: 4px; padding-top: 2px; border-top: 1px solid #000;">
                    ${detailsHtml}
                    <div style="font-size: 9pt; font-weight: bold; text-align: right; border-top: 1px solid #000; margin-top: 4px; padding-top: 2px;">Итого к доплате: ${plot.totalDebt.toFixed(2)} руб.</div>
                </div>
                <div style="font-size: 7pt; border: 1px solid #000; padding: 4px; margin-top: 5px; background: #f9f9f9; line-height: 1.3;">
                    <strong>Сумма прописью:</strong> ${amountWords}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 8pt;">
                    <div>Дата ${today}</div>
                    <div>
                        <div>Плательщик (подпись) ______ / ______________</div>
                        <div>Кассир ______ / ______________</div>
                    </div>
                </div>
            </div>
            <div style="flex: 1; border-left: 1px solid #000; background: #fafaf5; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 12px 5px; text-align: center;">
                <div style="font-weight: bold; font-size: 14pt; text-transform: uppercase;">${title}</div>
                ${withQr && qrDataUrl ? `<div style="margin: 8px 0;"><img src="${qrDataUrl}" style="width: 50mm; height: 50mm; border: 1px solid #aaa;"></div><div style="font-size: 7pt;">Сканируйте для оплаты</div>` : '<div style="margin: 8px 0;"></div>'}
                <div style="font-size: 10pt; margin-top: 8px;">Кассир</div>
            </div>
        </div>
    `;

    if (CFG.duplicate) {
        return `<div style="width: 210mm; margin: 0 auto; font-family: 'Times New Roman', Times, serif; font-size: 9pt; background: white; padding: 5mm;">
            ${partHtml('ИЗВЕЩЕНИЕ', true)}
            <div style="text-align: center; margin: 4px 0; letter-spacing: 2px; font-size: 8pt;">────────────────────────────────────────────────────</div>
            ${partHtml('КВИТАНЦИЯ', false)}
        </div>`;
    } else {
        return `<div style="width: 210mm; margin: 0 auto; font-family: 'Times New Roman', Times, serif; font-size: 9pt; background: white; padding: 5mm;">
            ${partHtml('КВИТАНЦИЯ', CFG.showQr)}
        </div>`;
    }
}

async function openReceiptModal(plot) {
    currentReceiptPlot = plot;
    const saved = receiptCustomAmounts.get(plot.id);
    const effectiveAmount = (saved && saved.amount > 0) ? saved.amount : plot.totalDebt;
    const effectivePurpose = saved ? saved.purpose : '';
    const needsOverride = effectiveAmount !== plot.totalDebt || effectivePurpose;
    const plotForReceipt = needsOverride
        ? Object.assign({}, plot, {totalDebt: effectiveAmount, customPurpose: effectivePurpose || null})
        : plot;
    document.getElementById('receiptPreviewBody').innerHTML = '<div style="text-align:center;padding:30px;color:#666;">⏳ Генерация квитанции...</div>';
    document.getElementById('receiptModal').classList.add('open');
    const html = await buildReceiptHTML(plotForReceipt);
    document.getElementById('receiptPreviewBody').innerHTML = html;
}

document.getElementById('closeReceiptModal').onclick = document.getElementById('closeReceiptModalBtn').onclick = () => document.getElementById('receiptModal').classList.remove('open');
document.getElementById('receiptModal').addEventListener('click', e => { if (e.target === document.getElementById('receiptModal')) document.getElementById('receiptModal').classList.remove('open'); });

document.getElementById('printReceiptModalBtn').addEventListener('click', async () => {
    if (!currentReceiptPlot) return;
    const saved = receiptCustomAmounts.get(currentReceiptPlot.id);
    const effectiveAmount = (saved && saved.amount > 0) ? saved.amount : currentReceiptPlot.totalDebt;
    const plotForReceipt = Object.assign({}, currentReceiptPlot, {
        totalDebt: effectiveAmount,
        customPurpose: (saved && saved.purpose) || null
    });
    const html = await buildReceiptHTML(plotForReceipt);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><style>@page{margin:10mm;}body{margin:0;}</style></head><body>${html}</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 700);
});

document.getElementById('pdfReceiptModalBtn').addEventListener('click', async () => {
    if (!currentReceiptPlot) return;
    const saved = receiptCustomAmounts.get(currentReceiptPlot.id);
    const effectiveAmount = (saved && saved.amount > 0) ? saved.amount : currentReceiptPlot.totalDebt;
    const plotForReceipt = Object.assign({}, currentReceiptPlot, {
        totalDebt: effectiveAmount,
        customPurpose: (saved && saved.purpose) || null
    });
    await generateAndSavePDF([plotForReceipt], `kvitanciya_${currentReceiptPlot.plotNumber}.pdf`);
});

// ===================== ПЕЧАТЬ КВИТАНЦИЙ =====================
function applyCustomAmounts(plots) {
    return plots.map(p => {
        const saved = receiptCustomAmounts.get(p.id);
        if (!saved) return p;
        const amountChanged = saved.amount > 0 && saved.amount !== p.totalDebt;
        if (amountChanged || saved.purpose)
            return Object.assign({}, p, {
                totalDebt: amountChanged ? saved.amount : p.totalDebt,
                customPurpose: saved.purpose || null
            });
        return p;
    });
}

document.getElementById('printSelectedReceiptsBtn').addEventListener('click', async () => {
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    const sel = applyCustomAmounts(source.filter(p => receiptSelectedIds.has(p.id)));
    if (!sel.length) { alert('Выберите участки'); return; }
    await printMultiple(sel);
});

document.getElementById('printAllReceiptsBtn').addEventListener('click', () => {
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    printMultiple(applyCustomAmounts(source));
});

async function printMultiple(plots) {
    const parts = [];
    const progWrap = document.getElementById('receiptProgress');
    const progBar = document.getElementById('receiptProgressBar');
    const progText = document.getElementById('receiptProgressText');
    progWrap.style.display = '';

    for (let i = 0; i < plots.length; i++) {
        progText.textContent = `Генерация ${i+1} / ${plots.length}...`;
        progBar.style.width = ((i+1)/plots.length*100) + '%';
        parts.push(await buildReceiptHTML(plots[i]));
    }
    progWrap.style.display = 'none';

    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="UTF-8"><style>@page{margin:10mm;}body{margin:0;}.pb{page-break-before:always;}</style></head><body>${parts.map((h,i) => i ? '<div class="pb">'+h+'</div>' : h).join('')}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 900);
}

document.getElementById('downloadPdfSelectedBtn').addEventListener('click', async () => {
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    const sel = applyCustomAmounts(source.filter(p => receiptSelectedIds.has(p.id)));
    if (!sel.length) { alert('Выберите участки'); return; }
    await generateAndSavePDF(sel, 'kvitancii_vybrannyh.pdf');
});

document.getElementById('downloadPdfAllBtn').addEventListener('click', () => {
    const source = allPlotsAll.length ? allPlotsAll : allPlots;
    generateAndSavePDF(applyCustomAmounts(source), 'kvitancii_vse.pdf');
});

async function generateAndSavePDF(plots, filename) {
    const prog = document.getElementById('receiptProgress');
    const bar = document.getElementById('receiptProgressBar');
    const txt = document.getElementById('receiptProgressText');
    prog.style.display = '';
    const { jsPDF } = window.jspdf;
    let pdf = null;

    for (let i = 0; i < plots.length; i++) {
        txt.textContent = `PDF ${i+1}/${plots.length}: ${plots[i].plotNumber}...`;
        bar.style.width = ((i+1)/plots.length*100) + '%';
        const html = await buildReceiptHTML(plots[i]);
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:220mm;height:auto;border:none;';
        document.body.appendChild(iframe);
        iframe.contentDocument.open();
        iframe.contentDocument.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;}
/* ===== ФИНАНСЫ ===== */
.finance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;}
.finance-card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);border-left:4px solid #ccc;}
.finance-card .label{font-size:.78rem;text-transform:uppercase;color:var(--gray-600);margin-bottom:6px;}
.finance-card .value{font-size:1.5rem;font-weight:700;}
.finance-card .value.green{color:var(--green-600);}
.finance-card .value.red{color:var(--red-600);}
.finance-card .value.blue{color:var(--blue-600);}
.chart-container{position:relative;height:300px;}
.finance-table{width:100%;border-collapse:collapse;font-size:.84rem;}
.finance-table th{background:var(--green-50);color:var(--green-700);font-weight:600;padding:10px 12px;text-align:left;border-bottom:2px solid var(--green-100);position:sticky;top:0;z-index:2;white-space:nowrap;}
.finance-table td{padding:9px 12px;border-bottom:1px solid var(--gray-100);vertical-align:middle;}
.finance-table tr:hover td{background:var(--gray-50);}
.op-income{color:var(--green-600);font-weight:700;}
.op-expense{color:var(--red-600);font-weight:700;}
.op-badge{display:inline-block;padding:2px 8px;border-radius:50px;font-size:.72rem;font-weight:600;}
.op-badge.income{background:var(--green-100);color:var(--green-700);}
.op-badge.expense{background:var(--red-50);color:var(--red-600);}
.op-badge.internal{background:var(--gray-200);color:var(--gray-700);}
</style></head><body>${html}</body></html>`);
        iframe.contentDocument.close();
        await new Promise(r => setTimeout(r, 500));
        const canvas = await html2canvas(iframe.contentDocument.body, { scale: 2, backgroundColor: '#fff', useCORS: true });
        document.body.removeChild(iframe);

        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        else pdf.addPage();
        const iw = pdf.internal.pageSize.getWidth();
        const ih = canvas.height * iw / canvas.width;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, iw, Math.min(ih, pdf.internal.pageSize.getHeight()));
    }
    prog.style.display = 'none';
    if (pdf) pdf.save(filename);
}

// ===================== ПАСПОРТ УЧАСТКА =====================
function renderPassportList() {
    if(!passportService) {
        document.getElementById('passportPlotsList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-500);">⏳ Данные ещё не загружены</div>';
        return;
    }

    const searchVal = document.getElementById('passportSearchInput').value;
    let passports = [];

    if(searchVal.trim()) {
        passports = passportService.searchAll(searchVal);
    } else {
        const keys = new Set();
        baseRepo.getAll().forEach(b => keys.add(String(b.plotNumber).toLowerCase()));
        debitRepo.getAll().forEach(d => keys.add(String(d.plotNumber).toLowerCase()));
        eeRepo.getAll().forEach(e => keys.add(String(e.plotNumber).toLowerCase()));
        passports = Array.from(keys).map(k => passportService.getFullPassport(k)).filter(p => p);
    }

    const container = document.getElementById('passportPlotsList');
    if(!passports.length){
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-500);">Ничего не найдено</div>';
        return;
    }

    // Сортируем по номеру участка по возрастанию (в base.ods строки идут по алфавиту ФИО, а не по номеру)
    passports.sort((a, b) => {
        const pa = (a.base && a.base.plotNumber) || a.plotNumber;
        const pb = (b.base && b.base.plotNumber) || b.plotNumber;
        const na = parseFloat(pa) || 0, nb = parseFloat(pb) || 0;
        return na - nb || String(pa).localeCompare(String(pb));
    });

    container.innerHTML = passports.map(p => {
        const base = p.base;
        const ownerName = String((base && base.owner) || (p.debit && p.debit.owner) || (p.ee && p.ee.owner) || '—');
        const debtAmt = p.debit ? p.debit.totalDebt : 0;
        const debtClass = debtAmt === 0 ? 'none' : (debtAmt < 1000 ? 'low' : 'high');
        const memberBadge = base && base.membershipRaw
            ? `<span class="badge ${base.isMember ? 'badge-green' : 'badge-gray'}" style="margin-right:6px;">${base.isMember ? 'Член СНТ' : 'Не член'}</span>`
            : '';
        return `<div class="plot-row" data-plot="${p.plotNumber}">
            <span class="plot-num-badge">Уч. ${p.plotNumber}</span>
            <span style="flex:1;">${escapeHtml(ownerName)}</span>
            ${memberBadge}
            <span class="debt-badge ${debtClass}">${debtAmt > 0 ? debtAmt.toFixed(2) + ' ₽' : 'нет долга'}</span>
        </div>`;
    }).join('');

    document.querySelectorAll('#passportPlotsList .plot-row').forEach(el => {
        el.addEventListener('click', () => {
            const plot = el.dataset.plot;
            currentPassport = passportService.getFullPassport(plot);
            if(currentPassport) renderPassportDetail(currentPassport);
        });
    });
}

function renderPassportDetail(pass) {
    document.getElementById('passportDetailView').style.display = 'block';
    document.getElementById('passportEmpty').style.display = 'none';

    const base = pass.base || {};
    const debit = pass.debit || {totalDebt:0, membership:0, target:0, arrears:0, work:0, electricity:0, overpayEnd:0, details:[]};
    const ee = pass.ee || {currReading:0, prevReading:0, consumption:0, tariff:3.82, readingDate:'', owner:''};
    const debtTotal = debit.totalDebt || 0;
    const electricityDebt = debit.electricity || 0;
    const overpay = debit.overpayEnd || 0;
    const area = base.area || '—';

    const memberBadgeHtml = base.membershipRaw
        ? `<span class="badge ${base.isMember ? 'badge-green' : 'badge-gray'}">${base.isMember ? '✅ Член СНТ' : '⛔ Не является членом'}</span>`
        : `<span class="badge badge-gray">Нет данных о членстве</span>`;

    document.getElementById('kpiRow').innerHTML = `
        <div class="kpi-card ${debtTotal > 0 ? 'debt' : ''}"><div class="kpi-label">💸 Общая задолженность</div><div class="kpi-value">${debtTotal.toFixed(2)} ₽</div></div>
        <div class="kpi-card ${electricityDebt > 0 ? 'debt' : ''}"><div class="kpi-label">⚡ Задолженность э/э</div><div class="kpi-value">${electricityDebt.toFixed(2)} ₽</div></div>
        <div class="kpi-card"><div class="kpi-label">🔄 Переплата</div><div class="kpi-value">${overpay > 0 ? overpay.toFixed(2) + ' ₽' : '—'}</div></div>
        <div class="kpi-card"><div class="kpi-label">📐 Площадь</div><div class="kpi-value">${area}${base.area ? ' сот.' : ''}</div></div>
    `;

    document.getElementById('tabGeneral').innerHTML = `
        <div class="info-row"><div class="info-label">Номер участка:</div><div class="info-value">${escapeHtml(String(base.plotNumber || pass.plotNumber))}</div></div>
        <div class="info-row"><div class="info-label">Владелец:</div><div class="info-value">${escapeHtml(String(base.owner || '—'))}</div></div>
        <div class="info-row"><div class="info-label">Членство в СНТ:</div><div class="info-value">${memberBadgeHtml}${base.membershipRaw ? ' <span style="color:var(--gray-500);font-size:.85rem;">('+escapeHtml(base.membershipRaw)+')</span>' : ''}</div></div>
        <div class="info-row"><div class="info-label">Адрес участка:</div><div class="info-value">${escapeHtml(String(base.plotAddress || '—'))}</div></div>
        <div class="info-row"><div class="info-label">Площадь:</div><div class="info-value">${escapeHtml(String(base.area || '—'))}${base.area ? ' сот.' : ''}</div></div>
        <div class="info-row"><div class="info-label">Кадастровый номер:</div><div class="info-value">${escapeHtml(String(base.cadastral || '—'))}</div></div>
        <div class="info-row"><div class="info-label">Вид собственности:</div><div class="info-value">${escapeHtml(String(base.ownershipType || '—'))}${base.share ? ' (доля: '+escapeHtml(String(base.share))+')' : ''}</div></div>
        <div class="info-row"><div class="info-label">Дата приобретения:</div><div class="info-value">${escapeHtml(String(base.acquisitionDate || '—'))}</div></div>
    `;

    let ownersHtml = `<div class="info-row"><div class="info-label">Основной владелец:</div><div class="info-value">${escapeHtml(String(base.owner || '—'))}</div></div>`;
    ownersHtml += `<div class="info-row"><div class="info-label">Членство в СНТ:</div><div class="info-value">${memberBadgeHtml}</div></div>`;
    if(base.phone) ownersHtml += `<div class="info-row"><div class="info-label">Телефон:</div><div class="info-value">${escapeHtml(String(base.phone))}</div></div>`;
    if(base.email) ownersHtml += `<div class="info-row"><div class="info-label">E-mail:</div><div class="info-value">${escapeHtml(String(base.email))}</div></div>`;
    if(base.legalAddress) ownersHtml += `<div class="info-row"><div class="info-label">Юридический адрес:</div><div class="info-value">${escapeHtml(String(base.legalAddress))}</div></div>`;
    if(base.postalAddress) ownersHtml += `<div class="info-row"><div class="info-label">Почтовый адрес:</div><div class="info-value">${escapeHtml(String(base.postalAddress))}</div></div>`;
    document.getElementById('tabOwners').innerHTML = ownersHtml || '<div>Нет данных</div>';

    let financeHtml = `
        <div class="info-row"><div class="info-label">Итого долг:</div><div class="info-value"><strong>${debit.totalDebt.toFixed(2)} ₽</strong></div></div>
        <div class="info-row"><div class="info-label">Переплата:</div><div class="info-value">${(debit.overpayEnd || 0).toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Членские взносы:</div><div class="info-value">${(debit.membership || 0).toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Целевые взносы:</div><div class="info-value">${(debit.target || 0).toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Задолж. прошлых лет:</div><div class="info-value">${(debit.arrears || 0).toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Отработка:</div><div class="info-value">${(debit.work || 0).toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Электроэнергия:</div><div class="info-value">${(debit.electricity || 0).toFixed(2)} ₽</div></div>
    `;
    document.getElementById('tabFinance').innerHTML = financeHtml;

    const eeAmount = ((ee.currReading || 0) - (ee.prevReading || 0)) * (ee.tariff || 3.82);
    document.getElementById('tabElectricity').innerHTML = `
        <div class="info-row"><div class="info-label">Владелец по ee:</div><div class="info-value">${escapeHtml(String(ee.owner || '—'))}</div></div>
        <div class="info-row"><div class="info-label">Текущие показания:</div><div class="info-value">${(ee.currReading || 0).toFixed(2)} кВт·ч</div></div>
        <div class="info-row"><div class="info-label">Предыдущие показания:</div><div class="info-value">${(ee.prevReading || 0).toFixed(2)} кВт·ч</div></div>
        <div class="info-row"><div class="info-label">Расход:</div><div class="info-value">${(ee.consumption || 0).toFixed(2)} кВт·ч</div></div>
        <div class="info-row"><div class="info-label">Начислено:</div><div class="info-value">${eeAmount.toFixed(2)} ₽</div></div>
        <div class="info-row"><div class="info-label">Тариф:</div><div class="info-value">${(ee.tariff || 3.82).toFixed(2)} ₽/кВт·ч</div></div>
        <div class="info-row"><div class="info-label">Дата показаний:</div><div class="info-value">${escapeHtml(String(ee.readingDate || '—'))}</div></div>
    `;

    document.getElementById('tabHistory').innerHTML = `<div class="info-row"><div class="info-label">История:</div><div class="info-value">—</div></div>`;
    document.getElementById('tabNotes').innerHTML = `<div style="white-space:pre-wrap;">—</div>`;
}

// Вкладки паспорта
document.querySelectorAll('.tab-inline').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-inline').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        const tabMap = {
            'general':'General','owners':'Owners','finance':'Finance',
            'electricity':'Electricity','history':'History','notes':'Notes'
        };
        ['General','Owners','Finance','Electricity','History','Notes'].forEach(t => {
            const el = document.getElementById(`tab${t}`);
            if(el) el.style.display = 'none';
        });
        const targetEl = document.getElementById(`tab${tabMap[target] || 'General'}`);
        if(targetEl) targetEl.style.display = 'block';
    });
});

document.getElementById('passportSearchInput').addEventListener('input', () => renderPassportList());
document.getElementById('clearPassportSearch').addEventListener('click', () => {
    document.getElementById('passportSearchInput').value = '';
    renderPassportList();
});

function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, m => {
        const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
        return map[m] || m;
    });
}

// ===================== ФИНАНСОВАЯ СТРАНИЦА =====================
function getBalanceFromFile(accountType) {
    if (!financialAnalyzer) return 0;
    const rows = financialAnalyzer.rawData[accountType] || [];
    if (!rows.length) return 0;

    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (!row || row.length < 10) continue;
        const firstCell = String(row[0] || '').trim().replace(/\t/g, '');
        if (!firstCell.includes('Обороты за период') && !firstCell.includes('сальдо на конец') && !firstCell.includes('Сальдо на конец')) continue;

        // Сальдо в col[11], знак в col[10]
        let val = parseFloat(String(row[11] || '0').replace(/\s/g, '').replace(',', '.'));
        if (isNaN(val)) val = 0;

        // Знак: Д = дебетовое сальдо, К = кредитовое
        const sign = String(row[10] || '').replace(/\t/g, '').trim();
        // Для активных счетов (50,51,71) Д = положительный остаток
        if (sign === 'К') val = -val;

        console.log(`✅ Счет ${accountType}: сальдо=${val}, знак=${sign}`);
        return val;
    }

    console.warn(`⚠️ Сальдо для счета ${accountType} не найдено`);
    return financialAnalyzer.getAccountBalance(accountType);
}

function renderFinancePage() {
    if (!financialAnalyzer) {
        document.getElementById('financeTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-500);">Данные не загружены</td></tr>';
        return;
    }

    // Получаем фильтры
    const dateFrom = document.getElementById('financeDateFrom').value;
    const dateTo = document.getElementById('financeDateTo').value;
    const typeFilter = document.getElementById('financeTypeFilter').value;
    const categoryFilter = document.getElementById('financeCategoryFilter').value;

    // Преобразуем даты в объекты для сравнения
    let fromDate = null;
    let toDate = null;

    if (dateFrom) {
        const parts = dateFrom.split('-');
        fromDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (dateTo) {
        const parts = dateTo.split('-');
        toDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        toDate.setHours(23, 59, 59, 999);
    }

    // === БЕРЕМ ВСЕ ОПЕРАЦИИ ИЗ ОДНОГО ИСТОЧНИКА ===
    // Исключаем внутренние перемещения и выдачу под отчет (advance)
    let allOps = financialAnalyzer.operations.filter(op =>
        op.type !== 'internal' && op.type !== 'advance'
    );

    // Фильтр по типу
    if (typeFilter === 'income') {
        allOps = allOps.filter(op => op.type === 'income');
    } else if (typeFilter === 'expense') {
        allOps = allOps.filter(op => op.type === 'expense');
    }

    // Фильтр по категории
    if (categoryFilter !== 'all') {
        allOps = allOps.filter(op => op.category === categoryFilter);
    }

    // Фильтр по диапазону дат
    if (fromDate || toDate) {
        allOps = allOps.filter(op => {
            if (!op.dateObj) return false;
            if (fromDate && op.dateObj < fromDate) return false;
            if (toDate && op.dateObj > toDate) return false;
            return true;
        });
    }

    // === УНИКАЛЬНАЯ ДЕДУПЛИКАЦИЯ ===
    const seen = new Set();
    const uniqueOps = [];
    for (const op of allOps) {
        const key = `${op.date}_${op.amount.toFixed(2)}_${op.purpose}_${op.counterparty}_${op.debitAccount}_${op.creditAccount}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueOps.push(op);
        }
    }
    allOps = uniqueOps;

    // ===== ВЫЧИСЛЯЕМ ТОТАЛЫ =====
    let filteredIncome = 0;
    let filteredExpense = 0;
    const filteredMonthlyData = {};
    const filteredCategorySummary = {};

    for (const op of allOps) {
        if (op.type === 'income') {
            filteredIncome += op.amount;
        } else if (op.type === 'expense') {
            filteredExpense += op.amount;
            if (!filteredCategorySummary[op.category]) {
                filteredCategorySummary[op.category] = 0;
            }
            filteredCategorySummary[op.category] += op.amount;
        }

        const monthKey = op.monthKey;
        if (monthKey) {
            if (!filteredMonthlyData[monthKey]) {
                filteredMonthlyData[monthKey] = { income: 0, expense: 0, balance: 0 };
            }
            if (op.type === 'income') {
                filteredMonthlyData[monthKey].income += op.amount;
            } else if (op.type === 'expense') {
                filteredMonthlyData[monthKey].expense += op.amount;
            }
            filteredMonthlyData[monthKey].balance =
                filteredMonthlyData[monthKey].income - filteredMonthlyData[monthKey].expense;
        }
    }

    const totals = {
        income: filteredIncome,
        expense: filteredExpense,
        balance: filteredIncome - filteredExpense,
        totalOps: allOps.length
    };

    const monthlyData = filteredMonthlyData;
    const categorySummary = filteredCategorySummary;

    // Обновляем KPI
    document.getElementById('totalIncome').textContent = fmt(totals.income) + ' ₽';
    document.getElementById('totalExpense').textContent = fmt(totals.expense) + ' ₽';

    // Отображаем выбранную категорию
    const catDisplay = document.getElementById('categoryDisplay');
    if (catDisplay) {
        catDisplay.textContent = categoryFilter !== 'all' ? '| Категория: ' + categoryFilter : '';
    }
    document.getElementById('totalBalance').textContent = fmt(totals.balance) + ' ₽';
    document.getElementById('totalBalance').style.color = totals.balance >= 0 ? '#2e7d32' : '#c62828';
    document.getElementById('totalOps').textContent = totals.totalOps;

    // Получаем остатки из файлов
    const balance51 = getBalanceFromFile('51');
    const balance71 = getBalanceFromFile('71');  // ← было '71.01', стало '71'
    const balance50 = getBalanceFromFile('50');

    const totalBalance = balance51 + balance71 + balance50;

    // Для отладки - выводим в консоль
    console.log('💰 Остатки по счетам:');
    console.log(`  Счет 50: ${balance50.toFixed(2)} ₽`);
    console.log(`  Счет 51: ${balance51.toFixed(2)} ₽`);
    console.log(`  Счет 71: ${balance71.toFixed(2)} ₽`);
    console.log(`  Итого: ${totalBalance.toFixed(2)} ₽`);

    document.getElementById('balanceDisplay').textContent = fmt(totalBalance) + ' ₽';
    document.getElementById('balanceDisplay').style.color = totalBalance >= 0 ? '#2e7d32' : '#c62828';

    // Обновляем отображение периода
    if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        document.getElementById('periodDisplay').textContent =
            from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
            ' — ' +
            to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } else {
        document.getElementById('periodDisplay').textContent = 'Все периоды';
    }

    // === ГРАФИК ДИНАМИКИ ===
    const months = Object.keys(monthlyData).sort();
    const labels = months.map(m => financialAnalyzer.getMonthLabel(m));
    const incomeData = months.map(m => monthlyData[m].income);
    const expenseData = months.map(m => monthlyData[m].expense);

    if (financeChartInstance) financeChartInstance.destroy();
    const ctx = document.getElementById('financeChart').getContext('2d');
    financeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['Нет данных'],
            datasets: [
                {
                    label: 'Доходы',
                    data: labels.length ? incomeData : [0],
                    backgroundColor: 'rgba(46, 125, 50, 0.7)',
                    borderColor: '#2e7d32',
                    borderWidth: 1
                },
                {
                    label: 'Расходы',
                    data: labels.length ? expenseData : [0],
                    backgroundColor: 'rgba(198, 40, 40, 0.65)',
                    borderColor: '#c62828',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.dataset.label + ': ' + fmt(ctx.parsed.y) + ' ₽';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return fmt(value) + ' ₽';
                        }
                    }
                }
            }
        }
    });

    // === КРУГОВАЯ ДИАГРАММА РАСХОДОВ ===
    const catEntries = Object.entries(categorySummary)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, amount]) => amount > 0);

    const catLabels = catEntries.map(([cat, _]) => cat);
    const catValues = catEntries.map(([_, amount]) => amount);
    const catColors = catEntries.map(([cat, _]) => financialAnalyzer.getCategoryColor(cat));

    if (financePieInstance) financePieInstance.destroy();
    const pieCtx = document.getElementById('financePieChart').getContext('2d');
    financePieInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['Нет данных'],
            datasets: [{
                data: catLabels.length ? catValues : [1],
                backgroundColor: catLabels.length ? catColors : ['#e0e0e0'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 11 },
                        boxWidth: 14
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.label + ': ' + fmt(ctx.parsed) + ' ₽';
                        }
                    }
                }
            }
        }
    });

    // === ТОП КАТЕГОРИЙ ===
    const topCategoriesHtml = catEntries.slice(0, 5).map(([cat, amount], index) => {
        const maxAmount = catEntries.length > 0 ? catEntries[0][1] : 1;
        const percent = (amount / maxAmount * 100).toFixed(0);
        const color = financialAnalyzer.getCategoryColor(cat);
        return `
            <div style="margin-bottom: 10px;">
                <div style="display:flex;justify-content:space-between;font-size:.82rem;">
                    <span><span style="display:inline-block;padding:1px 8px;border-radius:12px;font-size:.7rem;font-weight:600;color:#fff;background:${color};">${index+1}</span> ${cat}</span>
                    <span style="font-weight:600;">${fmt(amount)} ₽</span>
                </div>
                <div style="width:100%;height:8px;background:var(--gray-200);border-radius:50px;overflow:hidden;">
                    <div style="width:${percent}%;height:100%;background:${color};border-radius:50px;transition:width .5s;"></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('topCategoriesList').innerHTML = topCategoriesHtml || '<div style="color:var(--gray-500);text-align:center;padding:20px;">Нет данных о расходах за выбранный период</div>';

    // === ТАБЛИЦА ОПЕРАЦИЙ ===
    allOps.sort((a, b) => {
        if (!a.dateObj) return 1;
        if (!b.dateObj) return -1;
        return b.dateObj - a.dateObj;
    });

    const tbody = document.getElementById('financeTableBody');
    if (!allOps.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-500);">Нет операций по заданным фильтрам</td></tr>';
    } else {
        tbody.innerHTML = allOps.map(op => {
            const isIncome = op.type === 'income';
            const sign = isIncome ? '+' : '−';
            const colorClass = isIncome ? 'income' : 'expense';
            const categoryColor = financialAnalyzer.getCategoryColor(op.category);
            const monthLabel = financialAnalyzer.getMonthLabel(op.monthKey);

            return `<tr>
                <td style="white-space:nowrap;">${op.date}<br><span style="font-size:.7rem;color:var(--gray-500);">${monthLabel}</span></td>
                <td>${escapeHtml(op.counterparty)}</td>
                <td style="font-size:.82rem;">${escapeHtml(op.purpose)}</td>
                <td><span style="display:inline-block;padding:1px 8px;border-radius:12px;font-size:.7rem;font-weight:600;color:#fff;background:${categoryColor};">${op.category}</span></td>
                <td class="amount ${colorClass}">${sign}${fmt(op.amount)} ₽</td>
                <td style="text-align:center;font-size:.7rem;">
                    <span class="badge ${isIncome ? 'badge-green' : 'badge-red'}">${isIncome ? 'Доход' : 'Расход'}</span>
                </td>
            </tr>`;
        }).join('');
    }

    const totalAmount = allOps.reduce((sum, op) => sum + op.amount, 0);
    document.getElementById('financeTableInfo').textContent =
        `Показано: ${allOps.length} операций на сумму ${fmt(totalAmount)} ₽`;
}

// ===================== ФИЛЬТРЫ ФИНАНСОВ =====================
document.getElementById('financeDateFrom').addEventListener('change', renderFinancePage);
document.getElementById('financeDateTo').addEventListener('change', renderFinancePage);
document.getElementById('financeTypeFilter').addEventListener('change', renderFinancePage);
document.getElementById('financeCategoryFilter').addEventListener('change', renderFinancePage);

document.getElementById('resetFinanceFilters').addEventListener('click', () => {
    document.getElementById('financeDateFrom').value = '';
    document.getElementById('financeDateTo').value = '';
    document.getElementById('financeTypeFilter').value = 'all';
    document.getElementById('financeCategoryFilter').value = 'all';
    renderFinancePage();
});

// ===================== ЭКСПОРТ ФИНАНСОВ =====================
document.getElementById('exportFinanceCsv').addEventListener('click', () => {
    const tbody = document.getElementById('financeTableBody');
    const rows = tbody.querySelectorAll('tr');
    if (!rows.length || rows[0].textContent.includes('Нет операций')) {
        alert('Нет данных для экспорта');
        return;
    }

    let csv = 'Дата,Контрагент,Назначение,Категория,Сумма,Тип\n';
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            const date = cells[0].textContent.trim().split('\n')[0];
            const counterparty = cells[1].textContent.trim();
            const purpose = cells[2].textContent.trim();
            const category = cells[3].textContent.trim();
            const amount = cells[4].textContent.trim();
            const type = cells[5].textContent.trim();
            csv += `"${date}","${counterparty}","${purpose}","${category}","${amount}","${type}"\n`;
        }
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'finansy_snt.csv';
    a.click();
});
// ===================== НАСТРОЙКИ =====================
function initSettings() {
    document.getElementById('setName').value = REQ.Name;
    document.getElementById('setINN').value = REQ.PayeeINN;
    document.getElementById('setAcc').value = REQ.PersonalAcc;
    document.getElementById('setBankName').value = REQ.BankName;
    document.getElementById('setBIC').value = REQ.BIC;
    document.getElementById('setCorr').value = REQ.CorrespAcc;
    document.getElementById('setYear').value = CFG.year;
    document.getElementById('setQrToggle').checked = CFG.showQr;
    document.getElementById('setDuplicateToggle').checked = CFG.duplicate;
    document.getElementById('setMinDebt').value = CFG.minDebt;
}

document.getElementById('saveSettingsBtn').onclick = () => {
    REQ.Name = document.getElementById('setName').value.trim();
    REQ.PayeeINN = document.getElementById('setINN').value.trim();
    REQ.PersonalAcc = document.getElementById('setAcc').value.trim();
    REQ.BankName = document.getElementById('setBankName').value.trim();
    REQ.BIC = document.getElementById('setBIC').value.trim();
    REQ.CorrespAcc = document.getElementById('setCorr').value.trim();
    CFG.year = document.getElementById('setYear').value.trim();
    CFG.showQr = document.getElementById('setQrToggle').checked;
    CFG.duplicate = document.getElementById('setDuplicateToggle').checked;

    const newMinDebt = parseFloat(document.getElementById('setMinDebt').value);
    if (!isNaN(newMinDebt) && newMinDebt >= 0) {
        CFG.minDebt = newMinDebt;
    } else {
        CFG.minDebt = 0.01;
        document.getElementById('setMinDebt').value = CFG.minDebt;
    }

    localStorage.setItem('snt_Name', REQ.Name);
    localStorage.setItem('snt_INN', REQ.PayeeINN);
    localStorage.setItem('snt_Acc', REQ.PersonalAcc);
    localStorage.setItem('snt_BankName', REQ.BankName);
    localStorage.setItem('snt_BIC', REQ.BIC);
    localStorage.setItem('snt_Corr', REQ.CorrespAcc);
    localStorage.setItem('snt_Year', CFG.year);
    localStorage.setItem('snt_QR', CFG.showQr ? '1' : '0');
    localStorage.setItem('snt_Dup', CFG.duplicate ? '1' : '0');
    localStorage.setItem('snt_MinDebt', CFG.minDebt);

    // Применяем фильтр минимального долга
    if (allPlots.length > 0) {
        const orig = originalPlotsBackup.length ? originalPlotsBackup : [...allPlots];
        if (!originalPlotsBackup.length) originalPlotsBackup = [...allPlots];
        allPlots = orig.filter(p => p.totalDebt >= CFG.minDebt);
        selectedIds.clear();
        receiptSelectedIds.clear();
        renderDashboard();
        renderDebtorsTable();
        renderReceiptsList();
        renderPassportList();
        setStatus(`✅ Применён фильтр: показаны участки с долгом от ${CFG.minDebt} руб. (${allPlots.length} из ${orig.length})`, 'success');
    }

    const s = document.getElementById('settingsSaved');
    s.style.display = 'inline';
    setTimeout(() => s.style.display = 'none', 2500);
};

document.getElementById('clearDataBtn').onclick = () => {
    if (!confirm('Очистить все загруженные данные?')) return;

    allPlots = [];
    filteredPlots = [];
    selectedIds.clear();
    receiptSelectedIds.clear();
    originalPlotsBackup = [];
    baseRepo = new BaseRepository();
    debitRepo = new DebitRepository();
    eeRepo = new ElectricityRepository();
    financialAnalyzer = null;
    passportService = null;

    document.getElementById('dashContent').style.display = 'none';
    document.getElementById('uploadCard').style.display = '';
    document.getElementById('debtorsNoData').style.display = '';
    document.getElementById('debtorsDataView').style.display = 'none';
    document.getElementById('receiptsNoData').style.display = '';
    document.getElementById('receiptsDataView').style.display = 'none';
    document.getElementById('passportPlotsList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-500);">📂 Загрузите данные</div>';
    document.getElementById('passportDetailView').style.display = 'none';
    document.getElementById('passportEmpty').style.display = 'block';
    document.getElementById('navFileInfo').textContent = 'Файл не загружен';

    // Очищаем финансовые графики
    if (financeChartInstance) { financeChartInstance.destroy(); financeChartInstance = null; }
    if (financePieInstance) { financePieInstance.destroy(); financePieInstance = null; }

    setStatus('🗑 Данные очищены. Загрузите файл снова.', 'info');
    addLog('🗑 Данные очищены пользователем', 'info');
};

// ===================== ФОРМАТИРОВАНИЕ =====================
function fmt(n) {
    const num = typeof n === 'number' ? n : parseFloat(n);
    if (isNaN(num) || num === Infinity) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function fmtShort(n) {
    const num = typeof n === 'number' ? n : parseFloat(n);
    if (isNaN(num) || num === Infinity) return '0';
    if (num >= 1000000) return (num/1000000).toFixed(1) + ' млн';
    if (num >= 1000) return (num/1000).toFixed(1) + ' тыс.';
    return num.toFixed(0);
}

// ===================== ОБНОВЛЕНИЕ =====================
document.getElementById('btnReloadData').addEventListener('click', () => {
    addLog('🔄 Принудительное обновление данных...', 'loading');
    loadAllData();
});

// ===================== ИНИЦИАЛИЗАЦИЯ =====================
initSettings();

function startApp() {
    applyRolePermissions();
    addLog(`🚀 Инициализация приложения... (пользователь: ${currentUser ? currentUser.username : '?'})`, 'info');
    loadAllData();
}

initAuthGate();

document.getElementById('btnLogout').addEventListener('click', () => {
    if (confirm('Выйти из системы? Потребуется снова ввести логин и пароль.')) {
        sessionStorage.removeItem('snt_current_user');
        location.reload();
    }
});

// ===================== СТРАНИЦА «ПОЛЬЗОВАТЕЛИ» (только admin) =====================
document.getElementById('ghRepoLabel').textContent = `${GH_OWNER}/${GH_REPO}`;

const ghTokenInput = document.getElementById('ghTokenInput');
ghTokenInput.value = localStorage.getItem('snt_gh_token') || '';
document.getElementById('saveGhTokenBtn').addEventListener('click', () => {
    const t = ghTokenInput.value.trim();
    if (t) { localStorage.setItem('snt_gh_token', t); alert('Токен сохранён в этом браузере.'); }
    else { localStorage.removeItem('snt_gh_token'); alert('Токен удалён.'); }
});

function renderUsersSourceNotice() {
    const el = document.getElementById('usersSourceNotice');
    if (!el) return;
    if (usersSource === 'remote') {
        el.style.background = 'var(--green-50, #f0fdf4)';
        el.style.color = 'var(--green-700)';
        el.textContent = `✅ Список загружен из users.json (${usersList.length} польз.)`;
    } else {
        el.style.background = '#fff7ed';
        el.style.color = '#c2410c';
        el.textContent = '⚠️ users.json не найден или недоступен — используется встроенная резервная учётная запись admin. Добавьте пользователей и сохраните на GitHub.';
    }
}

function renderUsersTable() {
    renderUsersSourceNotice();
    const wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    if (!usersList.length) { wrap.innerHTML = '<div style="padding:16px;color:var(--gray-500);">Пользователей нет</div>'; return; }
    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.85rem;">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--gray-200);">
            <th style="padding:6px 8px;">Логин</th><th style="padding:6px 8px;">Роль</th><th style="padding:6px 8px;">Вкладки</th><th style="padding:6px 8px;"></th>
        </tr></thead>
        <tbody>
        ${usersList.map((u, i) => `<tr style="border-bottom:1px solid var(--gray-100);">
            <td style="padding:6px 8px;font-weight:600;">${escapeHtml(u.username)}</td>
            <td style="padding:6px 8px;">${u.role === 'admin' ? '<span class="badge badge-green">Администратор</span>' : '<span class="badge badge-gray">Пользователь</span>'}</td>
            <td style="padding:6px 8px;">${u.role === 'admin' ? 'Все' : (u.allowedTabs||[]).map(t => (ALL_TABS.find(x=>x.id===t)||{label:t}).label).join(', ') || '—'}</td>
            <td style="padding:6px 8px;text-align:right;white-space:nowrap;">
                <button class="btn btn-outline btn-sm edit-user-btn" data-idx="${i}" style="padding:3px 8px;">✏️</button>
                <button class="btn btn-outline btn-sm del-user-btn" data-idx="${i}" style="padding:3px 8px;">🗑</button>
            </td>
        </tr>`).join('')}
        </tbody></table>`;

    wrap.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => openUserModal(parseInt(btn.dataset.idx))));
    wrap.querySelectorAll('.del-user-btn').forEach(btn => btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const u = usersList[idx];
        if (u.username === currentUser.username) { alert('Нельзя удалить самого себя, пока вы в системе.'); return; }
        if (!confirm(`Удалить пользователя «${u.username}»?`)) return;
        usersList.splice(idx, 1);
        renderUsersTable();
    }));
}

function renderUserModalTabs(selected) {
    const list = document.getElementById('userModalTabsList');
    const sel = new Set(selected || []);
    list.innerHTML = ALL_TABS.map(t => `<label style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;">
        <input type="checkbox" class="user-tab-cb" value="${t.id}" ${sel.has(t.id)?'checked':''} style="width:16px;height:16px;accent-color:var(--green-600);">
        ${t.label}
    </label>`).join('');
}

function openUserModal(idx) {
    const isEdit = idx !== undefined && idx !== null;
    const u = isEdit ? usersList[idx] : null;
    document.getElementById('userModalTitle').textContent = isEdit ? `Редактирование: ${u.username}` : 'Новый пользователь';
    document.getElementById('userModalOriginalUsername').value = isEdit ? u.username : '';
    document.getElementById('userModalUsername').value = isEdit ? u.username : '';
    document.getElementById('userModalPassword').value = '';
    document.getElementById('userModalPassHint').textContent = isEdit ? '(оставьте пустым, чтобы не менять)' : '';
    document.getElementById('userModalRole').value = isEdit ? u.role : 'user';
    renderUserModalTabs(isEdit ? u.allowedTabs : []);
    toggleUserModalTabsVisibility();
    document.getElementById('userModal').classList.add('open');
}

function toggleUserModalTabsVisibility() {
    const isAdmin = document.getElementById('userModalRole').value === 'admin';
    document.getElementById('userModalTabsWrap').style.display = isAdmin ? 'none' : '';
}
document.getElementById('userModalRole').addEventListener('change', toggleUserModalTabsVisibility);

document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
document.getElementById('closeUserModalBtn').addEventListener('click', () => document.getElementById('userModal').classList.remove('open'));
document.getElementById('cancelUserModalBtn').addEventListener('click', () => document.getElementById('userModal').classList.remove('open'));

document.getElementById('saveUserModalBtn').addEventListener('click', async () => {
    const originalUsername = document.getElementById('userModalOriginalUsername').value;
    const username = document.getElementById('userModalUsername').value.trim();
    const password = document.getElementById('userModalPassword').value;
    const role = document.getElementById('userModalRole').value;
    const allowedTabs = Array.from(document.querySelectorAll('.user-tab-cb:checked')).map(cb => cb.value);

    if (!username) { alert('Введите логин'); return; }
    if (/\s/.test(username)) { alert('Логин не должен содержать пробелов'); return; }
    const dupe = usersList.find(u => u.username.toLowerCase() === username.toLowerCase() && u.username !== originalUsername);
    if (dupe) { alert('Такой логин уже занят'); return; }

    const isEdit = !!originalUsername;
    if (!isEdit && !password) { alert('Укажите пароль для нового пользователя'); return; }
    if (password && password.length < 4) { alert('Пароль должен быть не короче 4 символов'); return; }
    if (role === 'user' && allowedTabs.length === 0) { if (!confirm('Не выбрано ни одной вкладки — пользователь не увидит данных. Продолжить?')) return; }

    let passHash;
    if (password) passHash = await sha256Hex(password);
    else if (isEdit) passHash = usersList.find(u => u.username === originalUsername).passHash;

    const record = { username, passHash, role, allowedTabs: role === 'admin' ? ALL_TAB_IDS.slice() : allowedTabs };

    if (isEdit) {
        const idx = usersList.findIndex(u => u.username === originalUsername);
        usersList[idx] = record;
        if (originalUsername === currentUser.username) {
            currentUser = { username: record.username, role: record.role, allowedTabs: record.allowedTabs };
            sessionStorage.setItem('snt_current_user', JSON.stringify(currentUser));
            applyRolePermissions();
        }
    } else {
        usersList.push(record);
    }

    document.getElementById('userModal').classList.remove('open');
    renderUsersTable();
});

document.getElementById('saveUsersToGhBtn').addEventListener('click', async () => {
    const token = localStorage.getItem('snt_gh_token');
    if (!token) { alert('Сначала укажите и сохраните GitHub-токен ниже на этой странице.'); return; }
    if (!usersList.some(u => u.role === 'admin')) { alert('В списке должен остаться хотя бы один администратор.'); return; }

    const btn = document.getElementById('saveUsersToGhBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Сохранение...';
    btn.disabled = true;
    try {
        const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${FILES.users}?ref=${GH_BRANCH}`;
        let sha = null;
        const getResp = await fetch(apiUrl, { headers: { Authorization: `token ${token}` } });
        if (getResp.ok) { const info = await getResp.json(); sha = info.sha; }
        else if (getResp.status !== 404) {
            const errInfo = await getResp.json().catch(() => ({}));
            throw new Error(errInfo.message || `HTTP ${getResp.status}`);
        }

        const jsonStr = JSON.stringify({ users: usersList }, null, 2);
        const contentB64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const putResp = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${FILES.users}`, {
            method: 'PUT',
            headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Обновление users.json (${new Date().toLocaleString('ru-RU')})`,
                content: contentB64,
                branch: GH_BRANCH,
                ...(sha ? { sha } : {})
            })
        });
        if (!putResp.ok) {
            const err = await putResp.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${putResp.status}`);
        }
        usersSource = 'remote';
        renderUsersSourceNotice();
        alert('Сохранено в репозиторий. Изменения применятся у всех при следующем входе (может занять пару минут из-за кэша CDN).');
    } catch (e) {
        alert('Не удалось сохранить: ' + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// Отрисовываем таблицу пользователей при заходе на вкладку
document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.page === 'users') {
        tab.addEventListener('click', () => renderUsersTable());
    }
});

document.getElementById('genPassHashBtn').addEventListener('click', async () => {
    const inp = document.getElementById('newPassGenInput');
    const resultBox = document.getElementById('genPassHashResult');
    const pass = inp.value;
    if (!pass || pass.length < 4) { alert('Пароль должен быть не короче 4 символов'); return; }
    const hash = await sha256Hex(pass);
    resultBox.style.display = 'block';
    resultBox.innerHTML = `Готово. Чтобы этот пароль стал действовать для всех:<br>
        1) откройте файл <code>berezka2.js</code> в редакторе;<br>
        2) найдите строку <code>const DEFAULT_PASS_HASH = '...'</code> в начале файла;<br>
        3) замените значение на хеш ниже;<br>
        4) сохраните файл и обновите его там, где он размещён (репозиторий/хостинг).<br><br>
        <strong>Новый хеш:</strong><br><code style="user-select:all;">${hash}</code>`;
});

// Обработка ошибок в глобальном контексте
window.addEventListener('error', function(e) {
    addLog('❌ Ошибка: ' + e.message, 'error');
    console.error('Global error:', e);
});

// Периодическая проверка данных (каждые 5 минут)
setInterval(() => {
    if (allPlots.length === 0) {
        addLog('⏳ Данных нет, проверка подключения...', 'info');
        // Не перезагружаем автоматически, чтобы не сбивать пользователя
    }
}, 300000);

addLog('✅ Приложение готово к работе', 'success');

document.getElementById('toggleEeColumnsBtn').addEventListener('click', () => {
  const panel = document.getElementById('eeColumnSettingsPanel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
  if (panel.style.display !== 'none') renderEeColumnList();
});
document.getElementById('resetEeColumnsBtn').addEventListener('click', () => {
  if (!confirm('Сбросить настройки колонок электроэнергии к стандартным?')) return;
  localStorage.removeItem('snt_ee_cols');
  renderEeColumnList();
  renderElectricityPage();
});
