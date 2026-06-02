'use strict'

// ============================================================
// WORKOUT DEFINITIONS
// ============================================================
const W = {
  elliptical: { label: '椭圆机', tag: 'Zone 2', detail: '20分钟 · 100–110 bpm', icon: '◯', cls: 'w-green' },
  pt:         { label: '私教力量', tag: '', detail: '60分钟', icon: '◆', cls: 'w-dark' },
  yoga:       { label: '瑜伽拉伸', tag: '', detail: '20–30分钟', icon: '◇', cls: 'w-sage' },
  free:       { label: '自选', tag: '', detail: '散步 / 瑜伽 均可', icon: '∿', cls: 'w-muted' },
  rest:       { label: '休息', tag: '', detail: '', icon: '—', cls: 'w-none' },
}

const DAYS   = ['周一','周二','周三','周四','周五','周六','周日']
const DEFAULT_PLAN = ['elliptical','pt','yoga','pt','elliptical','free','rest']
const PROTEIN_GOAL = 120
const CARB_GOAL    = 160
const FAT_GOAL     = 55

// ============================================================
// STATE
// ============================================================
let S = {
  tab: 'week',
  plan: [...DEFAULT_PLAN],
  logs: {},       // { 'YYYY-MM-DD': { done, duration, calories, feel, pb/pl/pd/ps, cb/cl/cd/cs, fb/fl/fd/fs, pb_text/pl_text/pd_text/ps_text, pb_detail/..., energy, notes, freeNote } }
  weights: [],    // [{ date, v }]
  measures: [],   // [{ date, waist, hip }]
  startWeight: 76,
  targetWeight: 71,
  selected: null,  // selected day index for tap-swap
  viewDate: null,  // null = today; set to 'YYYY-MM-DD' when browsing past dates
}

function save() {
  const { selected, viewDate, ...data } = S
  data.updated_at = new Date().toISOString()
  S.updated_at = data.updated_at          // 同步更新内存，保证 sync 比较时不用 stale 值
  localStorage.setItem('ft_v1', JSON.stringify(data))
  if (typeof saveToCloud === 'function') {
    saveToCloud().catch(e => console.warn('云端同步失败:', e))
  }
}

function load() {
  try {
    const raw = localStorage.getItem('ft_v1')
    if (raw) Object.assign(S, JSON.parse(raw))
  } catch(_) {}
  // 恢复上次停留的 tab（单独存，不混入云端数据）
  try {
    const ui = JSON.parse(localStorage.getItem('ft_ui') || '{}')
    if (ui.tab) S.tab = ui.tab
  } catch(_) {}
}

// ============================================================
// DATE UTILS
// ============================================================
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayDayIdx() {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1  // 0=Mon…6=Sun
}

function weekDates() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getMonth()+1}/${d.getDate()}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 10) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  return '晚上好'
}

// ============================================================
// RENDER
// ============================================================
function render() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === S.tab)
  )
  const el = document.getElementById('content')
  if (S.tab === 'week')   el.innerHTML = renderWeek()
  if (S.tab === 'today')  el.innerHTML = renderToday()
  if (S.tab === 'data')   el.innerHTML = renderData()
  if (S.tab === 'report') el.innerHTML = renderReport()
  bindEvents()
}

// ── WEEK ─────────────────────────────────────────
function renderWeek() {
  const dates = weekDates()
  const todayIdx = todayDayIdx()

  const cards = S.plan.map((wt, i) => {
    const w = W[wt]
    const log = S.logs[dates[i]]
    const isDone    = log?.done === 'done'
    const isPartial = log?.done === 'partial'
    const isToday   = i === todayIdx
    const isSel     = S.selected === i

    return `
      <div class="day-card ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''}"
           data-day="${i}" draggable="true">
        <div class="day-label">${DAYS[i]}</div>
        <div class="day-date">${fmtDate(dates[i])}</div>
        <div class="workout-pill ${w.cls}">
          <div class="w-icon">${w.icon}</div>
          <div class="w-name">${w.label}</div>
          ${w.tag    ? `<div class="w-tag">${w.tag}</div>` : ''}
          ${w.detail ? `<div class="w-detail">${w.detail}</div>` : ''}
        </div>
        ${isDone    ? '<div class="done-badge">✓</div>' : ''}
        ${isPartial ? '<div class="done-badge partial">⋯</div>' : ''}
      </div>`
  }).join('')

  const typeButtons = Object.entries(W).map(([key, w]) => {
    const isCurrent = S.selected !== null && S.plan[S.selected] === key
    return `<button class="type-pick-btn ${w.cls} ${isCurrent ? 'is-current' : ''}"
      data-set-type="${key}">${w.icon} ${w.label}</button>`
  }).join('')

  const actionPanel = S.selected !== null ? `
    <div class="action-panel">
      <div class="action-panel-label">已选中 ${DAYS[S.selected]} · 更换内容</div>
      <div class="type-pick-row">${typeButtons}</div>
      <div class="action-panel-hint">或点击另一天完成交换</div>
    </div>` : ''

  return `
    <div class="view-week">
      <div class="view-header">
        <h2>本周计划</h2>
        <p class="hint">长按拖拽，或点击选中后更换内容 / 与另一天交换</p>
      </div>
      <div class="week-scroll">
        <div class="week-grid" id="weekGrid">${cards}</div>
      </div>
      ${actionPanel}
    </div>`
}

// ── FREE SUGGESTIONS ─────────────────────────────
function freeSuggestions() {
  const ptCount   = S.plan.filter(x => x === 'pt').length
  const cardioCount = S.plan.filter(x => x === 'elliptical').length
  const stretchCount = S.plan.filter(x => x === 'yoga').length
  const todayIdx  = todayDayIdx()
  const prevType  = todayIdx > 0 ? S.plan[todayIdx - 1] : null
  const nextType  = todayIdx < 6 ? S.plan[todayIdx + 1] : null
  const heavyNeighbor = prevType === 'pt' || nextType === 'pt'

  const all = [
    { label: '核心训练',    detail: '平板支撑 3×45s · 卷腹 3×15 · 侧平板 3×30s',    cond: ptCount >= 2 },
    { label: '臀腿哑铃',    detail: '深蹲 3×12 · 罗马尼亚硬拉 3×10 · 臀桥 3×15',    cond: ptCount >= 1 && cardioCount >= 1 },
    { label: '肩臂哑铃',    detail: '肩推 3×12 · 侧平举 3×15 · 弯举 3×12',           cond: ptCount >= 1 },
    { label: '额外有氧',    detail: '椭圆机 20 分钟 · 保持 100–110 bpm',              cond: cardioCount < 2 },
    { label: '主动恢复',    detail: '泡沫轴 10 分钟 · 全身拉伸 15 分钟',              cond: heavyNeighbor || ptCount >= 2 },
    { label: '快走',        detail: '户外或室内快走 30 分钟',                          cond: stretchCount >= 1 || cardioCount < 2 },
    { label: '瑜伽',        detail: '跟练视频 20–30 分钟，专注呼吸',                  cond: ptCount >= 2 && stretchCount === 0 },
  ]

  // pick up to 3 matching, fall back to first 3 if none match
  const matched = all.filter(s => s.cond)
  return (matched.length ? matched : all).slice(0, 3)
}

