const STORAGE_KEY = 'dohoon_archive_state_v1';
const EDIT_PASSWORD = 'ff060526';

/* ===== Supabase 初始化（安全兜底）===== */
const SUPABASE_URL = 'https://fcxwfdawbydrkwdnfeth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjeHdmZGF3Ynlkcmt3ZG5mZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTg0NDgsImV4cCI6MjA5OTQzNDQ0OH0.Skp3sCQnseLTjKgdDkNThppHU-IzGzYwcBkfmuaQTOs';

/* ===== 阿里云 OSS 配置 ===== */
const OSS_CONFIG = {
  bucket: 'dohoon-images',
  region: 'oss-cn-shanghai',
  accessKeyId: 'LTAI5t9aAaGRo9HMp4sQ5XfS',
  accessKeySecret: 'ivnB3xSr7l5wpfJLXdWTMRI2X2SQQg'
};

/* ===== Supabase REST API (无需 CDN) ===== */
const SB = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  headers() { return { apikey: this.key, Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' }; },
  async getState() {
    const r = await fetch(`${this.url}/rest/v1/site_state?id=eq.1&select=state_data`, { headers: this.headers() });
    if (!r.ok) throw new Error('GET failed');
    return r.json();
  },
  async updateState(data) {
    const r = await fetch(`${this.url}/rest/v1/rpc/update_state`, { method: 'POST', headers: this.headers(), body: JSON.stringify(data) });
    return r.json();
  },
  async uploadImage(file) {
    const ext = file.name.split('.').pop() || 'jpg';
    const fname = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const h = { apikey: this.key, Authorization: 'Bearer ' + this.key };
    const r = await fetch(`${this.url}/storage/v1/object/images/${fname}`, { method: 'POST', headers: h, body: file });
    if (!r.ok) throw new Error('Upload failed');
    return `${this.url}/storage/v1/object/public/images/${fname}`;
  }
};


async function syncFromSupabase() {
  try {
    const rows = await Promise.race([
      SB.getState(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (rows && rows[0] && rows[0].state_data && Object.keys(rows[0].state_data).length > 0) {
      const parsed = rows[0].state_data;
      applyMigration(parsed);
      migrateAbout(parsed);
      state = { ...defaultState, ...parsed,
        insPosts: parsed.insPosts || [], wvsPosts: parsed.wvsPosts || [],
        tmiItems: parsed.tmiItems || [], stageItems: parsed.stageItems || [],
        records: parsed.records || [],
        customSections: parsed.customSections || [],
        deletedSections: parsed.deletedSections || [] };
      sortAll();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true; // 有数据
    }
  } catch (e) {}
  return false;
}

/* ===== 字段配置（驱动模态框表单）===== */
const FIELD_CONFIGS = {
  insPosts: [
    { key: 'date', label: '日期', type: 'date' },
    { key: 'detailText', label: '正文', type: 'textarea' },
    { key: 'images', label: '🖼 图片', type: 'files' }
  ],
  wvsPosts: [
    { key: 'date', label: '日期', type: 'date' },
    { key: 'detailText', label: '正文', type: 'textarea' },
    { key: 'images', label: '🖼 图片', type: 'files' }
  ],
  tmiItems: [
    { key: 'date', label: '日期', type: 'date' },
    { key: 'text', label: '正文', type: 'textarea' },
    { key: 'images', label: '🖼 图片', type: 'files' }
  ],
  stageItems: [
    { key: 'date', label: '日期', type: 'text' },
    { key: 'text', label: '正文', type: 'textarea' },
    { key: 'images', label: '🖼 图片', type: 'files' }
  ],
  records: [
    { key: 'text', label: '正文', type: 'textarea' },
    { key: 'images', label: '🖼 图片', type: 'files' }
  ],
  about: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'text', label: '个人简介', type: 'textarea' },
    { key: 'link', label: '🔗 链接', type: 'url' },
    { key: 'images', label: '🖼 头像/照片', type: 'files' }
  ]
};

/* ===== 类型中文名映射 ===== */
const TYPE_LABELS = {
  insPosts: 'INS 动态',
  wvsPosts: 'WVS 动态',
  tmiItems: 'TMI',
  stageItems: '舞台',
  records: '记忆册',
  about: '简介'
};

/* ===== 自定义区字段模板 ===== */
const CS_ITEM_FIELDS = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'text', label: '正文', type: 'textarea' },
  { key: 'images', label: '🖼 图片', type: 'files' }
];

const defaultState = {
  eyebrow: '正在加载中...',
  heroTitle: '正在加载中...',
  heroText: '正在加载中...',
  heroCardTitle: '正在加载中...',
  heroCardText: '正在加载中...',
  insEyebrow: '正在加载中...',
  insPostsTitle: '正在加载中...',
  wvsEyebrow: '正在加载中...',
  wvsPostsTitle: '正在加载中...',
  tmiEyebrow: '正在加载中...',
  tmiTitle: '正在加载中...',
  stageEyebrow: '正在加载中...',
  stageTitle: '正在加载中...',
  recordsEyebrow: '正在加载中...',
  recordsTitle: '正在加载中...',
  aboutEyebrow: '正在加载中...',
  footerText: '正在加载中...',
  about: { title: '正在加载中...', text: '正在加载中...', link: '', images: [] },
  insPosts: [],
  wvsPosts: [],
  tmiItems: [],
  stageItems: [],
  records: [],
  customSections: [],
  deletedSections: [],
  sortDesc: true
};

let state = { ...defaultState };
let editMode = false;

/* ===== 模态框状态 ===== */
let modalState = { type: null, index: null, mode: 'view' }; // 'view' | 'edit' | 'create'

/* ===== 持久化（Supabase + localStorage 双写）===== */
async function loadState() {
  const ok = await syncFromSupabase(); // 等云端
  if (!ok) loadFromLocal();           // 云端失败才读本地
}

