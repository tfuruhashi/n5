-- ============================================================
-- Yappanese N5 判定テスト — 追加SQL（3回目）
--
--  受験者はログインしない。学校から渡されたコードだけで受験する。
--  そのため RLS を通さずに「コードの照会」と「結果の登録」を行う
--  専用の関数を作り、その関数だけを外部から呼べるようにする。
--
--  security definer にすることで、関数の中では RLS を回避できる。
--  ただし関数は「コードが一致する機関」しか扱わないため、
--  他校のデータには触れられない。
-- ============================================================

-- ① 機関コードから学校を引く（名前とIDだけ返す。住所等は返さない）
create or replace function find_institution(p_code text)
returns table (id uuid, name text, code text)
language sql security definer stable as $$
  select i.id, i.name, i.code
  from institutions i
  where upper(i.code) = upper(trim(p_code))
  limit 1
$$;

-- ② 受験結果を登録する
--    同じ機関・同じ名前の受験者がいれば再利用し、なければ作る
create or replace function submit_result(
  p_code        text,
  p_name        text,
  p_tool        text,
  p_total       int,
  p_correct     int,
  p_pass_mark   int,
  p_passed      boolean,
  p_breakdown   jsonb,
  p_details     jsonb,
  p_nationality text default null,
  p_birth       date default null
)
returns uuid
language plpgsql security definer as $$
declare
  v_inst uuid;
  v_exam uuid;
  v_res  uuid;
begin
  select id into v_inst from institutions
   where upper(code) = upper(trim(p_code)) limit 1;
  if v_inst is null then
    raise exception '学校のコードが見つかりません';
  end if;

  if trim(coalesce(p_name,'')) = '' then
    raise exception '名前が空です';
  end if;

  -- 同名の受験者を探す
  select id into v_exam from examinees
   where institution_id = v_inst and name = trim(p_name) limit 1;

  if v_exam is null then
    insert into examinees (institution_id, name, nationality, birth_date)
    values (v_inst, trim(p_name), p_nationality, p_birth)
    returning id into v_exam;
  else
    -- 国籍・生年月日が後から入力された場合は補う
    update examinees set
      nationality = coalesce(nationality, p_nationality),
      birth_date  = coalesce(birth_date,  p_birth)
    where id = v_exam;
  end if;

  insert into results (institution_id, examinee_id, tool, total, correct,
                       pass_mark, passed, breakdown, details)
  values (v_inst, v_exam, p_tool, p_total, p_correct,
          p_pass_mark, p_passed, p_breakdown, p_details)
  returning id into v_res;

  return v_res;
end;
$$;

-- ③ 未ログインでもこの2つの関数だけは呼べるようにする
grant execute on function find_institution(text) to anon, authenticated;
grant execute on function submit_result(
  text, text, text, int, int, int, boolean, jsonb, jsonb, text, date
) to anon, authenticated;

-- テーブルへの直接アクセスは anon には与えない（RLSに加えた二重の防御）
revoke all on institutions from anon;
revoke all on examinees    from anon;
revoke all on results      from anon;
revoke all on staff        from anon;

-- ============================================================
-- ④ 管理画面用：所属機関の受験者と結果を一覧で返すビュー
--    RLS が効くため、ログインした職員は自校の分しか見えない
-- ============================================================
create or replace view v_results as
  select r.id, r.institution_id, r.examinee_id,
         e.name as examinee_name, e.nationality, e.birth_date,
         i.name as institution_name, i.code as institution_code,
         i.address as institution_address,
         r.tool, r.tested_at, r.place, r.total, r.correct,
         r.pass_mark, r.passed, r.breakdown, r.details,
         r.study_hours, r.interviewer
  from results r
  join examinees e on e.id = r.examinee_id
  join institutions i on i.id = r.institution_id;

grant select on v_results to authenticated;
