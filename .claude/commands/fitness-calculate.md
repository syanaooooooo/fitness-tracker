计算 food&fitness tracker 中所有未计算或 stale 的餐食三大营养素（蛋白质/碳水/脂肪），写回数据并同步云端。

## 步骤

### 1. 获取 tab 并读取待计算餐食

先用 mcp__Claude_in_Chrome__tabs_context_mcp 获取 tab ID，然后执行：

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

如果返回空数组，回复「所有餐食已计算完毕 ✓」并停止。

### 2. 计算每餐宏量营养素

用营养知识估算 P(蛋白质)/C(碳水)/F(脂肪)，单位克。

常用参考：
- 「一大口」固体≈30g，液体≈50ml；「一小口」≈15g
- 去皮鸡肉 100g → P31 C0 F2
- 鸡蛋 1个 → P6 C0 F5
- 纳豆 50g → P8 C5 F5
- 拿铁 200ml → P7 C10 F7
- 黑咖啡 → P0 C0 F0
- 白米饭 100g → P3 C26 F0
- 魔芋面 200g → P0 C3 F0
- 绿叶菜 100g → P2 C4 F0
- 牛奶 200ml → P6 C10 F7
- 豆腐 100g → P7 C2 F3
- 香蕉 100g → P1 C23 F0
- 95%黑巧克力 10g → P0 C1 F5
- 牛油果 100g → P2 C9 F15

### 3. 写回数据

每餐写入后立刻保存，最后统一推云端：

```javascript
const raw = localStorage.getItem('ft_v1');
const data = JSON.parse(raw);
const log = data.logs['YYYY-MM-DD'];

// 槽位映射：早餐b / 午餐l / 晚餐d / 零食加餐s
log.pb = P; log.cb = C; log.fb = F;  // 替换为对应槽位
log.pb_status = 'done';
log.pb_detail = JSON.stringify([
  {"name": "食物名 重量", "p": P, "c": C, "f": F}
]);

data.updated_at = new Date().toISOString();
localStorage.setItem('ft_v1', JSON.stringify(data));
Object.assign(S, data);
render();

// 推云端
window.sbClient.from('snapshots').update({ data }).eq('name', 'ft_main')
  .then(({error}) => console.log('cloud:', error || 'ok'));
```

### 4. 输出汇总

格式：
```
📅 4/14
早餐 ✓  鸡蛋x2 / 薯条 / 黑巧
  P13 / C9 / F24

全天合计：P__ / C__ / F__
目标：P120 / C160 / F55
```