// ── TODAY ─────────────────────────────────────────
function renderToday() {
  const date    = S.viewDate || todayStr()
  const isToday = date === todayStr()
  const _d      = new Date(date + 'T12:00:00')
  const idx     = _d.getDay() === 0 ? 6 : _d.getDay() - 1
  const wt      = S.plan[idx]
  const w       = W[wt]
  const log     = S.logs[date] || {}
  const totalP = (log.pb||0) + (log.pl||0) + (log.pd||0) + (log.ps||0)
  const totalC = (log.cb||0) + (log.cl||0) + (log.cd||0) + (log.cs||0)
  const totalF = (log.fb||0) + (log.fl||0) + (log.fd||0) + (log.fs||0)
  const pctP   = Math.min(100, Math.round(totalP / PROTEIN_GOAL * 100))
  const pctC   = Math.min(100, Math.round(totalC / CARB_GOAL * 100))
  const pctF   = Math.min(100, Math.round(totalF / FAT_GOAL * 100))

  const checkinBlock = wt === 'rest' ? `
    <div class="card rest-note">
      <div class="rest-icon">—</div>
      <p>今天好好休息。<br>肌肉在休息时生长。</p>
    </div>
  ` : `
    <div class="card">
      <div class="card-label">训练打卡</div>
      <div class="done-buttons">
        <button class="done-btn ${log.done==='done'    ? 'active':''}" data-done="done">完成 ✓</button>
        <button class="done-btn ${log.done==='partial' ? 'active':''}" data-done="partial">部分 ⋯</button>
        <button class="done-btn ${log.done==='skip'    ? 'active':''}" data-done="skip">跳过 ×</button>
      </div>
      ${(log.done==='done'||log.done==='partial') ? `
        <div class="checkin-fields">
          <div class="field-row">
            <label>实际时长</label>
            <div class="input-with-unit">
              <input id="duration" type="number" value="${log.duration||''}" placeholder="分钟" min="1" max="180">
              <span class="unit">分钟</span>
            </div>
          </div>
          <div class="field-row">
            <label>卡路里消耗</label>
            <div class="input-with-unit">
              <input id="calories" type="number" value="${log.calories||''}" placeholder="0" min="0" max="2000">
              <span class="unit">kcal</span>
            </div>
          </div>
          <div class="field-row">
            <label>感受</label>
            <div class="feel-buttons">
              <button class="feel-btn ${log.feel==='easy'  ?'active':''}" data-feel="easy">轻松</button>
              <button class="feel-btn ${log.feel==='ok'    ?'active':''}" data-feel="ok">正常</button>
              <button class="feel-btn ${log.feel==='hard'  ?'active':''}" data-feel="hard">很累</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `

  const freeBlock = wt === 'free' ? (() => {
    const suggs = freeSuggestions()
    const chips = suggs.map(s =>
      `<button class="sugg-chip" data-sugg="${esc(s.label)}" data-detail="${esc(s.detail)}">${s.label}</button>`
    ).join('')
    return `
      <div class="sugg-section">
        <div class="sugg-label">今日建议</div>
        <div class="sugg-chips">${chips}</div>
        <div class="sugg-detail hidden" id="suggDetail"></div>
      </div>
      <div class="field-col" style="margin-top:12px">
        <label>今天做什么 <span class="optional">自定义</span></label>
        <textarea id="freeNote" placeholder="填写或点击上方建议…" style="min-height:60px">${esc(log.freeNote||'')}</textarea>
      </div>`
  })() : ''

  return `
    <div class="view-today">
      <div class="today-header">
        <div class="day-nav">
          <button class="day-nav-btn" id="prevDay">←</button>
          <div class="day-nav-center">
            <div class="greeting">${isToday ? greeting() : DAYS[idx]}</div>
            <div class="today-date">${fmtDate(date)} · ${DAYS[idx]}${isToday ? ' · 今日' : ''}</div>
          </div>
          <button class="day-nav-btn" id="nextDay"${isToday ? ' disabled' : ''}>→</button>
        </div>
      </div>

      <div class="today-cols">
        <div class="today-col">
          <div class="card">
            <div class="card-label">今日训练</div>
            <div class="workout-display ${w.cls}">
              <div class="w-icon-lg">${w.icon}</div>
              <div>
                <div class="w-name-lg">${w.label}</div>
                ${w.tag    ? `<div class="w-tag-lg">${w.tag}</div>` : ''}
                ${w.detail ? `<div class="w-detail-lg">${w.detail}</div>` : ''}
              </div>
            </div>
            ${freeBlock}
          </div>
          ${checkinBlock}
          <div class="card">
            <div class="card-label">今日能量</div>
            <div class="energy-buttons">
              ${[1,2,3,4,5].map(v=>`
                <button class="energy-btn ${log.energy===v?'active':''}" data-energy="${v}">${v}</button>
              `).join('')}
            </div>
            <div class="energy-labels"><span>很低</span><span>很高</span></div>
          </div>
          <div class="card">
            <div class="card-label">今日备注 <span class="optional">可选</span></div>
            <textarea id="notes" placeholder="饮食细节、情绪、其他……">${log.notes||''}</textarea>
          </div>
        </div>

        <div class="today-col">
          <div class="card">
            <div class="card-label">三大营养素</div>
            <div class="macro-bars">
              <div class="macro-bar-row">
                <span class="macro-bar-label">蛋白质</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-p" id="fillP" style="width:${pctP}%"></div></div>
                <span class="macro-bar-nums" id="numsP">${totalP}<span class="muted">/${PROTEIN_GOAL}g</span><span class="macro-pct"> · ${Math.round(totalP/PROTEIN_GOAL*100)}%</span></span>
              </div>
              <div class="macro-bar-row">
                <span class="macro-bar-label">碳水</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-c" id="fillC" style="width:${pctC}%"></div></div>
                <span class="macro-bar-nums" id="numsC">${totalC}<span class="muted">/${CARB_GOAL}g</span><span class="macro-pct"> · ${Math.round(totalC/CARB_GOAL*100)}%</span></span>
              </div>
              <div class="macro-bar-row">
                <span class="macro-bar-label">脂肪</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-f" id="fillF" style="width:${pctF}%"></div></div>
                <span class="macro-bar-nums" id="numsF">${totalF}<span class="muted">/${FAT_GOAL}g</span><span class="macro-pct"> · ${Math.round(totalF/FAT_GOAL*100)}%</span></span>
              </div>
            </div>
            <div class="protein-meals">
              ${mealRow('早餐','pb_text',log.pb_text,log.pb,log.cb,log.fb,log.pb_detail,log.pb_status)}
              ${mealRow('午餐','pl_text',log.pl_text,log.pl,log.cl,log.fl,log.pl_detail,log.pl_status)}
              ${mealRow('晚餐','pd_text',log.pd_text,log.pd,log.cd,log.fd,log.pd_detail,log.pd_status)}
              ${mealRow('加餐','ps_text',log.ps_text,log.ps,log.cs,log.fs,log.ps_detail,log.ps_status)}
            </div>
            <div class="ref-toggle" id="refToggle">常见食物参考 ▾</div>
            <div class="ref-panel hidden" id="refPanel">
              <table class="ref-table">
                <thead>
                  <tr>
                    <th>食物</th>
                    <th class="ref-hd-p">蛋白</th>
                    <th class="ref-hd-c">碳水</th>
                    <th class="ref-hd-f">脂肪</th>
                  </tr>
                </thead>
                <tbody>
                  ${[
                    // ── 蛋白质 ──
                    ['鸡蛋 1个',          6,  0,  5],
                    ['去皮鸡肉 100g',    31,  0,  2],
                    ['纳豆 50g',          8,  5,  5],
                    ['虾仁 100g',        18,  1,  1],
                    ['豆腐 100g',         7,  2,  3],
                    ['三文鱼 100g',      20,  0, 13],
                    // ── 主食 ──
                    ['白米饭 100g',       3, 26,  0],
                    ['魔芋面 200g',       0,  3,  0],
                    ['燕麦 30g',          3, 20,  2],
                    ['红薯 100g',         1, 24,  0],
                    // ── 蔬菜 ──
                    ['绿叶菜 100g',       2,  4,  0],
                    ['西兰花 100g',       3,  5,  0],
                    ['金针菇 100g',       3,  6,  0],
                    // ── 饮品乳品 ──
                    ['拿铁 200ml',        7, 10,  7],
                    ['牛奶 200ml',        6, 10,  7],
                    ['希腊酸奶 100g',     9,  4,  5],
                    // ── 零食脂肪 ──
                    ['牛油果 100g',       2,  9, 15],
                    ['95%黑巧克力 10g',   0,  1,  5],
                    ['坚果混合 30g',      5,  6, 16],
                    ['苏打饼干 25g',      2, 17,  4],
                  ].map(([f,p,c,fat]) => `
                    <tr>
                      <td>${f}</td>
                      <td class="ref-val-p">${p}g</td>
                      <td class="ref-val-c">${c}g</td>
                      <td class="ref-val-f">${fat}g</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <button class="save-btn" id="saveBtn">保存打卡</button>
        </div>
      </div>
    </div>`
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function mealRow(label, textKey, textVal, pVal, cVal, fVal, detailJson, status) {
  // derive per-macro keys: 'pb_text'→pb/cb/fb, 'pl_text'→pl/cl/fl, 'pd_text'→pd/cd/fd, 'ps_text'→ps/cs/fs
  const slot = textKey[1] // 'b', 'l', 'd', 's'
  const detailKey = textKey.replace('_text', '_detail')
  const statusKey = textKey.replace('_text', '_status')

  let statusBadge = ''
  if (status === 'pending') {
    statusBadge = `<span class="calc-status calc-pending" id="status-${statusKey}">⊙ 未计算</span>`
  } else if (status === 'done') {
    statusBadge = `<span class="calc-status calc-done" id="status-${statusKey}">✓ 已计算</span>`
  } else if (status === 'stale') {
    statusBadge = `<span class="calc-status calc-stale" id="status-${statusKey}">△ 待更新</span>`
  }

  let detailBlock = ''
  if (detailJson) {
    try {
      const rows = JSON.parse(detailJson)
      const rowsHtml = rows.map(r =>
        `<tr><td>${r.name}</td><td>${r.p}g</td><td>${r.c}g</td><td>${r.f}g</td></tr>`
      ).join('')
      detailBlock = `
        <div class="meal-detail-toggle" data-detail-key="${detailKey}">明细 ▾</div>
        <div class="meal-detail-panel hidden" id="detail-${detailKey}">
          <table class="detail-table">
            <thead><tr><th>食物</th><th>蛋白质</th><th>碳水</th><th>脂肪</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`
    } catch(e) {}
  }

  return `
    <div class="meal-row-block">
      <div class="meal-row-top">
        <span class="meal-label">${label}</span>
        <textarea class="meal-text" data-meal-text="${textKey}" data-status-key="${statusKey}"
                  placeholder="吃了什么…" rows="2">${esc(textVal||'')}</textarea>
      </div>
      ${statusBadge ? `<div class="meal-status-row">${statusBadge}</div>` : ''}
      <div class="meal-row-nums">
        <div class="meal-macro-input">
          <span class="macro-tag macro-tag-p">蛋白质</span>
          <input class="meal-num" data-meal="p${slot}" type="number"
                 value="${pVal||''}" placeholder="0" min="0" max="500">
          <span class="g-label">g</span>
        </div>
        <div class="meal-macro-input">
          <span class="macro-tag macro-tag-c">碳水</span>
          <input class="meal-num" data-meal="c${slot}" type="number"
                 value="${cVal||''}" placeholder="0" min="0" max="500">
          <span class="g-label">g</span>
        </div>
        <div class="meal-macro-input">
          <span class="macro-tag macro-tag-f">脂肪</span>
          <input class="meal-num" data-meal="f${slot}" type="number"
                 value="${fVal||''}" placeholder="0" min="0" max="300">
          <span class="g-label">g</span>
        </div>
      </div>
      ${detailBlock}
    </div>`
}

// ── DATA ──────────────────────────────────────────
function renderData() {
  return `
    <div class="view-data">
      <div class="view-header"><h2>数据</h2></div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val">${calcStreak()}</div>
          <div class="stat-label">连续打卡天</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${calcRate()}%</div>
          <div class="stat-label">本月完成率</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${calcAvgProtein()}g</div>
          <div class="stat-label">平均蛋白质</div>
        </div>
      </div>

      <!-- 体重 + 围度输入并排 -->
      <div class="card data-inputs-card">
        <div class="data-inputs-row">
          <div class="data-input-group">
            <span class="dil">体重</span>
            <input id="weightInput" type="number" placeholder="kg" step="0.1" min="30" max="200">
            <button id="addWeight">记录</button>
          </div>
          <div class="data-input-sep"></div>
          <div class="data-input-group">
            <span class="dil">围度</span>
            <input id="waistInput" type="number" placeholder="腰 cm" step="0.5">
            <input id="hipInput"   type="number" placeholder="臀 cm" step="0.5">
            <button id="addMeasure">记录</button>
          </div>
        </div>
      </div>

      <!-- 综合折线图 + 体重统计 -->
      <div class="card">
        ${renderCombinedChart()}
        ${renderWeightStats()}
      </div>

      <!-- 围度历史（有数据才显示） -->
      ${S.measures.length ? `<div class="card"><div class="card-label" style="margin-bottom:8px">围度记录</div>${renderMeasureTable()}</div>` : ''}

      <!-- 云端存档（含本地备份按钮） -->
      <div class="card cloud-card">
        <div class="cloud-card-hdr">
          <div class="card-label" style="margin:0">云端存档</div>
          <div class="cloud-hdr-actions">
            <button id="exportBtn" class="cs-btn-sm">↓ 导出</button>
            <label class="cs-btn-sm import-label" for="importFile" style="cursor:pointer">↑ 导入</label>
            <input type="file" id="importFile" accept=".json" style="display:none">
            <button id="forcePullBtn" class="cs-btn cs-btn-pull">强制拉取</button>
          </div>
        </div>
        <div class="cs-sync-bar" style="margin-top:6px">
          <span id="syncStatus" class="cs-sync-status"></span>
        </div>
        <div id="cloudSlots"><div class="cloud-loading">加载中…</div></div>
      </div>
    </div>`
}

// 三线综合折线图（体重 + 腰围 + 臀围），共享 X 时间轴，各自 Y 轴归一化
function renderCombinedChart() {
  const weights  = [...S.weights].sort((a,b)  => a.date.localeCompare(b.date)).slice(-20)
  const measures = [...S.measures].sort((a,b) => a.date.localeCompare(b.date)).slice(-20)
  const waists   = measures.map(m => ({ date: m.date, v: m.waist }))
  const hips     = measures.map(m => ({ date: m.date, v: m.hip }))
  const hasW = weights.length >= 1, hasM = measures.length >= 1
  if (!hasW && !hasM) return '<div class="empty-state">记录体重或围度后查看趋势</div>'

  const CW = 500, CH = 140, PAD = 0.07   // 上下各留 7% 内边距

  // 共享 X 轴（时间）
  const allDates = [...weights.map(w => w.date), ...measures.map(m => m.date)].sort()
  const minD = new Date(allDates[0]), maxD = new Date(allDates[allDates.length - 1])
  const spanMs = Math.max(86400000, maxD - minD)
  const toX = d => ((new Date(d) - minD) / spanMs) * CW

  // 单条线：独立 Y 轴归一化（各自 lo-hi 占满高度，留 PAD 内边距）
  function buildSeries(data, color) {
    if (!data.length) return null
    const vals = data.map(d => d.v)
    const lo = Math.min(...vals), hi = Math.max(...vals), range = (hi - lo) || 0.01
    const toY = v => CH * PAD + (1 - (v - lo) / range) * CH * (1 - PAD * 2)
    const pts  = data.map(d => `${toX(d.date).toFixed(1)},${toY(d.v).toFixed(1)}`).join(' ')
    const dots = data.map(d =>
      `<circle cx="${toX(d.date).toFixed(1)}" cy="${toY(d.v).toFixed(1)}" r="3" fill="${color}"/>`
    ).join('')
    return {
      poly: `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      dots, lo, hi, first: data[0], last: data[data.length - 1]
    }
  }

  const C = { w: 'var(--accent)', wa: '#b07040', h: '#7a5c8a' }
  const wS = buildSeries(weights, C.w)
  const waS = buildSeries(waists, C.wa)
  const hS  = buildSeries(hips, C.h)

  // Legend：● 体重 74.7kg ↓1.3  ● 腰围 80cm  ● 臀围 95cm
  function lgItem(s, label, unit, dec, color) {
    if (!s) return ''
    const cur  = s.last.v.toFixed(dec)
    const diff = s.last.v - s.first.v
    const dStr = Math.abs(diff) >= 0.05
      ? ` <span style="color:${diff < 0 ? color : '#c0392b'}">${diff < 0 ? '↓' : '↑'}${Math.abs(diff).toFixed(dec)}</span>`
      : ''
    return `<span class="ch-lg-item">
      <span class="ch-lg-dot" style="background:${color}"></span>
      ${label}&thinsp;<b>${cur}${unit}</b>${dStr}
    </span>`
  }
  const legend = [lgItem(wS,'体重','kg',1,C.w), lgItem(waS,'腰围','cm',0,C.wa), lgItem(hS,'臀围','cm',0,C.h)]
    .filter(Boolean).join('')

  // 网格线
  const grid = [0.15, 0.5, 0.85].map(t =>
    `<line x1="0" y1="${(CH*t).toFixed(1)}" x2="${CW}" y2="${(CH*t).toFixed(1)}" stroke="var(--bg2)" stroke-width="1"/>`
  ).join('')

  // Y 轴标尺（仅体重，左侧）— 用 HTML 避免 SVG 文字在 preserveAspectRatio:none 下变形
  const yAxisHtml = wS ? `
    <div class="ch-yaxis">
      <span>${wS.hi.toFixed(1)}</span>
      <span>${((wS.hi+wS.lo)/2).toFixed(1)}</span>
      <span>${wS.lo.toFixed(1)}</span>
    </div>` : '<div class="ch-yaxis"></div>'

  // X 轴日期
  const xAxis = allDates.length >= 2 && spanMs > 86400000 ? `
    <div class="ch-xaxis">
      <span>${fmtDate(allDates[0])}</span>
      <span>${fmtDate(allDates[allDates.length-1])}</span>
    </div>` : ''

  return `
    <div class="combined-chart">
      <div class="ch-legend">${legend}</div>
      <div class="ch-body">
        ${yAxisHtml}
        <svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none">
          ${grid}
          ${[wS,waS,hS].filter(Boolean).map(s=>s.poly).join('')}
          ${[wS,waS,hS].filter(Boolean).map(s=>s.dots).join('')}
        </svg>
      </div>
      ${xAxis}
    </div>`
}

// 体重下降速度统计（体重 ≥2 条才显示）
function renderWeightStats() {
  if (S.weights.length < 2) return ''
  const sorted = [...S.weights].sort((a,b) => a.date.localeCompare(b.date))
  const first = sorted[0], last = sorted[sorted.length-1]
  const prev  = sorted[sorted.length-2]  // 上一条记录
  const daysDiff    = (new Date(last.date) - new Date(first.date)) / 86400000
  const totalChange = first.v - last.v
  const weeklyRate  = daysDiff > 0 ? (totalChange / daysDiff * 7) : 0
  const toGoal      = last.v - S.targetWeight
  const changeSign  = totalChange >= 0 ? '↓' : '↑'
  const rateColor   = weeklyRate >= 0.3 && weeklyRate <= 1.2 ? 'var(--accent)' : '#c0392b'
  const etaWeeks    = weeklyRate > 0 ? (toGoal / weeklyRate).toFixed(1) : '—'

  // 距上次记录变化
  const recentDays   = (new Date(last.date) - new Date(prev.date)) / 86400000
  const recentChange = last.v - prev.v   // 正 = 涨，负 = 降
  const recentSign   = recentChange <= 0 ? '↓' : '↑'
  const recentColor  = recentChange <= 0 ? 'var(--accent)' : '#c0392b'
  const dailyChange  = recentDays > 0 ? recentChange / recentDays : 0
  const dailySign    = dailyChange <= 0 ? '↓' : '↑'
  const dailyColor   = dailyChange <= 0 ? 'var(--accent)' : '#c0392b'

  return `
    <div class="weight-stats">
      <div class="wstat">
        <span class="wstat-val">${changeSign}${Math.abs(totalChange).toFixed(1)} kg</span>
        <span class="wstat-label">共变化（${Math.round(daysDiff)}天）</span>
      </div>
      <div class="wstat">
        <span class="wstat-val" style="color:${rateColor}">${weeklyRate >= 0 ? weeklyRate.toFixed(2) : '+'+Math.abs(weeklyRate).toFixed(2)} kg/周</span>
        <span class="wstat-label">平均每周（建议 0.5–1.0）</span>
      </div>
      <div class="wstat">
        <span class="wstat-val">${toGoal > 0 ? toGoal.toFixed(1)+' kg' : '已达标 🎉'}</span>
        <span class="wstat-label">距目标 ${S.targetWeight} kg${toGoal > 0 && weeklyRate > 0 ? '（约'+etaWeeks+'周）' : ''}</span>
      </div>
      <div class="wstat">
        <span class="wstat-val" style="color:${recentColor}">${recentSign}${Math.abs(recentChange).toFixed(1)} kg</span>
        <span class="wstat-label">距上次（${Math.round(recentDays)}天前 ${prev.v.toFixed(1)}kg）</span>
      </div>
      <div class="wstat">
        <span class="wstat-val" style="color:${dailyColor}">${dailySign}${Math.abs(dailyChange).toFixed(2)} kg/天</span>
        <span class="wstat-label">近期日均变化</span>
      </div>
    </div>`
}

function renderMeasureTable() {
  if (!S.measures.length) return '<div class="empty-state">记录腰臀围变化</div>'
  const rows = [...S.measures].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6)
  return `
    <table class="measure-table">
      <thead><tr><th>日期</th><th>腰围</th><th>臀围</th></tr></thead>
      <tbody>
        ${rows.map(m=>`
          <tr>
            <td>${fmtDate(m.date)}</td>
            <td>${m.waist} cm</td>
            <td>${m.hip} cm</td>
          </tr>`).join('')}
      </tbody>
    </table>`
}

// ── REPORT ────────────────────────────────────────
function renderReport() {
  return `
    <div class="view-report">
      <div class="view-header"><h2>周报告</h2></div>
      <p class="report-intro">复制后粘贴给 Claude，获取本周评估和下周计划建议。</p>
      <div class="report-box"><pre id="reportText">${buildReport()}</pre></div>
      <button class="copy-btn" id="copyBtn">复制报告</button>
    </div>`
}

function buildReport() {
  const dates = weekDates()
  const feelMap = { easy:'轻松', ok:'正常', hard:'很累' }
  const lines = [
    '=== 本周减脂训练报告 ===',
    '',
    `基本信息：33岁，身高169cm，起始体重76kg，目标71kg`,
    `目标：减脂增肌（体重不变腰围缩小也算成功）`,
    `每日营养素目标：蛋白质${PROTEIN_GOAL}g / 碳水${CARB_GOAL}g / 脂肪${FAT_GOAL}g`,
    '',
    '【本周训练】',
  ]

  dates.forEach((date, i) => {
    const wt  = S.plan[i]
    const w   = W[wt]
    const log = S.logs[date] || {}
    const status =
      log.done==='done'    ? '✓ 完成' :
      log.done==='partial' ? '⋯ 部分' :
      log.done==='skip'    ? '× 跳过' : '— 未记录'
    const extra = (log.done==='done'||log.done==='partial') && log.duration
      ? `  ${log.duration}分钟 · 感受：${feelMap[log.feel]||'未填'}`
      : ''
    lines.push(`${DAYS[i]} ${fmtDate(date)}  ${w.label}  ${status}${extra}`)
  })

  lines.push('', `【营养素摄入】目标：蛋白质${PROTEIN_GOAL}g / 碳水${CARB_GOAL}g / 脂肪${FAT_GOAL}g`)
  let hasMacro = false
  dates.forEach((date, i) => {
    const log = S.logs[date]
    if (!log) return
    const tP = (log.pb||0)+(log.pl||0)+(log.pd||0)+(log.ps||0)
    const tC = (log.cb||0)+(log.cl||0)+(log.cd||0)+(log.cs||0)
    const tF = (log.fb||0)+(log.fl||0)+(log.fd||0)+(log.fs||0)
    const hasText = log.pb_text || log.pl_text || log.pd_text || log.ps_text
    if (!tP && !tC && !tF && !hasText) return
    hasMacro = true
    if (tP||tC||tF) lines.push(`${DAYS[i]}：蛋白质${tP}g / 碳水${tC}g / 脂肪${tF}g`)
    if (hasText) {
      if (log.pb_text) lines.push(`  早餐：${log.pb_text}`)
      if (log.pl_text) lines.push(`  午餐：${log.pl_text}`)
      if (log.pd_text) lines.push(`  晚餐：${log.pd_text}`)
      if (log.ps_text) lines.push(`  加餐：${log.ps_text}`)
    }
  })
  if (!hasMacro) lines.push('（本周暂无记录）')

  lines.push('', '【每日能量（1-5）】')
  let hasEnergy = false
  dates.forEach((date, i) => {
    const log = S.logs[date]
    if (log?.energy) { lines.push(`${DAYS[i]}：${log.energy}/5`); hasEnergy = true }
  })
  if (!hasEnergy) lines.push('（本周暂无记录）')

  if (S.weights.length) {
    const last = [...S.weights].sort((a,b)=>b.date.localeCompare(a.date))[0]
    lines.push('', `【最新体重】${last.v} kg（${fmtDate(last.date)}）`)
  }
  if (S.measures.length) {
    const last = [...S.measures].sort((a,b)=>b.date.localeCompare(a.date))[0]
    lines.push(`【最新围度】腰 ${last.waist}cm · 臀 ${last.hip}cm（${fmtDate(last.date)}）`)
  }

  const notes = dates.map((date,i) => {
    const n = S.logs[date]?.notes
    return n?.trim() ? `${DAYS[i]}：${n.trim()}` : null
  }).filter(Boolean)
  if (notes.length) { lines.push('', '【备注】', ...notes) }

  lines.push(
    '', '---',
    '请根据以上数据：',
    '1. 评估本周完成情况（训练、蛋白质、能量趋势）',
    '2. 给出饮食和训练方面的具体建议',
    '3. 如需调整，给出修改后的下周计划',
  )
  return lines.join('\n')
}

// ============================================================
// CALCULATIONS
// ============================================================
function calcStreak() {
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 90; i++) {
    const dateStr = d.toISOString().split('T')[0]
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
    const wt  = S.plan[idx]
    const log = S.logs[dateStr]
    if (wt === 'rest') { streak++; d.setDate(d.getDate()-1); continue }
    if (log?.done === 'done' || log?.done === 'partial') {
      streak++; d.setDate(d.getDate()-1)
    } else break
  }
  return streak
}

function calcRate() {
  const now = new Date()
  let done = 0, total = 0
  for (let day = 1; day <= now.getDate(); day++) {
    const dt  = new Date(now.getFullYear(), now.getMonth(), day)
    const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1
    if (S.plan[idx] === 'rest') continue
    total++
    const log = S.logs[dt.toISOString().split('T')[0]]
    if (log?.done === 'done' || log?.done === 'partial') done++
  }
  return total ? Math.round(done/total*100) : 0
}

function calcAvgProtein() {
  const entries = Object.values(S.logs).filter(l => (l.pb||l.pl||l.pd||l.ps))
  if (!entries.length) return 0
  return Math.round(entries.reduce((s,l)=>s+(l.pb||0)+(l.pl||0)+(l.pd||0)+(l.ps||0), 0) / entries.length)
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      S.tab = btn.dataset.tab; S.selected = null
      if (btn.dataset.tab !== 'today') S.viewDate = null  // 离开今日tab时重置到今天
      localStorage.setItem('ft_ui', JSON.stringify({tab: S.tab}))
      render()
    })
  )
  if (S.tab === 'week')   bindWeek()
  if (S.tab === 'today')  bindToday()
  if (S.tab === 'data')   { bindData(); bindCloud() }
  if (S.tab === 'report') bindReport()
}

// ── WEEK ─────────────────────────────────────────
let dragSrc = null

function bindWeek() {
  // Type picker buttons
  document.querySelectorAll('.type-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (S.selected === null) return
      S.plan[S.selected] = btn.dataset.setType
      S.selected = null; save(); render()
    })
  })

  document.querySelectorAll('.day-card').forEach(card => {
    // Tap-to-swap (works on all devices)
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.day)
      if (S.selected === null) {
        S.selected = idx; render()
      } else if (S.selected === idx) {
        S.selected = null; render()
      } else {
        const a = S.selected, b = idx;
        [S.plan[a], S.plan[b]] = [S.plan[b], S.plan[a]]
        S.selected = null; save(); render()
      }
    })

    // HTML5 drag-and-drop (desktop)
    card.addEventListener('dragstart', e => {
      dragSrc = parseInt(card.dataset.day)
      card.classList.add('dragging')
      e.dataTransfer.effectAllowed = 'move'
    })
    card.addEventListener('dragover', e => {
      e.preventDefault()
      document.querySelectorAll('.day-card').forEach(c=>c.classList.remove('drag-over'))
      card.classList.add('drag-over')
    })
    card.addEventListener('drop', e => {
      e.preventDefault()
      const tgt = parseInt(card.dataset.day)
      if (dragSrc !== null && dragSrc !== tgt) {
        [S.plan[dragSrc], S.plan[tgt]] = [S.plan[tgt], S.plan[dragSrc]]
        save(); render()
      }
    })
    card.addEventListener('dragend', () => {
      dragSrc = null
      document.querySelectorAll('.day-card').forEach(c=>c.classList.remove('dragging','drag-over'))
    })
  })
}

// ── TODAY ─────────────────────────────────────────
function bindToday() {
  const date = S.viewDate || todayStr()

  // 把当前 DOM 里未保存的输入值刷入 S，防止按钮触发 render() 时输入框被清空
  function flushInputs() {
    const log = getLog(date)
    const dur = document.getElementById('duration')
    const cal = document.getElementById('calories')
    const txt = document.getElementById('notes')
    const fn  = document.getElementById('freeNote')
    if (dur && dur.value !== '') log.duration = parseInt(dur.value) || 0
    if (cal && cal.value !== '') log.calories = parseInt(cal.value) || 0
    if (txt) log.notes = txt.value
    if (fn)  log.freeNote = fn.value
    document.querySelectorAll('.meal-num').forEach(inp => {
      log[inp.dataset.meal] = parseInt(inp.value) || 0
    })
    document.querySelectorAll('.meal-text').forEach(inp => {
      log[inp.dataset.mealText] = inp.value
    })
  }

  // Done buttons
  document.querySelectorAll('.done-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      flushInputs(); getLog(date).done = btn.dataset.done; save(); render()
    })
  )

  // Feel buttons
  document.querySelectorAll('.feel-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      flushInputs(); getLog(date).feel = btn.dataset.feel; save(); render()
    })
  )

  // Macro number inputs — live bar update for all 3
  document.querySelectorAll('.meal-num').forEach(inp =>
    inp.addEventListener('input', () => {
      const log = getLog(date)
      log[inp.dataset.meal] = parseInt(inp.value) || 0
      const tP = (log.pb||0)+(log.pl||0)+(log.pd||0)+(log.ps||0)
      const tC = (log.cb||0)+(log.cl||0)+(log.cd||0)+(log.cs||0)
      const tF = (log.fb||0)+(log.fl||0)+(log.fd||0)+(log.fs||0)
      const fillP = document.getElementById('fillP')
      const fillC = document.getElementById('fillC')
      const fillF = document.getElementById('fillF')
      const numsP = document.getElementById('numsP')
      const numsC = document.getElementById('numsC')
      const numsF = document.getElementById('numsF')
      if (fillP) fillP.style.width = Math.min(100, Math.round(tP/PROTEIN_GOAL*100)) + '%'
      if (fillC) fillC.style.width = Math.min(100, Math.round(tC/CARB_GOAL*100)) + '%'
      if (fillF) fillF.style.width = Math.min(100, Math.round(tF/FAT_GOAL*100)) + '%'
      if (numsP) numsP.innerHTML = `${tP}<span class="muted">/${PROTEIN_GOAL}g</span><span class="macro-pct"> · ${Math.round(tP/PROTEIN_GOAL*100)}%</span>`
      if (numsC) numsC.innerHTML = `${tC}<span class="muted">/${CARB_GOAL}g</span><span class="macro-pct"> · ${Math.round(tC/CARB_GOAL*100)}%</span>`
      if (numsF) numsF.innerHTML = `${tF}<span class="muted">/${FAT_GOAL}g</span><span class="macro-pct"> · ${Math.round(tF/FAT_GOAL*100)}%</span>`
    })
  )

  // Meal text inputs — save description + detect stale status
  document.querySelectorAll('.meal-text').forEach(inp =>
    inp.addEventListener('input', () => {
      const log = getLog(date)
      log[inp.dataset.mealText] = inp.value
      const sk = inp.dataset.statusKey
      if (log[sk] === 'done') {
        log[sk] = 'stale'
        const badge = document.getElementById('status-' + sk)
        if (badge) {
          badge.textContent = '△ 待更新'
          badge.className = 'calc-status calc-stale'
        }
      }
    })
  )

  // Energy buttons
  document.querySelectorAll('.energy-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      flushInputs(); getLog(date).energy = parseInt(btn.dataset.energy); save(); render()
    })
  )

  // Meal detail toggles
  document.querySelectorAll('.meal-detail-toggle').forEach(tog => {
    tog.addEventListener('click', () => {
      const key = tog.dataset.detailKey
      const panel = document.getElementById('detail-' + key)
      if (!panel) return
      const open = !panel.classList.contains('hidden')
      panel.classList.toggle('hidden', open)
      tog.textContent = open ? '明细 ▾' : '明细 ▴'
    })
  })

  // Suggestion chips
  document.querySelectorAll('.sugg-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const note = document.getElementById('freeNote')
      const detail = document.getElementById('suggDetail')
      if (note) note.value = chip.dataset.sugg
      if (detail) {
        detail.textContent = chip.dataset.detail
        detail.classList.remove('hidden')
      }
      document.querySelectorAll('.sugg-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
    })
  })

  // Reference toggle
  const toggle = document.getElementById('refToggle')
  const panel  = document.getElementById('refPanel')
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden')
      toggle.textContent = panel.classList.contains('hidden')
        ? '常见食物参考 ▾' : '常见食物参考 ▴'
    })
  }

  // Day navigation
  function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  document.getElementById('prevDay')?.addEventListener('click', () => {
    const cur = new Date((S.viewDate || todayStr()) + 'T12:00:00')
    cur.setDate(cur.getDate() - 1)
    S.viewDate = localDateStr(cur)
    render()
  })
  document.getElementById('nextDay')?.addEventListener('click', () => {
    const cur = new Date((S.viewDate || todayStr()) + 'T12:00:00')
    cur.setDate(cur.getDate() + 1)
    const next = localDateStr(cur)
    if (next <= todayStr()) { S.viewDate = next; render() }
  })

  // Save button
  const saveBtn = document.getElementById('saveBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      flushInputs()
      const log = getLog(date)   // flushInputs 已把 DOM 值写入 S，这里取引用用于 status 更新

      // 更新每餐计算状态
      ;[['b','pb'],['l','pl'],['d','pd'],['s','ps']].forEach(([slot, prefix]) => {
        const text = (log[`${prefix}_text`] || '').trim()
        const hasNums = (log[`p${slot}`]||0) + (log[`c${slot}`]||0) + (log[`f${slot}`]||0) > 0
        const cur = log[`${prefix}_status`]
        if (!text) {
          log[`${prefix}_status`] = null
        } else if (cur === 'stale') {
          // 文字改过但未重新计算，保持 stale
        } else if (hasNums) {
          log[`${prefix}_status`] = 'done'
        } else {
          log[`${prefix}_status`] = 'pending'
        }
      })

      save()
      render()
      showToast('已保存 ✓')
    })
  }
}

function getLog(date) {
  if (!S.logs[date]) S.logs[date] = {}
  return S.logs[date]
}

// ── DATA ──────────────────────────────────────────
function bindData() {
  const wInput = document.getElementById('weightInput')
  document.getElementById('addWeight')?.addEventListener('click', () => {
    const v = parseFloat(wInput?.value)
    if (!v || v < 30 || v > 200) return
    S.weights = S.weights.filter(w => w.date !== todayStr())
    S.weights.push({ date: todayStr(), v })
    save(); render()
  })

  const waist = document.getElementById('waistInput')
  const hip   = document.getElementById('hipInput')
  document.getElementById('addMeasure')?.addEventListener('click', () => {
    const w = parseFloat(waist?.value), h = parseFloat(hip?.value)
    if (!w || !h) return
    S.measures = S.measures.filter(m => m.date !== todayStr())
    S.measures.push({ date: todayStr(), waist: w, hip: h })
    save(); render()
  })

  // Export
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const { tab, selected, ...data } = S
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `fitness-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出 ✓')
  })

  // Import
  document.getElementById('importFile')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.plan || !Array.isArray(data.plan)) throw new Error()
        Object.assign(S, data)
        save(); render()
        showToast('数据已导入 ✓')
      } catch(_) {
        showToast('格式不正确，导入失败')
      }
    }
    reader.readAsText(file)
  })
}

