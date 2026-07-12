const STORAGE_KEY = 'dohoon_archive_state_v1';
const EDIT_PASSWORD = 'ff060526';

/* ===== Supabase 初始化（安全兜底）===== */
const SUPABASE_URL = 'https://fcxwfdawbydrkwdnfeth.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjeHdmZGF3Ynlkcmt3ZG5mZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTg0NDgsImV4cCI6MjA5OTQzNDQ0OH0.Skp3sCQnseLTjKgdDkNThppHU-IzGzYwcBkfmuaQTOs';

let supabaseClient = null;
let supabaseLoading = false;
let pendingSync = false; // SDK 加载完成后是否需要上传

/* ===== 阿里云 OSS 配置 ===== */
const OSS_CONFIG = {
  bucket: 'dohoon-images',
  region: 'oss-cn-shanghai',
  accessKeyId: 'LTAI5t9aAaGRo9HMp4sQ5XfS',
  accessKeySecret: 'ivnB3xSr7l5wpfJLXdWTMRI2X2SQQg'
};

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!supabaseLoading) {
    supabaseLoading = true;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      // SDK 到账：先拉云端，再推送待同步数据
      syncFromSupabase().then(() => {
        if (pendingSync) {
          pendingSync = false;
          uploadToSupabase().catch(() => {});
        }
      });
    };
    document.head.appendChild(script);
  }
  return null;
}

