计算今天未计算的三大营养素（蛋白质、碳水、脂肪），并将结果写回 Supabase。

## 执行步骤

### 第1步：读取配置并拉取云端数据

读取 `/home/user/fitness-tracker/supabase-config.js` 获取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`，然后用 curl 拉取主数据：

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/snapshots?name=eq.ft_main&select=data" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

将返回的 JSON 保存到临时文件 `/tmp/ft_data.json`。

### 第2步：提取今天的日志

今天的日期（格式 YYYY-MM-DD）是执行命令时的当前日期。用 jq 提取 `.data.logs["YYYY-MM-DD"]` 中的各餐数据：

- 早餐 (breakfast): `pb_text`, `pb_status`, `pb`, `cb`, `fb`
- 午餐 (lunch):     `pl_text`, `pl_status`, `pl`, `cl`, `fl`
- 晚餐 (dinner):    `pd_text`, `pd_status`, `pd`, `cd`, `fd`
- 加餐 (snack):     `ps_text`, `ps_status`, `ps`, `cs`, `fs`

### 第3步：判断哪些餐需要计算

需要计算的餐 = status 为 `'pending'` 或 `'stale'`（有食物描述但营养素未填或已过时）。
status 为 `null` 表示这餐没有记录，跳过。
status 为 `'done'` 表示已计算，跳过。

### 第4步：根据食物描述估算三大营养素

对每顿需要计算的餐，根据 `*_text` 中描述的食物，用你的食物营养知识估算：
- 蛋白质 (protein, P) 克数
- 碳水化合物 (carbs, C) 克数
- 脂肪 (fat, F) 克数

估算原则：
- 结合食物名称、份量描述、烹饪方式综合判断
- 遇到不确定的食物，给出合理中间值并说明假设
- 数值取整数克

参考目标（全天）：蛋白质 120g / 碳水 160g / 脂肪 55g

### 第5步：将计算结果写回 Supabase

用 jq 更新 `/tmp/ft_data.json` 中对应字段，同时将对应餐的 status 改为 `'done'`，然后 PATCH 回云端：

```bash
# 更新本地 JSON（以早餐为例）
jq '.data.logs["YYYY-MM-DD"].pb = <P值> |
    .data.logs["YYYY-MM-DD"].cb = <C值> |
    .data.logs["YYYY-MM-DD"].fb = <F值> |
    .data.logs["YYYY-MM-DD"].pb_status = "done"' /tmp/ft_data.json > /tmp/ft_updated.json

# PATCH 回 Supabase（发送完整 data 字段）
curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/snapshots?name=eq.ft_main" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"data\": $(jq '.data' /tmp/ft_updated.json)}"
```

### 第6步：输出摘要报告

完成后输出今日三大营养素汇总：

```
📅 YYYY-MM-DD 营养素计算结果
─────────────────────────────
早餐  P __g  C __g  F __g   [已计算 / 跳过]
午餐  P __g  C __g  F __g   [已计算 / 跳过]
晚餐  P __g  C __g  F __g   [已计算 / 跳过]
加餐  P __g  C __g  F __g   [已计算 / 跳过]
─────────────────────────────
合计  P __g/120g  C __g/160g  F __g/55g
```

如果某个估算有较大不确定性，在报告末尾注明假设。