// ── CLOUD ─────────────────────────────────────────
function fmtSnapshotTime(isoStr) {
  const d = new Date(isoStr)
  const now = new Date()
  const todayS = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const yest = new Date(now); yest.setDate(yest.getDate()-1)
  const yestS = `${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`
  const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  if (ds === todayS) return `今天 ${hm}`
  if (ds === yestS)  return `昨天 ${hm}`
  return `${d.getMonth()+1}月${d.getDate()}日 ${hm}`
}

function updateSyncStatus() {
  const el = document.getElementById('syncStatus')
  if (!el) return
  const ts = S.updated_at
  el.textContent = ts ? `本地: ${fmtSnapshotTime(ts)}` : '本地: 无记录'
}

async function bindCloud() {
  updateSyncStatus()

  // 强制拉取按钮
  const pullBtn = document.getElementById('forcePullBtn')
  if (pullBtn && !pullBtn._bound) {
    pullBtn._bound = true
    pullBtn.addEventListener('click', async () => {
      pullBtn.textContent = '拉取中…'; pullBtn.disabled = true
      try {
        const cloudData = await loadFromCloud()
        if (!cloudData) { showToast('云端暂无数据'); return }
        // 字段级 merge（云端优先）
        const mergedLogs = { ...(cloudData.logs||{}) }
        for (const [date, localLog] of Object.entries(S.logs||{})) {
          mergedLogs[date] = mergedLogs[date]
            ? mergeDayLog(localLog, mergedLogs[date])
            : localLog
        }
        const wMap = {}
        for (const w of [...(S.weights||[]), ...(cloudData.weights||[])]) wMap[w.date] = w
        const merged = { ...cloudData, logs: mergedLogs,
          weights: Object.values(wMap).sort((a,b)=>a.date.localeCompare(b.date)) }
        delete merged.selected; delete merged.viewDate; delete merged.meta
        Object.assign(S, merged)
        localStorage.setItem('ft_v1', JSON.stringify(merged))
        render(); showToast('已拉取云端并合并 ✓')
        updateSyncStatus()
      } catch(e) { showToast('拉取失败') }
      finally { pullBtn.textContent = '强制拉取云端'; pullBtn.disabled = false }
    })
  }

  const container = document.getElementById('cloudSlots')
  if (!container || typeof loadSnapshots !== 'function') return
  try {
    const snaps = await loadSnapshots()
    const slots    = [1,2,3].map(n => snaps.find(s => s.name === `ft_slot_${n}`) || null)
    const autos    = snaps.filter(s => s.name.startsWith('ft_auto_')).slice(0,3)
    const restores = snaps.filter(s => s.name.startsWith('ft_pre_restore_')).slice(0,3)
    // 各 section 独立计算最新 ID
    const newestSlotId    = slots.filter(Boolean).sort((a,b) => a.created_at < b.created_at ? 1 : -1)[0]?.id
    const newestAutoId    = autos[0]?.id
    const newestRestoreId = restores[0]?.id

    const slotHtml = slots.map((s, i) => `
      <div class="cs-slot">
        <div class="cs-slot-info">
          <span class="cs-slot-name">存档 ${i+1}</span>
          ${s ? `<span class="cs-slot-time">${fmtSnapshotTime(s.created_at)}</span>
                 <span class="cs-slot-meta">${s.data?.meta?.log_count||0} 条</span>
                 ${s.id===newestSlotId?'<span class="cs-badge">最新</span>':''}` : '<span class="cs-slot-empty">（空）</span>'}
        </div>
        <div class="cs-slot-btns">
          <button class="cs-btn cs-btn-cover" data-slot="${i+1}">覆盖</button>
          ${s ? `<button class="cs-btn cs-btn-restore" data-id="${s.id}">恢复</button>` : ''}
        </div>
      </div>`).join('')

    const autoHtml = autos.length ? autos.map(s => `
      <div class="cs-slot">
        <div class="cs-slot-info">
          <span class="cs-slot-time">${fmtSnapshotTime(s.created_at)}</span>
          <span class="cs-slot-meta">${s.data?.meta?.log_count||0} 条</span>
          ${s.id===newestAutoId?'<span class="cs-badge">最新</span>':''}
        </div>
        <button class="cs-btn cs-btn-restore" data-id="${s.id}">恢复</button>
      </div>`).join('') : '<div class="cs-empty">暂无自动快照</div>'

    const restoreHtml = restores.length ? restores.map(s => `
      <div class="cs-slot">
        <div class="cs-slot-info">
          <span class="cs-slot-time">${fmtSnapshotTime(s.created_at)}</span>
          <span class="cs-slot-meta">${s.data?.meta?.log_count||0} 条</span>
          ${s.id===newestRestoreId?'<span class="cs-badge">最新</span>':''}
        </div>
        <button class="cs-btn cs-btn-restore" data-id="${s.id}">恢复</button>
      </div>`).join('') : ''

    container.innerHTML = `
      <div class="cs-section">
        <div class="cs-label">手动存档 <span class="cs-hint">随时覆盖或恢复</span></div>
        ${slotHtml}
      </div>
      <div class="cs-section">
        <div class="cs-label">自动存档 <span class="cs-hint">每天首次打开，保留最近3个</span></div>
        ${autoHtml}
      </div>
      ${restoreHtml ? `<div class="cs-section">
        <div class="cs-label">恢复保护 <span class="cs-hint">每次恢复前自动备份，保留最近3条</span></div>
        ${restoreHtml}
      </div>` : ''}`

    // 覆盖按钮
    container.querySelectorAll('.cs-btn-cover').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = btn.dataset.slot
        btn.textContent = '保存中…'; btn.disabled = true
        try {
          await saveSnapshot(`ft_slot_${slot}`)
          showToast(`存档 ${slot} 已保存 ✓`)
          bindCloud()
        } catch(e) { showToast('保存失败'); btn.textContent = '覆盖'; btn.disabled = false }
      })
    })

    // 恢复按钮
    container.querySelectorAll('.cs-btn-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('恢复此存档？当前数据会自动备份到「恢复保护」。')) return
        btn.textContent = '恢复中…'; btn.disabled = true
        try {
          await restoreSnapshot(btn.dataset.id)
          render(); showToast('已恢复 ✓')
          bindCloud()
        } catch(e) { showToast('恢复失败'); btn.textContent = '恢复'; btn.disabled = false }
      })
    })
  } catch(e) {
    container.innerHTML = '<div class="cs-empty">云端连接失败</div>'
  }
}

