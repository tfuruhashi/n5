-- ============================================================
-- Yappanese N5 判定テスト — 追加SQL（5回目）
--
--  super.html で学校を「停止／再開」した際に、
--  いつ・誰が変更したかを記録できるようにする。
--
--  既存の v_institutions ビューはこのファイルでは変更しない
--  （実物を確認していない状態で上書きすると壊す危険があるため）。
--  super.html 側は institutions テーブルを直接select して
--  結合する実装にしている。
-- ============================================================

alter table institutions
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by text;

-- 既存の管理者・運営者（authenticated）が読めることを確認する。
-- RLSポリシーで既に「自校のみ」「superは全校」等が設定済みのはずなので、
-- 新しい2カラムだけを理由に権限を追加する必要はない。