function loadFromLocal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      applyMigration(parsed);
      state = {
        ...defaultState,
        ...parsed,
        insPosts: parsed.insPosts || defaultState.insPosts,
        wvsPosts: parsed.wvsPosts || defaultState.wvsPosts,
        tmiItems: parsed.tmiItems || defaultState.tmiItems,
        stageItems: parsed.stageItems || defaultState.stageItems,
        records: parsed.records || defaultState.records,
        customSections: parsed.customSections || [],
        deletedSections: parsed.deletedSections || [] };
      // 旧 aboutTitle/aboutText 迁移到 about 对象
      migrateAbout(parsed);
      sortAll();
      // ⚠️ 绝不在此处上传 Supabase — 防止空数据覆盖云端
    }
  } catch (error) {
    console.warn('无法读取本地内容', error);
  }
}

function migrateAbout(parsed) {
  if (parsed.aboutTitle && !parsed.about) {
    state.about = {
      title: parsed.aboutTitle || defaultState.about.title,
      text: parsed.aboutText || defaultState.about.text,
      link: '',
      images: []
    };
  }
}

function migrateImages(obj) {
  // 遍历所有数组模块和 about 对象中的旧 image/imageData → images 数组
  const keys = ['insPosts', 'wvsPosts', 'tmiItems', 'stageItems', 'records'];
  keys.forEach(k => {
    if (Array.isArray(obj[k])) {
      obj[k].forEach(item => {
        if (item.image && !item.images) item.images = [item.image];
        if (item.imageData && !item.images) item.images = [item.imageData];
        if (!item.images) item.images = [];
        delete item.image;
        delete item.imageData;
      });
    }
  });
  if (obj.about && obj.about.image && !obj.about.images) {
    obj.about.images = [obj.about.image];
    delete obj.about.image;
  }
  if (!obj.about || !obj.about.images) {
    if (obj.about) obj.about.images = [];
  }
  // 递归处理 state_data
  if (obj.state_data) migrateImages(obj.state_data);
}

function applyMigration(parsed) {
  if (Array.isArray(parsed.posts) && !Array.isArray(parsed.insPosts)) {
    const ins = [], wvs = [];
    parsed.posts.forEach(p => {
      const { platform, ...rest } = p;
      if (platform === 'Weverse') wvs.push(rest);
      else ins.push(rest);
    });
    parsed.insPosts = ins;
    parsed.wvsPosts = wvs;
    delete parsed.posts;
  }
  // 单图 → 多图数组迁移
  migrateImages(parsed);
}

async function uploadToSupabase() {
  try {
    await SB.updateState({ p_state: state, p_password: EDIT_PASSWORD });
    console.log('✅ 已同步到云端');
  } catch (e) {
    console.warn('云端同步失败:', e.message);
  }
}

function saveState() {
  sortAll();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // 非编辑模式不碰云端（防止意外覆盖）
  if (!editMode) return;
  uploadToSupabase().catch(() => {});
}

/* ===== 辅助函数 ===== */
function parseDate(val) {
  if (!val) return 0;
  // 统一分隔符
  const s = String(val).replace(/\./g, '-').replace(/\//g, '-');
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortAll() {
  const dir = state.sortDesc ? -1 : 1; // -1=新在前, +1=旧在前
  const arrays = ['insPosts', 'wvsPosts', 'tmiItems', 'stageItems'];
  arrays.forEach(key => {
    if (Array.isArray(state[key])) {
      state[key].sort((a, b) => (parseDate(a.date) - parseDate(b.date)) * dir);
    }
  });
  if (Array.isArray(state.records)) {
    state.records.sort((a, b) => (parseDate(a.createdAt) - parseDate(b.createdAt)) * dir);
  }
  if (Array.isArray(state.customSections)) {
    state.customSections.forEach(sec => {
      if (Array.isArray(sec.items)) {
        sec.items.sort((a, b) => (parseDate(a.date) - parseDate(b.date)) * dir);
      }
    });
  }
}

function getItem(type, index) {
  if (!state[type]) return null;
  // about 是单个对象，不是数组
  if (!Array.isArray(state[type])) return state[type];
  return state[type][index] || null;
}

/* ===== 自定义区工具函数 ===== */
function findCustomSection(id) {
  return (state.customSections || []).find(s => s.id === id) || null;
}

function getCSItem(type, index) {
  // type format: "custom_s_1234567890"
  const secId = type.replace('custom_', '');
  const sec = findCustomSection(secId);
  if (!sec || !sec.items) return null;
  return sec.items[index] || null;
}

function csTypeFromId(id) { return 'custom_' + id; }

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/* 上传图片到阿里云 OSS */
async function uploadImageToStorage(file) {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const fname = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const url = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com/${fname}`;
    const contentType = file.type || 'image/jpeg';
    const dateStr = new Date().toUTCString();
    const stringToSign = `PUT\n\n${contentType}\n${dateStr}\n/dohoon-images/${fname}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(OSS_CONFIG.accessKeySecret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const resp = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType, 'Date': dateStr, 'Authorization': `OSS ${OSS_CONFIG.accessKeyId}:${sigB64}` }, body: file });
    if (resp.ok) return url;
    throw new Error('OSS: ' + resp.status);
  } catch (e) {
    console.warn('OSS 上传失败，回退 base64:', e.message);
    return await readFileAsDataUrl(file);
  }
}

async function uploadImagesToStorage(files) {
  const urls = [];
  for (const f of files) {
    const url = await uploadImageToStorage(f);
    if (url) urls.push(url);
  }
  return urls;
}

/* ===== 渲染函数 ===== */
const MAX_PREVIEW = 4;

