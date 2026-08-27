// ============================================================
// Yappanese N5 判定テスト — 接続設定
//
//  この2つの値はブラウザに公開される前提のもの。
//  アクセス制御は Supabase の RLS（Row Level Security）で行っており、
//  ログインした職員は自分の所属機関のデータしか取得できない。
//
//  service_role キーは絶対にここに書かないこと。
//  RLS を無視するため、漏れると全データにアクセスできてしまう。
// ============================================================

const SUPABASE_URL = 'https://jhfcmqprgfypgzoheygm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5XhuawOopWVBEDWuUhAkbg_v8sIwQ8j';

const TOOL_NAME = 'Yappanese N5 判定テスト v1.0';
const PASS_MARK = 5;
const TOTAL_Q = 10;

// ---- REST 呼び出しの薄いラッパー ----
// 外部ライブラリを使わず fetch だけで動かす
const db = {
  _h(token, extra = {}) {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + (token || SUPABASE_KEY),
      'Content-Type': 'application/json',
      ...extra,
    };
  },

  // 取得
  async select(table, query = '', token = null) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,
      { headers: this._h(token) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // 登録（作成した行を返す）
  async insert(table, rows, token = null) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this._h(token, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  // ログイン
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || 'ログインできません');
    return d;   // access_token, refresh_token, user
  },

  // ログイン中のユーザー
  async me(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: this._h(token),
    });
    if (!r.ok) return null;
    return r.json();
  },
};

// ---- セッションの保存 ----
const session = {
  save(d) {
    localStorage.setItem('yp_session', JSON.stringify({
      token: d.access_token,
      email: d.user?.email,
      at: Date.now(),
    }));
  },
  get() {
    try {
      const s = JSON.parse(localStorage.getItem('yp_session'));
      // 1時間で失効させる（アクセストークンの有効期限に合わせる）
      if (!s || Date.now() - s.at > 3600 * 1000) return null;
      return s;
    } catch { return null; }
  },
  clear() { localStorage.removeItem('yp_session'); },
};
