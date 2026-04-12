// Supabase 配置
// anon key 设计上就是公开的，安全靠密码哈希 + RLS，不靠 key 保密
const SUPABASE_URL = 'https://uiaaotpohbxrwwgpnpie.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XQ2Yrj0wi_BAaMBtlNeSDg_OW4mv5J8';

// 使用 sbClient 命名，避免与 window.supabase（CDN module 对象）冲突
window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