function makeCard(items, type, index, cardClass, label, date, textSource) {
  const item = items[index];
  const imgs = item.images || [];
  const thumb = imgs.length ? imgs[0] : (item.image || item.imageData || '');
  const imgHtml = thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : '';
  const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
  const title = textSource ? (textSource(item) || '').slice(0, 30) : '';
  const titleHtml = title.length >= 30 ? title + '...' : title;
  return `<article class="${cardClass}" data-type="${type}" data-index="${index}">
    ${imgHtml}${countHtml}
    <span class="post-label">${label}</span>
    <div class="post-meta">${date(item) || ''}</div>
    <h3>${titleHtml || '新帖子'}</h3>
  </article>`;
}

function renderCardList(containerId, items, type, cardClass, label, dateFn, textFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = items.length;
  const preview = items.slice(0, MAX_PREVIEW);
  container.innerHTML = preview.map((_, i) => makeCard(items, type, i, cardClass, label, dateFn, textFn)).join('');
  if (total > MAX_PREVIEW) {
    container.innerHTML += `<a class="more-link" href="posts.html?type=${type}" onclick="event.stopPropagation()">查看更多（共 ${total} 条）→</a>`;
  }
}

function renderInsPosts() {
  renderCardList('ins-feed-list', state.insPosts, 'insPosts', 'card', 'Instagram',
    p => p.date || '', p => p.title || p.detailText || '');
}

function renderWvsPosts() {
  renderCardList('wvs-feed-list', state.wvsPosts, 'wvsPosts', 'card', 'Weverse',
    p => p.date || '', p => p.title || p.detailText || '');
}

function renderTmi() {
  renderCardList('tmi-list', state.tmiItems, 'tmiItems', 'card', 'TMI',
    p => p.date || '', p => p.title || p.text || '');
}

function renderStage() {
  renderCardList('stage-list', state.stageItems, 'stageItems', 'timeline-item', '',
    p => p.date || '', p => p.title || p.text || '');
}

function renderRecords() {
  renderCardList('records-list', state.records, 'records', 'record-card', '',
    p => p.createdAt || '', p => p.title || p.text || '');
}

/* ===== 自定义区渲染 ===== */
function renderCustomSections() {
  const container = document.getElementById('custom-sections');
  const navCustom = document.getElementById('nav-custom');
  if (!container) return;

  const sections = state.customSections || [];
  container.innerHTML = '';

  sections.filter(sec => !state.deletedSections.includes('cs_' + sec.id)).forEach(sec => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';
    sectionEl.id = 'cs-' + sec.id;
    sectionEl.innerHTML = `
      <div class="section-header">
        <div>
          <p class="eyebrow" data-edit-key="${'csEyebrow_' + sec.id}">
            ${state['csEyebrow_' + sec.id] || '自定义'}
            ${editMode ? `<button class="cs-eyebrow-btn mini-btn" data-cs-id="${sec.id}" type="button">✏️</button>` : ''}
          </p>
          <h2 style="cursor:pointer;text-decoration:underline;" onclick="window.location.href='posts.html?type=custom_${sec.id}'">
            <span class="cs-name-text" data-cs-id="${sec.id}">${sec.name}</span>
            ${editMode ? `<button class="cs-rename-btn mini-btn" data-cs-id="${sec.id}" type="button" onclick="event.stopPropagation()">✏️</button>` : ''}
          </h2>
        </div>
        <div class="cs-header-btns">
          ${editMode ? `<button class="cs-add-btn mini-btn" data-cs-id="${sec.id}" type="button">+ 新增帖子</button>` : ''}
          ${editMode ? `<button class="cs-del-btn mini-btn" data-cs-id="${sec.id}" type="button" style="color:#e55;">🗑</button>` : ''}
        </div>
      </div>
      <div class="card-grid" id="cs-grid-${sec.id}">
        ${(sec.items || []).slice(0, MAX_PREVIEW).map((item, i) => {
          const imgs = item.images || [];
          const thumb = imgs.length ? imgs[0] : '';
          return `<article class="card" data-type="${csTypeFromId(sec.id)}" data-index="${i}">
            ${thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : ''}
            ${imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : ''}
            <div class="post-meta">${item.date || ''}</div>
            <h3>${item.text ? (item.text || '').slice(0, 30) + ((item.text || '').length > 30 ? '...' : '') : '新帖子'}</h3>
          </article>`;
        }).join('')}
        ${(sec.items || []).length > MAX_PREVIEW ? `<a class="more-link" href="posts.html?type=custom_${sec.id}" onclick="event.stopPropagation()">查看更多（共 ${(sec.items || []).length} 条）→</a>` : ''}
      </div>
    `;
    container.appendChild(sectionEl);
  });

  // 编辑模式按钮事件（渲染后绑定）
  if (editMode) {
    bindCSSectionEvents();
  }
}

function bindCSSectionEvents() {
  document.querySelectorAll('.cs-add-btn').forEach(btn => {
    btn.onclick = () => { openCreateModal(csTypeFromId(btn.dataset.csId)); };
  });
  document.querySelectorAll('.cs-del-btn').forEach(btn => {
    btn.onclick = () => deleteCustomSection(btn.dataset.csId);
  });
  document.querySelectorAll('.cs-rename-btn').forEach(btn => {
    btn.onclick = () => renameCustomSection(btn.dataset.csId);
  });
  document.querySelectorAll('.cs-eyebrow-btn').forEach(btn => {
    btn.onclick = () => {
      const key = 'csEyebrow_' + btn.dataset.csId;
      const cur = state[key] || '自定义';
      const newVal = prompt('修改粉红小字：', cur);
      if (newVal !== null && newVal.trim()) {
        state[key] = newVal.trim();
        saveState();
        renderCustomSections();
        bindCSSectionEvents();
      }
    };
  });
}

function createCustomSection() {
  if (!editMode) return;
  const name = prompt('请输入新区块名称：');
  if (!name || !name.trim()) return;
  const id = 's_' + Date.now();
  state.customSections.unshift({ id, name: name.trim(), items: [] });
  state['csEyebrow_' + id] = '自定义';
  saveState();
  renderCustomSections();
  updateNavCustom();
  updateEditMode(editMode);
}

