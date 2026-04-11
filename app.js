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
const CARB_GOAL    = 200
const FAT_GOAL     = 55

// ============================================================
// STATE
// ============================================================
let S = {
  tab: 'week',
  plan: [...DEFAULT_PLAN],
  logs: {},       // { 'YYYY-MM-DD': { done, duration, feel, pb/pl/pd, cb/cl/cd, fb/fl/fd, pb_text/pl_text/pd_text, energy, notes, freeNote } }
  weights: [],    // [{ date, v }]
  measures: [],   // [{ date, waist, hip }]
  startWeight: 76,
  targetWeight: 71,
  selected: null, // selected day index for tap-swap
}

function save() {
  const { tab, selected, ...data } = S
  localStorage.setItem('ft_v1', JSON.stringify(data))
}

function load() {
  try {
    const raw = localStorage.getItem('ft_v1')
    if (raw) Object.assign(S, JSON.parse(raw))
  } catch(_) {}
}

// ============================================================
// DATE UTILS
// ============================================================
function todayStr() {
  return new Date().toISOString().split('T')[0]
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
    return d.toISOString().split('T')[0]
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
  const idx    = todayDayIdx()
  const wt     = S.plan[idx]
  const w      = W[wt]
  const date   = todayStr()
  const log    = S.logs[date] || {}
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
        <div class="greeting">${greeting()}</div>
        <div class="today-date">${fmtDate(date)} · ${DAYS[idx]}</div>
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
        </div>

        <div class="today-col">
          <div class="card">
            <div class="card-label">三大营养素</div>
            <div class="macro-bars">
              <div class="macro-bar-row">
                <span class="macro-bar-label">蛋白质</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-p" style="width:${pctP}%"></div></div>
                <span class="macro-bar-nums">${totalP}<span class="muted">/${PROTEIN_GOAL}g</span></span>
              </div>
              <div class="macro-bar-row">
                <span class="macro-bar-label">碳水</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-c" style="width:${pctC}%"></div></div>
                <span class="macro-bar-nums">${totalC}<span class="muted">/${CARB_GOAL}g</span></span>
              </div>
              <div class="macro-bar-row">
                <span class="macro-bar-label">脂肪</span>
                <div class="macro-bar"><div class="macro-fill macro-fill-f" style="width:${pctF}%"></div></div>
                <span class="macro-bar-nums">${totalF}<span class="muted">/${FAT_GOAL}g</span></span>
              </div>
            </div>
            <div class="protein-meals">
              ${mealRow('早餐','pb_text',log.pb_text,log.pb,log.cb,log.fb,log.pb_detail)}
              ${mealRow('午餐','pl_text',log.pl_text,log.pl,log.cl,log.fl,log.pl_detail)}
              ${mealRow('晚餐','pd_text',log.pd_text,log.pd,log.cd,log.fd,log.pd_detail)}
              ${mealRow('加餐','ps_text',log.ps_text,log.ps,log.cs,log.fs,log.ps_detail)}
            </div>
            <div class="ref-toggle" id="refToggle">常见食物参考 ▾</div>
            <div class="ref-panel hidden" id="refPanel">
              <div class="ref-grid">
                ${[
                  ['鸡蛋 1个','6g'],['纳豆 50g','8g'],
                  ['三文鱼 100g','22g'],['牛肉 100g','26g'],
                  ['猪肉 100g','20g'],['鸡胸肉 100g','31g'],
                  ['希腊酸奶 150g','15g'],['蛋白粉 1勺','22g'],
                  ['豆腐 100g','8g'],['牛奶 200ml','6g'],
                ].map(([f,g]) => `<div class="ref-item"><span>${f}</span><b>${g}</b></div>`).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-label">今日备注 <span class="optional">可选</span></div>
            <textarea id="notes" placeholder="饮食细节、情绪、其他……">${log.notes||''}</textarea>
          </div>

          <button class="save-btn" id="saveBtn">保存打卡</button>
        </div>
      </div>
    </div>`
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function mealRow(label, textKey, textVal, pVal, cVal, fVal, detailJson) {
  // derive per-macro keys: 'pb_text'→pb/cb/fb, 'pl_text'→pl/cl/fl, 'pd_text'→pd/cd/fd, 'ps_text'→ps/cs/fs
  const slot = textKey[1] // 'b', 'l', 'd', 's'
  const detailKey = textKey.replace('_text', '_detail')

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
        <textarea class="meal-text" data-meal-text="${textKey}"
                  placeholder="吃了什么…" rows="2">${esc(textVal||'')}</textarea>
      </div>
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

      <div class="data-cols">
        <div class="card">
          <div class="card-label">体重 kg</div>
          <div class="input-row">
            <input id="weightInput" type="number" placeholder="今日体重" step="0.1" min="30" max="200">
            <button id="addWeight">记录</button>
          </div>
          ${renderWeightChart()}
        </div>

        <div class="card">
          <div class="card-label">围度 cm</div>
          <div class="input-row">
            <input id="waistInput" type="number" placeholder="腰围" step="0.5">
            <input id="hipInput"   type="number" placeholder="臀围" step="0.5">
            <button id="addMeasure">记录</button>
          </div>
          ${renderMeasureTable()}
        </div>
      </div>

      <div class="card backup-card">
        <div class="card-label">数据备份</div>
        <div class="backup-row">
          <button id="exportBtn" class="backup-btn">导出 JSON</button>
          <label class="backup-btn import-label" for="importFile">导入 JSON</label>
          <input type="file" id="importFile" accept=".json" style="display:none">
        </div>
        <p class="backup-hint">导入会覆盖当前所有数据，建议先导出备份</p>
      </div>
    </div>`
}

function renderWeightChart() {
  if (!S.weights.length) return '<div class="empty-state">开始记录体重，看到趋势变化</div>'
  const sorted = [...S.weights].sort((a,b)=>a.date.localeCompare(b.date)).slice(-16)
  const vals = sorted.map(w=>w.v)
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5
  const CW = 300, CH = 90
  const pts = sorted.map((w,i) => {
    const x = sorted.length<2 ? CW/2 : (i/(sorted.length-1))*CW
    const y = CH - ((w.v-lo)/(hi-lo))*CH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const circles = sorted.map((w,i) => {
    const x = sorted.length<2 ? CW/2 : (i/(sorted.length-1))*CW
    const y = CH - ((w.v-lo)/(hi-lo))*CH
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--green)"/>`
  }).join('')
  const last = sorted[sorted.length-1]
  return `
    <div class="weight-chart">
      <svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none">
        <polyline points="${pts}" fill="none" stroke="var(--green)" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
        ${circles}
      </svg>
      <div class="weight-latest">最新：${last.v} kg · ${fmtDate(last.date)}</div>
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
    `每日营养素目标：蛋白质120g / 碳水200g / 脂肪55g`,
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

  lines.push('', '【营养素摄入】目标：蛋白质120g / 碳水200g / 脂肪55g')
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
  const entries = Object.values(S.logs).filter(l => (l.pb||l.pl||l.pd))
  if (!entries.length) return 0
  return Math.round(entries.reduce((s,l)=>s+(l.pb||0)+(l.pl||0)+(l.pd||0), 0) / entries.length)
}

// ============================================================
// EVENTS
// ============================================================
function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => { S.tab = btn.dataset.tab; S.selected = null; render() })
  )
  if (S.tab === 'week')   bindWeek()
  if (S.tab === 'today')  bindToday()
  if (S.tab === 'data')   bindData()
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
  const date = todayStr()

  // Done buttons
  document.querySelectorAll('.done-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      getLog(date).done = btn.dataset.done; save(); render()
    })
  )

  // Feel buttons
  document.querySelectorAll('.feel-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      getLog(date).feel = btn.dataset.feel; save(); render()
    })
  )

  // Protein: number inputs — live bar update
  document.querySelectorAll('.meal-num').forEach(inp =>
    inp.addEventListener('input', () => {
      const log = getLog(date)
      log[inp.dataset.meal] = parseInt(inp.value) || 0
      const total = (log.pb||0)+(log.pl||0)+(log.pd||0)
      const pct   = Math.min(100, Math.round(total/PROTEIN_GOAL*100))
      const fill  = document.getElementById('proteinFill')
      const nums  = document.getElementById('proteinNums')
      if (fill) fill.style.width = pct + '%'
      if (nums) nums.innerHTML = `${total}g <span class="muted">/ ${PROTEIN_GOAL}g</span>`
    })
  )

  // Protein: text inputs — save description
  document.querySelectorAll('.meal-text').forEach(inp =>
    inp.addEventListener('input', () => {
      getLog(date)[inp.dataset.mealText] = inp.value
    })
  )

  // Estimate button
  document.getElementById('estimateBtn')?.addEventListener('click', () => {
    const log = S.logs[date] || {}
    const prompt = [
      '帮我估算今天每餐的蛋白质含量（g），只需给出每餐的克数数字：',
      `早餐：${log.pb_text || '未填写'}`,
      `午餐：${log.pl_text || '未填写'}`,
      `晚餐：${log.pd_text || '未填写'}`,
      '',
      '请按格式回复：早餐 Xg，午餐 Xg，晚餐 Xg，合计 Xg',
    ].join('\n')
    navigator.clipboard.writeText(prompt)
      .then(() => showToast('已复制，粘贴给 Claude ✓'))
      .catch(() => {
        const ta = document.createElement('textarea')
        ta.value = prompt; document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); ta.remove()
        showToast('已复制，粘贴给 Claude ✓')
      })
  })

  // Energy buttons
  document.querySelectorAll('.energy-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      getLog(date).energy = parseInt(btn.dataset.energy); save(); render()
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

  // Save button
  const saveBtn = document.getElementById('saveBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const log = getLog(date)
      const dur = document.getElementById('duration')
      const txt = document.getElementById('notes')
      document.querySelectorAll('.meal-num').forEach(inp => {
        log[inp.dataset.meal] = parseInt(inp.value) || 0
      })
      document.querySelectorAll('.meal-text').forEach(inp => {
        log[inp.dataset.mealText] = inp.value
      })
      if (dur) log.duration = parseInt(dur.value) || 0
      const cal = document.getElementById('calories')
      if (cal) log.calories = parseInt(cal.value) || 0
      if (txt) log.notes = txt.value
      const fn = document.getElementById('freeNote')
      if (fn) log.freeNote = fn.value
      save()
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
load()
render()
