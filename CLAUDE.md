# food&fitness tracker 开发规则

## 项目信息
- **本地路径**：`/Users/o/Desktop/code/fitness-tracker/`
- **GitHub Pages**：`https://syanaooooooo.github.io/fitness-tracker/`
- **工作分支**：`main`（直接推 main，自动部署）
- **本地服务器**：`python3 -m http.server 8890`
- **push 惯例**：`git add -A && git commit -m "..." && git push origin main`
- **CSS 缓存**：改 style.css 时 index.html 里的 `?v=N` 要加一
- **JS 缓存**：改 app.js/sync.js 时对应 `?v=N` 也要加一

## 沟通方式
- 所有讨论用中文；代码注释、commit message 可中英混用
- 先 scope 后动手；改动前确认；不过度开发

## 云端架构
- Supabase 项目同 baby-food-tracker 共用
- 主数据：`snapshots` 表，`name='ft_main'`（不用 app_data，有 single_row 约束）
- 快照：`snapshots` 表，`ft_slot_1/2/3`、`ft_auto_YYYY-MM-DD`、`ft_pre_restore_*`
- localStorage key：`ft_v1`
- 同步策略：字段级 merge，非空优先

## /fitness-calculate 指令

当用户说 `/fitness-calculate`、`计算未计算的`、`更新计算`、`帮我算` 时，执行以下流程：

### 1. 读取待计算餐食
用 `mcp__Claude_in_Chrome__javascript_tool` 在 fitness tracker tab 执行：
```javascript
const data = JSON.parse(localStorage.getItem('ft_v1'));
const pending = [];
for (const [date, log] of Object.entries(data.logs || {})) {
  for (const meal of ['b','l','d','s']) {
    const status = log[`p${meal}_status`];
    const text = log[`p${meal}_text`];
    if (text && text.trim() && (status === 'pending' || status === 'stale' || !status)) {
      pending.push({ date, meal, text, p: log[`p${meal}`]||0, c: log[`c${meal}`]||0, f: log[`f${meal}`]||0 });
    }
  }
}
JSON.stringify(pending)
```
若无待计算，回复「所有餐食已计算完毕 ✓」。

### 2. 计算每餐宏量营养素
用营养知识估算蛋白质(P)/碳水(C)/脂肪(F)，单位克。

常用换算：
- 「一大口」固体 ≈ 30g，液体 ≈ 50ml
- 「一小口」固体 ≈ 15g
- 「几小块」3块 ≈ 30g，5块 ≈ 50g
- 去皮鸡肉 100g → P31 C0 F2
- 鸡蛋 1个 → P6 C0 F5
- 纳豆 50g → P8 C5 F5
- 拿铁 200ml → P7 C10 F7
- 白米饭 100g → P3 C26 F0
- 魔芋面 200g → P0 C3 F0
- 牛奶 200ml → P6 C10 F7

### 3. 写回数据
```javascript
const raw = localStorage.getItem('ft_v1');
const data = JSON.parse(raw);
const log = data.logs['YYYY-MM-DD'];
// 早b / 午l / 晚d / 零食s
log.pb = P; log.cb = C; log.fb = F;
log.pb_status = 'done';
log.pb_detail = JSON.stringify([{"name":"食物 重量","p":P,"c":C,"f":F}]);
data.updated_at = new Date().toISOString();
localStorage.setItem('ft_v1', JSON.stringify(data));
Object.assign(S, data);
render();
window.sbClient.from('snapshots').update({ data }).eq('name','ft_main')
  .then(({error}) => console.log('cloud:', error||'ok'));
```

### 4. 输出汇总
每餐简洁列出各食物和合计，最后显示全天总计 vs 目标（P120/C160/F55）。