// ── REPORT ────────────────────────────────────────
function bindReport() {
  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const text = document.getElementById('reportText')?.textContent
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => showToast('已复制 ✓'))
      .catch(() => {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        showToast('已复制 ✓')
      })
  })
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  document.getElementById('toast')?.remove()
  const t = document.createElement('div')
  t.id = 'toast'
  t.textContent = msg
  document.body.appendChild(t)
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')))
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300) }, 2200)
}

// ============================================================
// INIT
// ============================================================
load()   // 先从 localStorage 同步加载，保证 UI 立刻可用
render()

// 字段级 merge：两个 day log 合并
// 规则：非空优先；两边都有值时：status 取高 rank，text/notes 取 cloud（更新的来源），数值取 cloud
function mergeDayLog(local, cloud) {
  const STATUS_RANK = { done: 3, stale: 2, pending: 1 }
  const result = { ...cloud }
  for (const key of Object.keys(local)) {
    const lv = local[key], cv = cloud[key]
    // 本地为空/零 → 不覆盖云端
    if (lv === null || lv === undefined || lv === '' || lv === 0) continue
    // 云端为空/零 → 用本地填补
    if (cv === null || cv === undefined || cv === '' || cv === 0) { result[key] = lv; continue }
    // 两边都有值：
    if (key.endsWith('_status')) {
      // status 取更高 rank（done > stale > pending）
      result[key] = (STATUS_RANK[lv] || 0) > (STATUS_RANK[cv] || 0) ? lv : cv
    }
    // _text / notes / _detail / 数值：云端优先（cloud = 明确的 pull 来源，不用本地覆盖）
    // result[key] 已经是 cv，无需修改
  }
  return result
}