async function syncFromSupabase() {
  const s = supabaseClient;
  if (!s) return;
  try {
    const result = await Promise.race([
      s.from('site_state').select('state_data').eq('id', 1).single(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (!result.error && result.data?.state_data && Object.keys(result.data.state_data).length > 0) {
      const parsed = result.data.state_data;
      applyMigration(parsed);
      migrateAbout(parsed);
      state = { ...defaultState, ...parsed,
        insPosts: parsed.insPosts || state.insPosts, wvsPosts: parsed.wvsPosts || state.wvsPosts,
        tmiItems: parsed.tmiItems || state.tmiItems, stageItems: parsed.stageItems || state.stageItems,
        records: parsed.records || state.records };
      sortAll();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
    }
  } catch (e) {}
}

const IS_LOCAL = window.location.protocol === 'file:';

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

const defaultState = {
  eyebrow: 'TWS · Kim Dohoon',
  heroTitle: '为金道勋打造一座只属于你的追星记忆站',
  heroText: '这里用来收纳他在 Instagram 与 Weverse 上发布的动态、舞台上的每一次亮相、以及那些让人一眼就想收藏的 TMI 小细节。',
  heroCardTitle: 'Kim Dohoon',
  heroCardText: '把每一次更新都整理成一张张卡片，方便你随时回看他在舞台上和生活里留下的每一份光。',
  insPostsTitle: '记录金道勋的 Instagram 动态',
  wvsPostsTitle: '记录金道勋的 Weverse 动态',
  tmiTitle: '那些你想反复翻看的细节',
  stageTitle: '每一场演出都是一段记忆',
  recordsTitle: '照片与文字记录',
  about: {
    title: 'Kim Dohoon · TWS',
    text: '这是你为金道勋建立的专属页面，记录他在舞台上、镜头前、留言里留下的每一道光。',
    link: '',
    images: []
  },
  insPosts: [
    {
      date: '2026-07-10',
      title: '新照片与短视频',
      description: '把金道勋在日常和舞台里露出的那种轻柔气质，一张一张地收进你的记忆里。',
      detailText: '',
      tag: '新动态',
      link: '',
      images: []
    },
    {
      date: '2026-06-28',
      title: '舞台后花絮',
      description: '记录 backstage 的小动作、服装细节和那些只在镜头里才看得到的瞬间。',
      detailText: '',
      tag: '花絮',
      link: '',
      image: ''
    }
  ],
  wvsPosts: [
    {
      date: '2026-07-06',
      title: 'Weverse 留言与公告',
      description: '把官方留言、特别更新和他留下的每一句话都和你心里的情绪串在一起。',
      detailText: '',
      tag: '公告',
      link: '',
      image: ''
    }
  ],
  tmiItems: [
    { date: '2026-07-01', title: '舞台前的习惯', text: '每次上台前都会先看一眼镜子，像是在给自己一次最后的确认。', link: '', image: '' },
    { date: '2026-06-15', title: '最爱的互动方式', text: '他总会在直播或留言里留下很轻的笑意，让人一下子就会心一软。', link: '', image: '' },
    { date: '2026-05-20', title: '最想记住的一句', text: '把那句让你想起他的台词、眼神和那种温柔的瞬间，写进这里。', link: '', image: '' }
  ],
  stageItems: [
    { date: '2026.07', title: '演唱会舞台', text: '那一刻的站姿和眼神，让人忍不住想把它们永久留在屏幕里。', link: '', image: '' },
    { date: '2026.05', title: '音乐节登场', text: '现场的热闹与他的专注，让每一个镜头都像在发光。', link: '', image: '' },
    { date: '2026.03', title: '特别舞台', text: '那场特别编排让所有人都记住了他站在舞台中央的模样。', link: '', image: '' }
  ],
  records: []
};

let state = { ...defaultState };
let editMode = false;

/* ===== 模态框状态 ===== */
let modalState = { type: null, index: null, mode: 'view' }; // 'view' | 'edit' | 'create'

/* ===== 持久化（Supabase + localStorage 双写）===== */
function loadState() {
  // 读本地 → 秒开
  loadFromLocal();
  // 后台触发 Supabase SDK 加载（完全不阻塞）
  getSupabase();
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
        records: parsed.records || defaultState.records
      };
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
  const s = getSupabase();
  if (!s) {
    // SDK 还没加载完，标记待同步
    pendingSync = true;
    return;
  }
  try {
    await s.rpc('update_state', {
      p_state: state,
      p_password: EDIT_PASSWORD
    });
    console.log('已同步到云端');
  } catch (e) {
    console.warn('上传 Supabase 失败:', e.message);
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
  const arrays = ['insPosts', 'wvsPosts', 'tmiItems', 'stageItems'];
  arrays.forEach(key => {
    if (Array.isArray(state[key])) {
      state[key].sort((a, b) => {
        const da = parseDate(a.date);
        const db = parseDate(b.date);
        return db - da; // 最新的在前
      });
    }
  });
  // records 按 createdAt
  if (Array.isArray(state.records)) {
    state.records.sort((a, b) => {
      const da = parseDate(a.createdAt);
      const db = parseDate(b.createdAt);
      return db - da;
    });
  }
}

function getItem(type, index) {
  if (!state[type]) return null;
  // about 是单个对象，不是数组
  if (!Array.isArray(state[type])) return state[type];
  return state[type][index] || null;
}

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

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Date': dateStr,
        'Authorization': `OSS ${OSS_CONFIG.accessKeyId}:${sigB64}`
      },
      body: file
    });
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
function renderInsPosts() {
  const feedList = document.getElementById('ins-feed-list');
  if (!feedList) return;

  feedList.innerHTML = state.insPosts.map((post, index) => {
    const imgs = post.images || [];
    const thumb = imgs.length ? imgs[0] : (post.image || '');
    const imgHtml = thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : '';
    const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
    return `
    <article class="card" data-type="insPosts" data-index="${index}">
      ${imgHtml}
      ${countHtml}
      <span class="post-label">Instagram</span>
      <div class="post-meta">${post.date || ''}</div>
      <h3>${post.title || post.detailText ? (post.detailText || '').slice(0, 30) + ((post.detailText || '').length > 30 ? '...' : '') : '新动态'}</h3>
    </article>
  `}).join('');
}

function renderWvsPosts() {
  const feedList = document.getElementById('wvs-feed-list');
  if (!feedList) return;

  feedList.innerHTML = state.wvsPosts.map((post, index) => {
    const imgs = post.images || [];
    const thumb = imgs.length ? imgs[0] : (post.image || '');
    const imgHtml = thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : '';
    const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
    return `
    <article class="card" data-type="wvsPosts" data-index="${index}">
      ${imgHtml}
      ${countHtml}
      <span class="post-label">Weverse</span>
      <div class="post-meta">${post.date || ''}</div>
      <h3>${post.title || post.detailText ? (post.detailText || '').slice(0, 30) + ((post.detailText || '').length > 30 ? '...' : '') : '新动态'}</h3>
    </article>
  `}).join('');
}

