// ============================================================
// api/check.js — 環境変数が読めているかだけを確認する診断用
//
//  値そのものは返さない。設定されているかと、長さだけを返す。
//  確認が終わったら削除してよい。
// ============================================================

export default function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  res.status(200).json({
    SUPABASE_URL: {
      設定: !!url,
      長さ: url ? url.length : 0,
      先頭: url ? url.slice(0, 20) : null,
      前後に空白: url ? (url !== url.trim()) : null,
    },
    SUPABASE_SERVICE_KEY: {
      設定: !!key,
      長さ: key ? key.length : 0,
      先頭: key ? key.slice(0, 8) : null,
      前後に空白: key ? (key !== key.trim()) : null,
    },
    // 似た名前で登録されていないか確認する
    SUPABASE系の環境変数名: Object.keys(process.env)
      .filter(k => k.toUpperCase().includes('SUPABASE')),
    node: process.version,
  });
}
