// sync.js — 减脂计划云端数据读写
// 复用 baby-food-tracker 的 Supabase 实例，app_data 表 id=2

// ─── 从云端加载 ────────────────────────────────────────────────
async function loadFromCloud() {
  const { data, error } = await window.sbClient
    .from('app_data')
    .select('baby_info')
    .eq('id', 2)
    .maybeSingle();

  if (error) {
    console.warn('云端加载错误:', error.message);
    return null;
  }
  return data?.baby_info || null;
}

// ─── 保存到云端 ────────────────────────────────────────────────
async function saveToCloud() {
  const raw = localStorage.getItem('ft_v1');
  if (!raw) return;

  const { error } = await window.sbClient
    .from('app_data')
    .upsert({
      id: 2,
      baby_info: JSON.parse(raw),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.warn('云端保存失败:', error.message);
  }
}