// 异步云端同步：字段级 merge，任何字段都不会因为对端为空而丢失
;(async () => {
  if (typeof loadFromCloud !== 'function') return
  try {
    const cloudData = await loadFromCloud()
    if (!cloudData) {
      if (typeof saveToCloud === 'function') saveToCloud().catch(()=>{})
    } else {
      // logs：所有日期取并集，同天做字段级 merge
      const mergedLogs = { ...(cloudData.logs || {}) }
      for (const [date, localLog] of Object.entries(S.logs || {})) {
        mergedLogs[date] = mergedLogs[date]
          ? mergeDayLog(localLog, mergedLogs[date])
          : localLog
      }

      // weights：去重合并
      const wMap = {}
      for (const w of [...(cloudData.weights||[]), ...(S.weights||[])]) wMap[w.date] = w
      const mergedWeights = Object.values(wMap).sort((a,b) => a.date.localeCompare(b.date))

      const localTs = S.updated_at ? new Date(S.updated_at).getTime() : 0
      const cloudTs = cloudData.updated_at ? new Date(cloudData.updated_at).getTime() : 0
      const mergedTs = Math.max(localTs, cloudTs)
        ? (cloudTs >= localTs ? cloudData.updated_at : S.updated_at)
        : new Date().toISOString()

      const merged = { ...cloudData, logs: mergedLogs, weights: mergedWeights, updated_at: mergedTs }
      delete merged.selected; delete merged.viewDate; delete merged.meta

      Object.assign(S, merged)
      localStorage.setItem('ft_v1', JSON.stringify(merged))
      render()
      showToast('已同步云端 ✓')

      if (localTs > cloudTs && typeof saveToCloud === 'function') saveToCloud().catch(()=>{})
    }
  } catch(e) {
    console.warn('云端加载失败:', e)
  }
  // 每日自动快照
  if (typeof autoSnapshot === 'function') {
    autoSnapshot().catch(e => console.warn('自动快照失败:', e))
  }
})()

