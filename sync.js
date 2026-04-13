// sync.js — 减脂计划云端数据读写 + 快照备份
// 主数据：snapshots 表，name='ft_main'
// 快照：  snapshots 表，所有其他 key 以 ft_ 开头

// ─── 从云端加载主数据 ──────────────────────────────────────────
async function loadFromCloud() {
  const { data, error } = await window.sbClient
    .from('snapshots')
    .select('data')
    .eq('name', 'ft_main')
    .maybeSingle()
  if (error) { console.warn('云端加载错误:', error.message); return null }
  return data?.data || null
}

// ─── 保存主数据到云端 ──────────────────────────────────────────
async function saveToCloud() {
  const raw = localStorage.getItem('ft_v1')
  if (!raw) return
  const payload = JSON.parse(raw)
  // 先尝试 update，不存在则 insert
  const { data: existing } = await window.sbClient
    .from('snapshots').select('id').eq('name', 'ft_main').maybeSingle()
  if (existing) {
    const { error } = await window.sbClient
      .from('snapshots').update({ data: payload }).eq('name', 'ft_main')
    if (error) console.warn('云端保存失败:', error.message)
  } else {
    const { error } = await window.sbClient
      .from('snapshots').insert({ name: 'ft_main', data: payload })
    if (error) console.warn('云端保存失败:', error.message)
  }
}

// ─── 快照：构建数据包 ──────────────────────────────────────────
function buildSnapshotData() {
  const raw = localStorage.getItem('ft_v1')
  const data = raw ? JSON.parse(raw) : {}
  const logCount = Object.keys(data.logs || {}).length
  return { ...data, meta: { log_count: logCount, saved_at: new Date().toISOString() } }
}

// ─── 快照：保存 ───────────────────────────────────────────────
// name 规则：ft_slot_1/2/3 | ft_auto_YYYY-MM-DD | ft_pre_restore_<ISO>
async function saveSnapshot(name) {
  const data = buildSnapshotData()
  if (name.startsWith('ft_slot_')) {
    await window.sbClient.from('snapshots').delete().eq('name', name)
  }
  const { error } = await window.sbClient.from('snapshots').insert({ name, data })
  if (error) throw new Error('快照保存失败: ' + error.message)
}

// ─── 快照：加载所有 ft_ 快照（排除 ft_main）──────────────────
async function loadSnapshots() {
  const { data, error } = await window.sbClient
    .from('snapshots')
    .select('id, name, data, created_at')
    .like('name', 'ft_%')
    .neq('name', 'ft_main')
    .order('created_at', { ascending: false })
  if (error) { console.warn('快照加载失败:', error.message); return [] }
  return data || []
}

// ─── 快照：恢复 ───────────────────────────────────────────────
async function restoreSnapshot(id) {
  await saveSnapshot('ft_pre_restore_' + new Date().toISOString())
  const { data, error } = await window.sbClient
    .from('snapshots').select('data').eq('id', id).single()
  if (error || !data) throw new Error('快照不存在')
  const { meta, ...stateData } = data.data
  Object.assign(S, stateData)
  localStorage.setItem('ft_v1', JSON.stringify(stateData))
  await saveToCloud()
}

// ─── 快照：每日自动快照 ────────────────────────────────────────
async function autoSnapshot() {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const autoName = 'ft_auto_' + today

  const { data } = await window.sbClient
    .from('snapshots').select('id').eq('name', autoName).maybeSingle()
  if (!data) await saveSnapshot(autoName)

  // 保留最近3个自动快照
  const { data: autoSnaps } = await window.sbClient
    .from('snapshots').select('id').like('name', 'ft_auto_%')
    .order('created_at', { ascending: false })
  if (autoSnaps && autoSnaps.length > 3) {
    const toDelete = autoSnaps.slice(3).map(r => r.id)
    await window.sbClient.from('snapshots').delete().in('id', toDelete)
  }
}