function deleteCustomSection(id) {
  if (!confirm('确定要删除整个「' + (findCustomSection(id)?.name || '') + '」区块吗？所有帖子将丢失。')) return;

  // 记录到 deletedSections，后续可恢复
  if (!state.deletedSections.includes('cs_' + id)) {
    state.deletedSections.push('cs_' + id);
  }

  saveState();
  renderCustomSections();
  updateNavCustom();
}

function renameCustomSection(id) {
  const sec = findCustomSection(id);
  if (!sec) return;
  const name = prompt('修改区块名称：', sec.name);
  if (!name || !name.trim()) return;
  sec.name = name.trim();
  saveState();
  renderCustomSections();
  updateNavCustom();
}

/* 给所有板块标题栏加排序按钮 */
function addSectionSortBtns() {
  const headers = document.querySelectorAll('.section-header');
  headers.forEach(header => {
    // 先移除旧按钮
    const old = header.querySelector('.sort-btn');
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.className = 'sort-btn mini-btn';
    btn.textContent = state.sortDesc ? '↓ 最新' : '↑ 最早';
    btn.type = 'button';
    btn.title = '切换排序';
    btn.onclick = (e) => {
      e.stopPropagation();
      state.sortDesc = !state.sortDesc;
      sortAll();
      saveState();
      renderAll();
    };
    header.appendChild(btn);
  });
}

function updateNavCustom() {
  const navEl = document.getElementById('nav-custom');
  if (!navEl) return;

  const customLinks = (state.customSections || [])
    .filter(sec => !state.deletedSections.includes('cs_' + sec.id))
    .map(sec => `<a href="#cs-${sec.id}">${sec.name}</a>`);

  navEl.innerHTML = customLinks.join('');

  // 固定区块：如果被删除就隐藏对应的导航链接
  document.querySelectorAll('.nav-fixed').forEach(a => {
    const href = a.getAttribute('href') || '';
    const key = hrefToKey(href);
    if (key && state.deletedSections.includes(key)) {
      a.style.display = 'none';
    } else {
      a.style.display = '';
    }
  });
}

function hrefToKey(href) {
  if (href === '#ins-posts') return 'insPosts';
  if (href === '#wvs-posts') return 'wvsPosts';
  if (href === '#tmi') return 'tmiItems';
  if (href === '#stage') return 'stageItems';
  if (href === '#records') return 'records';
  if (href === '#about') return 'about';
  return null;
}

function applyGlobalTexts() {
  document.querySelectorAll('[data-edit-key]').forEach((element) => {
    const key = element.dataset.editKey;
    if (state[key] !== undefined) {
      element.textContent = state[key];
    }
  });
  // 渲染 about 内容
  if (state.about) {
    const titleEl = document.querySelector('#about [data-edit-key="aboutTitle"]');
    const textEl = document.querySelector('#about [data-edit-key="aboutText"]');
    if (titleEl) titleEl.textContent = state.about.title || 'Kim Dohoon · TWS';
    if (textEl) textEl.textContent = state.about.text || '';
    // 头像
    const avatar = document.querySelector('#about .avatar-shell span');
    const aboutImg = (state.about.images && state.about.images[0]) || state.about.image || '';
    if (avatar && aboutImg) {
      avatar.innerHTML = `<img src="${aboutImg}" style="width:72px;height:72px;border-radius:24px;object-fit:cover;" alt="" />`;
    }
  }
}