// 切回 tab 时自动同步云端（防止手机/其他设备修改后桌面看不到）
let _lastSyncTime = Date.now()
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) return
  if (typeof loadFromCloud !== 'function') return
  const now = Date.now()
  if (now - _lastSyncTime < 30000) return  // 30秒内不重复拉
  _lastSyncTime = now
  try {
    const cloudData = await loadFromCloud()
    if (!cloudData) return
    const cloudTs = cloudData.updated_at ? new Date(cloudData.updated_at).getTime() : 0
    const localTs  = S.updated_at ? new Date(S.updated_at).getTime() : 0
    if (cloudTs <= localTs) return  // 云端没有更新，不需要合并
    const mergedLogs = { ...(cloudData.logs || {}) }
    for (const [date, localLog] of Object.entries(S.logs || {})) {
      mergedLogs[date] = mergedLogs[date] ? mergeDayLog(localLog, mergedLogs[date]) : localLog
    }
    const wMap = {}
    for (const w of [...(cloudData.weights||[]), ...(S.weights||[])]) wMap[w.date] = w
    const merged = { ...cloudData, logs: mergedLogs,
      weights: Object.values(wMap).sort((a,b) => a.date.localeCompare(b.date)) }
    delete merged.selected; delete merged.viewDate; delete merged.meta
    Object.assign(S, merged)
    localStorage.setItem('ft_v1', JSON.stringify(merged))
    render()
    showToast('已同步云端 ✓')
  } catch(e) {
    console.warn('切回同步失败:', e)
  }
})
