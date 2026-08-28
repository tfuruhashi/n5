// ============================================================
// api/invite.js — 招待の処理（Vercel の Serverless Function）
//
//  Supabase の service_role キーを使う。
//  このキーは RLS を無視するため、ブラウザには絶対に置けない。
//  Vercel の環境変数に置き、このファイルからのみ参照する。
//
//  呼び出し元は必ずログイン済みであることを確認し、
//  さらに「super か、同じ機関の管理者か」を検証してから実行する。
// ============================================================

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;

// service_role で叩く（RLS を無視するため、権限確認は必ず自前で行う）
async function admin(path, opt = {}) {
  const r = await fetch(URL + path, {
    ...opt,
    headers: {
      apikey: SERVICE,
      Authorization: 'Bearer ' + SERVICE,
      'Content-Type': 'application/json',
      ...(opt.headers || {}),
    },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
  return body;
}

// 呼び出し元のトークンからユーザーを特定する
async function whoami(token) {
  const r = await fetch(URL + '/auth/v1/user', {
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return null;
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST のみ' });
  }
  if (!URL || !SERVICE) {
    return res.status(500).json({
      error: '環境変数 SUPABASE_URL / SUPABASE_SERVICE_KEY が設定されていません',
    });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'ログインが必要です' });

  const me = await whoami(token);
  if (!me?.id) return res.status(401).json({ error: 'ログインが無効です' });

  // 呼び出し元の権限を確認
  const rows = await admin(
    `/rest/v1/staff?select=institution_id,role&user_id=eq.${me.id}`);
  const mine = rows?.[0];
  if (!mine) return res.status(403).json({ error: '所属機関が設定されていません' });

  const isSuper = mine.role === 'super';
  const isAdmin = mine.role === 'admin' || isSuper;

  const { action } = req.body || {};

  try {
    // --------------------------------------------------------
    // 学校を新規に作り、担当者を招待する（super のみ）
    // --------------------------------------------------------
    if (action === 'create_institution') {
      if (!isSuper) return res.status(403).json({ error: '権限がありません' });

      const { name, address, email, staff_name, note } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: '学校名が必要です' });
      if (!email?.trim()) return res.status(400).json({ error: 'メールアドレスが必要です' });

      // 機関コードを自動発行
      const code = await admin('/rest/v1/rpc/gen_code', {
        method: 'POST', body: JSON.stringify({}),
      });

      const inst = (await admin('/rest/v1/institutions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: name.trim(), address: address?.trim() || null,
          code, contact_email: email.trim(), note: note?.trim() || null,
          status: 'active',
        }),
      }))[0];

      const invited = await invite(email.trim(), inst.id, staff_name, 'admin', me.id, req);
      return res.status(200).json({ institution: inst, ...invited });
    }

    // --------------------------------------------------------
    // 同じ機関に担当者を招待する（admin 以上）
    // --------------------------------------------------------
    if (action === 'invite_staff') {
      if (!isAdmin) return res.status(403).json({ error: '権限がありません' });

      const { email, staff_name, role } = req.body;
      if (!email?.trim()) return res.status(400).json({ error: 'メールアドレスが必要です' });

      // super は機関を指定できる。それ以外は自分の機関のみ
      const instId = (isSuper && req.body.institution_id)
        ? req.body.institution_id : mine.institution_id;

      const r2 = (role === 'admin') ? 'admin' : 'staff';
      const invited = await invite(email.trim(), instId, staff_name, r2, me.id, req);
      return res.status(200).json(invited);
    }

    // --------------------------------------------------------
    // 招待をやり直す
    // --------------------------------------------------------
    if (action === 'resend') {
      if (!isAdmin) return res.status(403).json({ error: '権限がありません' });
      const { email } = req.body;
      await admin('/auth/v1/invite', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), redirect_to: origin(req) + '/invite.html' }),
      });
      return res.status(200).json({ ok: true, resent: true });
    }

    return res.status(400).json({ error: '不明な操作です' });

  } catch (e) {
    return res.status(400).json({ error: String(e.message || e).slice(0, 400) });
  }
}

function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

// 招待メールを送り、staff テーブルに紐づける
async function invite(email, institutionId, name, role, byUser, req) {
  let user = null;
  let alreadyExisted = false;

  try {
    user = await admin('/auth/v1/invite', {
      method: 'POST',
      body: JSON.stringify({
        email,
        redirect_to: origin(req) + '/invite.html',
      }),
    });
  } catch (e) {
    // すでに登録済みのメールアドレスの場合は、既存ユーザーを探して紐づける
    const msg = String(e.message || '');
    if (!/already|registered|exists/i.test(msg)) throw e;
    alreadyExisted = true;
    const list = await admin(
      `/auth/v1/admin/users?filter=${encodeURIComponent(email)}`);
    user = (list.users || []).find(
      u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('既存ユーザーを特定できませんでした');
  }

  // staff に登録（すでにあれば更新）
  await admin('/rest/v1/staff', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user.id,
      institution_id: institutionId,
      name: name?.trim() || null,
      role,
      email,
      invited_by: byUser,
      invited_at: new Date().toISOString(),
    }),
  });

  return { ok: true, user_id: user.id, email, already_existed: alreadyExisted };
}