/* ===== 编辑模式 ===== */
function updateEditMode(enabled) {
  editMode = enabled;
  document.body.classList.toggle('edit-mode', enabled);
  document.querySelectorAll('[contenteditable="false"].editable-field').forEach((element) => {
    element.contentEditable = enabled;
  });
  document.querySelectorAll('[data-edit-key]').forEach((element) => {
    element.contentEditable = enabled;
    if (enabled) {
      element.title = '点击直接编辑';
      element.style.cursor = 'text';
    } else {
      element.removeAttribute('title');
      element.style.cursor = '';
    }
  });

  const csActions = document.getElementById('cs-actions');
  if (csActions) csActions.style.display = enabled ? 'block' : 'none';

  // 清除所有编辑专属按钮
  document.querySelectorAll('.section-header-btn,.section-hide-btn').forEach(b => b.remove());

  if (!enabled) {
    renderAll();
    return;
  }

  // === 以下仅编辑模式 ===

  // 先渲染自定义区，后续 ✏️/🗑 才能找到它们的元素
  renderCustomSections();

  // 🗑 删除 / 恢复按钮
  document.querySelectorAll('.section-header').forEach(header => {
    const section = header.closest('[data-section-key]');
    if (!section) return;
    const key = section.dataset.sectionKey;
    if (state.deletedSections.includes(key)) {
      addRestoreBtn(header, key);
    } else {
      addDeleteBtn(header, key);
    }
  });
  const aboutSection = document.querySelector('#about[data-section-key]');
  if (aboutSection) {
    const aboutContent = aboutSection.querySelector('.about-content');
    if (aboutContent) {
      const key = 'about';
      if (state.deletedSections.includes(key)) {
        addRestoreBtn(aboutContent, key);
      } else {
        addDeleteBtn(aboutContent, key);
      }
    }
  }

  function addDeleteBtn(parent, key) {
    const btn = document.createElement('button');
    btn.className = 'section-hide-btn mini-btn';
    btn.textContent = '🗑 删除';
    btn.type = 'button';
    btn.style.cssText = 'margin-left:8px;color:#e55;';
    btn.onclick = (e) => { e.stopPropagation(); deleteSectionData(key); };
    parent.appendChild(btn);
  }

  function addRestoreBtn(parent, key) {
    const btn = document.createElement('button');
    btn.className = 'section-hide-btn mini-btn';
    btn.textContent = '↩ 恢复';
    btn.type = 'button';
    btn.style.cssText = 'margin-left:8px;color:#4a9;';
    btn.onclick = (e) => { e.stopPropagation(); restoreSection(key); };
    parent.appendChild(btn);
  }

  // ✏️ 图标（跳过自定义区 — 它们模板里自带按钮）
  document.querySelectorAll('[data-edit-key]').forEach(el => {
    if (el.closest('#custom-sections')) return;
    if (el.parentElement?.querySelector('.cs-rename-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'section-header-btn';
    btn.textContent = '✏️';
    btn.type = 'button';
    btn.title = '点击修改';
    btn.onclick = (e) => {
      e.stopPropagation();
      const newVal = prompt('修改：', el.textContent.trim());
      if (newVal !== null && newVal.trim()) {
        el.textContent = newVal.trim();
        state[el.dataset.editKey] = newVal.trim();
        saveState();
      }
    };
    el.insertAdjacentElement('afterend', btn);
  });

  if (document.getElementById('detail-modal').classList.contains('active')) {
    renderModalContent();
    initCarousel();
  }
  updateNavCustom();
}

function handleEditToggle() {
  const button = document.getElementById('edit-toggle');
  if (!button) return;

  button.addEventListener('click', () => {
    if (editMode) {
      // 保存并退出 — 立即写本地，异步同步云端
      saveState();
      updateEditMode(false);
      button.textContent = '进入编辑模式';
      return;
    }

    const entered = prompt('请输入编辑密码：');
    if (entered === EDIT_PASSWORD) {
      updateEditMode(true);
      button.textContent = '保存并退出';
    } else if (entered !== null) {
      alert('密码错误，只有你可以进入编辑模式。');
    }
  });
}

/* ==================== 模态框系统 ==================== */

function openModal(type, index) {
  modalState = { type, index, mode: editMode ? 'edit' : 'view' };
  renderModalContent();
  initCarousel();
  document.getElementById('detail-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openCreateModal(type) {
  if (!editMode) {
    alert('请先进入编辑模式。');
    return;
  }
  modalState = { type, index: null, mode: 'create' };
  renderModalContent();
  initCarousel();
  document.getElementById('detail-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  savingModal = false;
  document.getElementById('detail-modal').classList.remove('active');
  document.body.style.overflow = '';
  modalState = { type: null, index: null, mode: 'view' };
}

function renderModalContent() {
  const { type, index, mode } = modalState;
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const deleteBtn = document.getElementById('modal-delete-btn');

  if (!type || !bodyEl) return;

  const isView = mode === 'view';
  const isCreate = mode === 'create';

  const isCustom = type.startsWith('custom_');
  let item, fields, label, images;

  if (isCustom) {
    item = isCreate ? {} : (getCSItem(type, index) || {});
    fields = CS_ITEM_FIELDS;
    const secId = type.replace('custom_', '');
    const sec = findCustomSection(secId);
    label = sec ? sec.name : '自定义区';
    images = item.images || [];
  } else {
    item = isCreate ? {} : (getItem(type, index) || {});
    fields = FIELD_CONFIGS[type] || [];
    label = TYPE_LABELS[type] || type;
    images = item.images || [];
  }

  // 标题
  if (isCreate) {
    titleEl.textContent = `新增${label}`;
  } else {
    const bodyText = item.detailText || item.text || '';
    titleEl.textContent = item.title || item.date || bodyText.slice(0, 20) || label;
  }

  // 主体内容
  let html = '';

  // 查看模式：图片轮播在顶部
  if (isView && images.length) {
    html += buildImageCarousel(images);
  }

  // 编辑模式：现有图片管理 + 新图片上传
  if (!isView) {
    html += `<div class="modal-field">
      <label>${images.length ? `已有 ${images.length} 张图片` : '上传图片（可多选）'}</label>`;
    if (images.length) {
      html += `<div class="modal-existing-imgs">`;
      images.forEach((img, i) => {
        html += `<div class="existing-img-wrap">
          <img src="${img}" class="existing-thumb" alt="" />
          <button class="remove-img-btn" type="button" data-idx="${i}" title="删除此图">&times;</button>
        </div>`;
      });
      html += `</div>`;
    }
    html += `<input type="file" accept="image/*" multiple data-field-key="images" />
      <small style="color:var(--muted)">可一次选择多张；选择后将追加到现有图片中</small>
    </div>`;
  }

  // 其他字段
  fields.forEach((field) => {
    if (field.type === 'files' || field.type === 'file') return; // 图片已经单独处理
    const value = item[field.key] || '';

    if (isView) {
      if (field.type === 'url') {
        if (value) {
          html += `<div class="modal-field">
            <label>${field.label}</label>
            <div class="field-value"><a href="${value}" target="_blank" rel="noopener">${value}</a></div>
          </div>`;
        }
        return;
      }
      if (value) {
        html += `<div class="modal-field">
          <label>${field.label}</label>
          <div class="field-value">${value.replace(/\n/g, '<br>')}</div>
        </div>`;
      }
    } else {
      if (field.type === 'textarea') {
        html += `<div class="modal-field">
          <label>${field.label}</label>
          <textarea data-field-key="${field.key}" rows="4">${value}</textarea>
        </div>`;
      } else {
        html += `<div class="modal-field">
          <label>${field.label}</label>
          <input type="${field.type}" data-field-key="${field.key}" value="${value.replace(/"/g, '&quot;')}" />
        </div>`;
      }
    }
  });

  bodyEl.innerHTML = html;

  // 页脚按钮
  if (isView) {
    footerEl.classList.add('hidden');
  } else {
    footerEl.classList.remove('hidden');
    if (isCreate || type === 'about') {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = '';
    }
  }

  // 图片删除按钮事件
  bodyEl.querySelectorAll('.remove-img-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      images.splice(idx, 1);
      renderModalContent(); // 刷新
    });
  });
}

function buildImageCarousel(images) {
  if (!images.length) return '';
  if (images.length === 1) {
    return `<div class="modal-field">
      <label>图片</label>
      <img src="${images[0]}" class="modal-image-preview" alt="" />
    </div>`;
  }
  let carousel = `<div class="carousel">
    <div class="carousel-track" id="carousel-track">
      ${images.map(img => `<img src="${img}" class="modal-image-preview carousel-slide" alt="" />`).join('')}
    </div>
    <div class="carousel-controls">
      <button class="carousel-btn" id="carousel-prev" type="button">←</button>
      <div class="carousel-dots" id="carousel-dots">
        ${images.map((_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></span>`).join('')}
      </div>
      <button class="carousel-btn" id="carousel-next" type="button">→</button>
    </div>
    <div class="carousel-counter">共 ${images.length} 张</div>
  </div>`;
  return carousel;
}

// 轮播导航（在 modal body 渲染后绑定）
function initCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  const slides = track.querySelectorAll('img');
  const dots = document.querySelectorAll('#carousel-dots .carousel-dot');
  let cur = 0;

  function go(i) {
    if (i < 0 || i >= slides.length) return;
    cur = i;
    track.style.transform = `translateX(-${cur * 100}%)`;
    dots.forEach((d, j) => d.classList.toggle('active', j === cur));
  }

  document.getElementById('carousel-prev')?.addEventListener('click', () => go(cur - 1));
  document.getElementById('carousel-next')?.addEventListener('click', () => go(cur + 1));
  dots.forEach(d => d.addEventListener('click', () => go(parseInt(d.dataset.idx, 10))));

  // 触摸滑动
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? cur + 1 : cur - 1);
  });
}

let savingModal = false;
async function handleModalSave() {
  if (savingModal) return;
  savingModal = true;
  try {
    const { type, index, mode } = modalState;
    if (!type) { savingModal = false; return; }

    const isCreate = mode === 'create';
    const isCustom = type.startsWith('custom_');
    const fields = isCustom ? CS_ITEM_FIELDS : (FIELD_CONFIGS[type] || []);
    const bodyEl = document.getElementById('modal-body');
    if (!bodyEl) return;

    const getExistingItem = () => isCustom ? getCSItem(type, index) : getItem(type, index);

    const data = {};
    for (const field of fields) {
      if (field.type === 'files' || field.type === 'file') {
        const input = bodyEl.querySelector(`[data-field-key="${field.key}"]`);
        const files = input?.files;
        const existingArr = isCreate ? [] : [...(getExistingItem()?.[field.key] || [])];
        if (files && files.length) {
          const urls = await uploadImagesToStorage(Array.from(files));
          existingArr.push(...urls);
        }
        data[field.key] = existingArr;
      } else {
        const input = bodyEl.querySelector(`[data-field-key="${field.key}"]`);
        data[field.key] = input?.value?.trim() || '';
      }
    }

    if (isCustom) {
      const secId = type.replace('custom_', '');
      const sec = findCustomSection(secId);
      if (sec) {
        if (isCreate) sec.items.unshift(data);
        else if (sec.items[index] !== undefined) sec.items[index] = { ...sec.items[index], ...data };
      }
    } else if (isCreate) {
      if (type === 'records') data.createdAt = new Date().toLocaleString('zh-CN');
      state[type].unshift(data);
    } else {
      if (!Array.isArray(state[type])) state[type] = { ...state[type], ...data };
      else if (state[type][index] !== undefined) state[type][index] = { ...state[type][index], ...data };
    }

    sortAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    uploadToSupabase().catch(() => {});
    renderAll();
    updateEditMode(editMode);
    closeModal();
  } catch (e) {
    alert('保存失败：' + e.message);
  } finally {
    savingModal = false;
  }
}

function handleModalDelete() {
  const { type, index } = modalState;
  if (!type || index === null) return;

  if (!confirm('确定要删除这条内容吗？此操作不可撤销。')) return;

  const isCustom = type.startsWith('custom_');
  if (isCustom) {
    const secId = type.replace('custom_', '');
    const sec = findCustomSection(secId);
    if (sec && sec.items && sec.items[index] !== undefined) {
      sec.items.splice(index, 1);
      saveState();
      renderAll();
      updateEditMode(editMode);
      closeModal();
    }
    return;
  }

  if (state[type] && state[type][index] !== undefined) {
    state[type].splice(index, 1);
    saveState();
    renderAll();
    updateEditMode(editMode);
    closeModal();
  }
}

/* ===== 统一渲染 ===== */
function isHidden(key) {
  return (state.hiddenSections || []).includes(key);
}

function deleteSectionData(key) {
  if (!confirm('确定要删除这个区域吗？所有内容将丢失，不可撤销！')) return;

  // 清除数据
  if (Array.isArray(state[key])) {
    state[key] = [];
  } else if (key === 'about') {
    state.about = { ...defaultState.about, link: '', images: [] };
  }

  // 标记为已删除 → 不再渲染
  if (!state.deletedSections.includes(key)) {
    state.deletedSections.push(key);
  }

  sortAll();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  uploadToSupabase().catch(() => {});

  renderAll();
  updateEditMode(editMode);
}

function restoreSection(key) {
  state.deletedSections = state.deletedSections.filter(k => k !== key);
  saveState();
  renderAll();
  updateEditMode(editMode);
}

function renderAll() {
  applyGlobalTexts();
  if (!state.deletedSections.includes('insPosts')) renderInsPosts(); else hideSection('insPosts');
  if (!state.deletedSections.includes('wvsPosts')) renderWvsPosts(); else hideSection('wvsPosts');
  if (!state.deletedSections.includes('tmiItems')) renderTmi(); else hideSection('tmiItems');
  if (!state.deletedSections.includes('stageItems')) renderStage(); else hideSection('stageItems');
  if (!state.deletedSections.includes('records')) renderRecords(); else hideSection('records');
  if (!state.deletedSections.includes('about')) {
    document.getElementById('about').style.display = '';
  } else {
    document.getElementById('about').style.display = 'none';
  }
  renderCustomSections();
  updateNavCustom();
  addSectionSortBtns();
}

function hideSection(key) {
  const el = document.querySelector(`[data-section-key="${key}"]`);
  if (el) el.style.display = 'none';
}

/* ===== 搜索 & 日历过滤 ===== */
function normalizeDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  // "2026-07-13" → "2026-07-13"
  // "2026.07" → "2026-07"
  // "2026/7/13 15:30" → "2026-07-13"
  const d = new Date(s.replace(/\./g, '-').replace(/\//g, '-'));
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return s.replace(/\./g, '-');
}

function getCardText(card) {
  // 收集卡片所有文字
  return (card.textContent || '').toLowerCase();
}

/* ALL_SECTIONS: key → [dom selector, card selector] */
const ALL_SECTIONS = [
  ['insPosts',      '#ins-posts',       '.card'],
  ['wvsPosts',      '#wvs-posts',       '.card'],
  ['tmiItems',      '#tmi',            '.card'],
  ['stageItems',    '#stage',          '.timeline-item'],
  ['records',       '#records',        '.record-card'],
  ['about',         '#about',          '[data-type]']
];

function applyFilters() {
  const keyword = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const pickDate = document.getElementById('search-date')?.value || '';
  unmarkAll();

  // 1. 所有卡片：过滤 + 高亮
  document.querySelectorAll('.card, .timeline-item, .record-card').forEach(card => {
    let show = true;
    if (keyword) show = (card.textContent||'').toLowerCase().includes(keyword);
    if (show && pickDate) {
      const de = card.querySelector('.post-meta,.timeline-date,.record-meta');
      show = normalizeDate(de?.textContent?.trim()||'').startsWith(pickDate);
    }
    card.style.display = show ? '' : 'none';
    if (show && keyword) highlightCardText(card, keyword);
  });

  // 2. 固定区域：无可见卡片 → 隐藏
  ALL_SECTIONS.forEach(([key, sel, _]) => {
    const sec = document.querySelector(sel);
    if (!sec) return;
    if (state.deletedSections.includes(key)) { sec.style.display='none'; return; }
    if (!keyword && !pickDate) { sec.style.display=''; return; }
    const cards = sec.querySelectorAll('.card, .timeline-item, .record-card');
    sec.style.display = [...cards].every(c=>c.style.display==='none') ? 'none' : '';
  });

  // 3. 自定义区
  document.querySelectorAll('#custom-sections .section').forEach(sec => {
    const csKey = 'cs_' + sec.id.replace('cs-','');
    if (state.deletedSections.includes(csKey)) { sec.style.display='none'; return; }
    if (!keyword && !pickDate) { sec.style.display=''; return; }
    const cards = sec.querySelectorAll('.card, .timeline-item, .record-card');
    sec.style.display = [...cards].every(c=>c.style.display==='none') ? 'none' : '';
  });
}

function highlightCardText(root, keyword) {
  if (!keyword) return;
  const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('(' + esc + ')', 'gi');
  root.querySelectorAll('h3, p, .post-meta, .timeline-date, .record-meta, .record-body').forEach(el => {
    if (el.querySelector('mark')) return;
    // 保护已有 label/span 标签
    const marks = [];
    el.innerHTML = el.innerHTML.replace(/<mark[^>]*>.*?<\/mark>/gi, m => { marks.push(m); return '\x00M' + (marks.length-1) + '\x00'; });
    el.innerHTML = el.innerHTML.replace(regex, '<mark style="background:#ffe066;color:#333;border-radius:3px;padding:0 2px;">$1</mark>');
    marks.forEach((m,i) => { el.innerHTML = el.innerHTML.replace('\x00M'+i+'\x00', m); });
  });
}

function unmarkAll() {
  [...document.querySelectorAll('mark')].forEach(m=>{
    if (m.parentNode) { m.parentNode.replaceChild(document.createTextNode(m.textContent), m); m.parentNode.normalize(); }
  });
}

function clearFilters() {
  unmarkAll();
  document.getElementById('search-input').value = '';
  document.getElementById('search-date').value = '';
  document.querySelectorAll('.card,.timeline-item,.record-card').forEach(c=>c.style.display='');
  ALL_SECTIONS.forEach(([key,sel])=>{
    const s=document.querySelector(sel);
    if (s) s.style.display = state.deletedSections.includes(key) ? 'none' : '';
  });
  document.querySelectorAll('#custom-sections .section').forEach(s=>{
    s.style.display = state.deletedSections.includes('cs_'+s.id.replace('cs-','')) ? 'none' : '';
  });
}

/* ===== 事件绑定 ===== */
function attachEvents() {
  // 全局 input 事件 — 处理 data-edit-key 和 contenteditable 的实时保存
  document.addEventListener('input', (event) => {
    const target = event.target;

    // 模态框内的字段不在这里处理
    if (target.closest('#detail-modal')) return;

    if (target.matches('[data-edit-key]')) {
      const key = target.dataset.editKey;
      state[key] = target.textContent.trim();
      saveState();
      return;
    }

    if (target.matches('.editable-field[data-group]')) {
      const { group, index, field } = target.dataset;
      if (state[group] && state[group][index]) {
        state[group][index][field] = target.textContent.trim();
        saveState();
      }
    }
  });

  // 卡片点击 → 打开详情模态框（PC + 移动端通用）
  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-type][data-index]');
    if (!card) return;
    if (event.target.closest('a, button, input, textarea, [contenteditable="true"], .carousel, .lightbox')) return;

    const type = card.dataset.type;
    const index = parseInt(card.dataset.index, 10);
    if (type && !isNaN(index)) {
      event.preventDefault();
      openModal(type, index);
    }
  });

  // "新增 INS 动态" 按钮
  document.getElementById('add-ins-post-btn')?.addEventListener('click', () => {
    openCreateModal('insPosts');
  });

  // "新增 WVS 动态" 按钮
  document.getElementById('add-wvs-post-btn')?.addEventListener('click', () => {
    openCreateModal('wvsPosts');
  });

  // "新增 TMI" 按钮
  document.getElementById('add-tmi-btn')?.addEventListener('click', () => {
    openCreateModal('tmiItems');
  });

  // "新增舞台" 按钮
  document.getElementById('add-stage-btn')?.addEventListener('click', () => {
    openCreateModal('stageItems');
  });

  // "新增区域" 按钮
  document.getElementById('add-section-btn')?.addEventListener('click', createCustomSection);

  // ===== 板块标题点击 → 跳转详情页 =====
  const TYPE_PAGE_MAP = {
    insPosts: 'posts.html?type=insPosts',
    wvsPosts: 'posts.html?type=wvsPosts',
    tmiItems: 'posts.html?type=tmiItems',
    stageItems: 'posts.html?type=stageItems',
    records: 'posts.html?type=records'
  };
  document.querySelectorAll('[data-section-key]').forEach(sec => {
    const h2 = sec.querySelector('h2');
    if (!h2 || !TYPE_PAGE_MAP[sec.dataset.sectionKey]) return;
    h2.style.cursor = 'pointer';
    h2.style.textDecoration = 'underline';
    h2.addEventListener('click', () => { window.location.href = TYPE_PAGE_MAP[sec.dataset.sectionKey]; });
  });
  // ===== 搜索 & 日历 =====
  let searchTimer = 0;
  document.getElementById('search-input')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
  document.getElementById('search-date')?.addEventListener('change', applyFilters);
  document.getElementById('search-clear')?.addEventListener('click', clearFilters);

  addSectionSortBtns();

  // 模态框 — 关闭
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

  // 模态框 — ESC 关闭
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('detail-modal').classList.contains('active')) {
      closeModal();
    }
  });

  // 模态框 — 保存
  document.getElementById('modal-save-btn')?.addEventListener('click', handleModalSave);

  // 模态框 — 删除
  document.getElementById('modal-delete-btn')?.addEventListener('click', handleModalDelete);

  // ===== 图片灯箱 =====
  const lightboxEl = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxDl = document.getElementById('lightbox-download');
  const lightboxCounter = document.getElementById('lightbox-counter');
  let lightboxImages = [];
  let lightboxIdx = 0;

  document.getElementById('detail-modal')?.addEventListener('click', (event) => {
    const img = event.target.closest('.modal-image-preview');
    if (!img || !img.src) return;
    // 收集当前模态框中所有图片
    const allImgs = document.querySelectorAll('#detail-modal .modal-image-preview');
    lightboxImages = Array.from(allImgs).map(el => el.src);
    lightboxIdx = lightboxImages.indexOf(img.src);
    if (lightboxIdx < 0) lightboxIdx = 0;
    showLightboxImage();
    lightboxEl?.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  function showLightboxImage() {
    if (!lightboxImg) return;
    lightboxImg.src = lightboxImages[lightboxIdx] || '';
    if (lightboxDl) lightboxDl.href = lightboxImages[lightboxIdx] || '';
    if (lightboxCounter) lightboxCounter.textContent = `${lightboxIdx + 1} / ${lightboxImages.length}`;
    document.getElementById('lightbox-prev').style.display = lightboxImages.length > 1 ? '' : 'none';
    document.getElementById('lightbox-next').style.display = lightboxImages.length > 1 ? '' : 'none';
  }

  document.getElementById('lightbox-prev')?.addEventListener('click', () => {
    if (lightboxIdx > 0) { lightboxIdx--; showLightboxImage(); }
  });
  document.getElementById('lightbox-next')?.addEventListener('click', () => {
    if (lightboxIdx < lightboxImages.length - 1) { lightboxIdx++; showLightboxImage(); }
  });
  document.getElementById('lightbox-close')?.addEventListener('click', () => {
    lightboxEl?.classList.remove('active');
    document.body.style.overflow = '';
  });
  document.querySelector('.lightbox-overlay')?.addEventListener('click', () => {
    lightboxEl?.classList.remove('active');
    document.body.style.overflow = '';
  });

  document.addEventListener('keydown', (event) => {
    if (!lightboxEl?.classList.contains('active')) return;
    if (event.key === 'Escape') {
      lightboxEl.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (event.key === 'ArrowLeft' && lightboxIdx > 0) { lightboxIdx--; showLightboxImage(); }
    if (event.key === 'ArrowRight' && lightboxIdx < lightboxImages.length - 1) { lightboxIdx++; showLightboxImage(); }
  });

  // ===== 记忆册模块 — 保留原有内联表单逻辑 =====
  const recordForm = document.getElementById('record-form');
  const toggleButton = document.getElementById('toggle-record-form-btn');
  const saveButton = document.getElementById('save-record-btn');
  const textInput = document.getElementById('record-text');
  const imageInput = document.getElementById('record-image');

  toggleButton?.addEventListener('click', () => {
    if (!editMode) {
      alert('请先进入编辑模式。');
      return;
    }
    recordForm?.classList.toggle('active');
  });

  saveButton?.addEventListener('click', async () => {
    if (!editMode) {
      alert('请先进入编辑模式。');
      return;
    }

    const text = textInput?.value.trim() || '写下你此刻想记住的心情。';
    const imageFiles = Array.from(imageInput?.files || []);
    const images = await uploadImagesToStorage(imageFiles);

    state.records.unshift({
      text,
      images,
      createdAt: new Date().toLocaleString('zh-CN')
    });

    saveState();
    renderRecords();
    if (recordForm) recordForm.classList.remove('active');
    if (textInput) textInput.value = '';
    if (imageInput) imageInput.value = '';
  });
}

/* ===== 初始化 ===== */
async function initPage() {
  await loadState();
  renderAll();
  handleEditToggle();
  attachEvents();
  updateEditMode(false);
}

initPage();