function renderTmi() {
  const tmiList = document.getElementById('tmi-list');
  if (!tmiList) return;

  tmiList.innerHTML = state.tmiItems.map((item, index) => {
    const imgs = item.images || [];
    const thumb = imgs.length ? imgs[0] : (item.image || '');
    const imgHtml = thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : '';
    const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
    return `
    <article class="card" data-type="tmiItems" data-index="${index}">
      ${imgHtml}
      ${countHtml}
      <span class="post-label">TMI</span>
      <div class="post-meta">${item.date || ''}</div>
      <h3>${item.title || item.text ? (item.text || '').slice(0, 30) + ((item.text || '').length > 30 ? '...' : '') : '新 TMI'}</h3>
    </article>
  `}).join('');
}

function renderStage() {
  const stageList = document.getElementById('stage-list');
  if (!stageList) return;

  stageList.innerHTML = state.stageItems.map((item, index) => {
    const imgs = item.images || [];
    const thumb = imgs.length ? imgs[0] : (item.image || '');
    const imgHtml = thumb ? `<img src="${thumb}" class="card-thumb" alt="" />` : '';
    const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
    return `
    <article class="timeline-item" data-type="stageItems" data-index="${index}">
      ${imgHtml}
      ${countHtml}
      <span class="timeline-date">${item.date || ''}</span>
      <h3>${item.title || item.text ? (item.text || '').slice(0, 30) + ((item.text || '').length > 30 ? '...' : '') : '新舞台'}</h3>
    </article>
  `}).join('');
}

function renderRecords() {
  const recordsList = document.getElementById('records-list');
  if (!recordsList) return;

  recordsList.innerHTML = state.records.map((item, index) => {
    const imgs = item.images || [];
    const thumb = imgs.length ? imgs[0] : (item.imageData || '');
    const imgHtml = thumb ? `<img src="${thumb}" alt="" />` : `<div class="record-placeholder">📷 添加照片</div>`;
    const countHtml = imgs.length > 1 ? `<span class="img-count">${imgs.length} 张图片</span>` : '';
    return `
    <article class="record-card" data-type="records" data-index="${index}">
      ${imgHtml}
      ${countHtml}
      <div class="record-body">
        <h3>${item.title || item.text ? (item.text || '').slice(0, 30) + ((item.text || '').length > 30 ? '...' : '') : '新的记录'}</h3>
        <div class="record-meta">${item.createdAt || ''}</div>
      </div>
    </article>
  `}).join('');
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
  });

  if (document.getElementById('detail-modal').classList.contains('active')) {
    renderModalContent();
    initCarousel();
  }
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
  const item = isCreate ? {} : (getItem(type, index) || {});
  const fields = FIELD_CONFIGS[type] || [];
  const label = TYPE_LABELS[type] || type;
  const images = item.images || [];

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

async function handleModalSave() {
  try {
    const { type, index, mode } = modalState;
    if (!type) return;

    const isCreate = mode === 'create';
    const fields = FIELD_CONFIGS[type] || [];
    const bodyEl = document.getElementById('modal-body');
    if (!bodyEl) return;

    const data = {};
    for (const field of fields) {
      if (field.type === 'files' || field.type === 'file') {
        const input = bodyEl.querySelector(`[data-field-key="${field.key}"]`);
        const files = input?.files;
        const existingArr = isCreate ? [] : [...(getItem(type, index)?.[field.key] || [])];
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

    if (isCreate) {
      if (type === 'records') {
        data.createdAt = new Date().toLocaleString('zh-CN');
      }
      state[type].unshift(data);
    } else {
      if (!Array.isArray(state[type])) {
        state[type] = { ...state[type], ...data };
      } else if (state[type][index] !== undefined) {
        state[type][index] = { ...state[type][index], ...data };
      }
    }

    // 立即写本地
    sortAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // 云端后台同步（不阻塞）
    uploadToSupabase().catch(() => {});
    renderAll();
    updateEditMode(editMode);
    closeModal();
  } catch (e) {
    alert('保存失败：' + e.message);
  }
}

function handleModalDelete() {
  const { type, index } = modalState;
  if (!type || index === null) return;

  if (!confirm('确定要删除这条内容吗？此操作不可撤销。')) return;

  if (state[type] && state[type][index] !== undefined) {
    state[type].splice(index, 1);
    saveState();
    renderAll();
    updateEditMode(editMode);
    closeModal();
  }
}

/* ===== 统一渲染 ===== */
function renderAll() {
  applyGlobalTexts();
  renderInsPosts();
  renderWvsPosts();
  renderTmi();
  renderStage();
  renderRecords();
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
function initPage() {
  loadState();
  renderAll();
  handleEditToggle();
  attachEvents();
  updateEditMode(false);
}

initPage();
