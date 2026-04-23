分析 food&fitness tracker 近 14 天的运动、睡眠、饮食数据，给出个性化建议。

## 步骤

### 1. 获取 tab 并读取数据

先用 mcp__Claude_in_Chrome__tabs_context_mcp 获取 tab ID，若无 fitness tracker 标签页则用 mcp__Claude_in_Chrome__navigate 导航到 https://syanaooooooo.github.io/fitness-tracker/，然后执行：

```javascript
const data = JSON.parse(localStorage.getItem('ft_v1'));
const dates = Object.keys(data.logs || {}).sort().slice(-14);
const summary = dates.map(d => {
  const l = data.logs[d];
  return {
    date: d,
    energy: l.energy,
    feel: l.feel,
    notes: l.notes,
    workout_notes: l.workout_notes,
    duration: l.duration,
    calories: l.calories,
    done: l.done,
    P: (l.pb||0)+(l.pl||0)+(l.pd||0)+(l.ps||0),
    C: (l.cb||0)+(l.cl||0)+(l.cd||0)+(l.cs||0),
    F: (l.fb||0)+(l.fl||0)+(l.fd||0)+(l.fs||0),
    meals: { b: l.pb_text, l: l.pl_text, d: l.pd_text, s: l.ps_text },
    sleep: l.sleep,
    sleep_notes: l.sleep_notes,
    weight: l.weight
  };
});
JSON.stringify(summary)
```

### 2. 深度分析

目标参考：P120 / C160 / F55（克）

从以下维度逐项分析，有数据才写，没有就跳过：

**宏量营养素趋势**
- 统计有效记录天数里 P/C/F 的均值，与目标对比
- 找出哪个营养素最容易超标/不足
- 定位超标的常见食物来源（如早餐高脂组合、牛油果、油脂鱼）

**睡眠质量**
- 从 notes 里提取睡眠相关描述（疲惫/自然醒/被憋醒/没睡好等）
- 找规律：什么情况下睡得好/差

**运动模式**
- 统计运动天数、类型、时长
- 结合 energy/feel 评分分析运动强度是否合适
- 训练后恢复情况

**能量水平**
- energy 评分趋势（1-5分）
- 与睡眠、碳水摄入、运动强度的关联

### 3. 输出格式

```
📊 近期综合报告（X/X – X/X，共N天有效记录）

🥗 营养
• [具体问题 + 根源食物 + 改进建议]

😴 睡眠  
• [规律 + 改进建议]

🏃 运动
• [强度评估 + 恢复建议]

⚡ 能量
• [趋势 + 关联因素]

🎯 本周重点改善：[1-2条最重要的行动项]
```

建议要具体（"有油脂鱼/红肉的日子早餐减到1个鸡蛋"），不要泛泛而谈。
