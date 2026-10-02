-- Run this schema in a dedicated Supabase project's SQL Editor.
-- Student rows and credentials are seeded separately from the ignored private/ folder.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.students (
  student_id text primary key,
  full_name text not null,
  password_hash text not null,
  must_change_password boolean not null default true,
  card_uid text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  card_status text not null default 'Đang hoạt động',
  balance bigint not null default 65000 check (balance >= 0),
  so_luot_ra_vao integer not null default 0 check (so_luot_ra_vao >= 0),
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ride_history (
  id bigint generated always as identity primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  action text not null check (action in ('entry', 'exit')),
  amount integer not null default -500 check (amount = -500),
  balance_after bigint not null check (balance_after >= 0),
  occurred_at timestamptz not null default now()
);

create index if not exists ride_history_student_time_idx
  on public.ride_history (student_id, occurred_at desc);

alter table public.students enable row level security;
alter table public.ride_history enable row level security;
revoke all on public.students, public.ride_history from anon, authenticated;

create or replace function public.login_student(p_student_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student public.students%rowtype;
  v_attempts integer;
begin
  select * into v_student
  from public.students
  where student_id = p_student_id
  for update;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if v_student.locked_until is not null and v_student.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked', true);
  end if;

  if crypt(p_password, v_student.password_hash) <> v_student.password_hash then
    v_attempts := v_student.failed_login_attempts + 1;
    update public.students
    set failed_login_attempts = v_attempts,
        locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' else null end
    where student_id = p_student_id;
    return jsonb_build_object('ok', false, 'locked', v_attempts >= 5);
  end if;

  update public.students
  set failed_login_attempts = 0, locked_until = null
  where student_id = p_student_id;

  return jsonb_build_object(
    'ok', true,
    'studentId', v_student.student_id,
    'mustChangePassword', v_student.must_change_password
  );
end;
$$;

create or replace function public.change_student_password(p_student_id text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if char_length(p_new_password) < 10 then
    return false;
  end if;

  update public.students
  set password_hash = crypt(p_new_password, gen_salt('bf', 12)),
      must_change_password = false,
      failed_login_attempts = 0,
      locked_until = null
  where student_id = p_student_id;

  return found;
end;
$$;

create or replace function public.dashboard_for_student(p_student_id text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'student', jsonb_build_object(
      'studentId', s.student_id,
      'fullName', s.full_name,
      'cardUid', s.card_uid,
      'cardStatus', s.card_status,
      'balance', s.balance,
      'soLuotRaVao', s.so_luot_ra_vao,
      'mustChangePassword', s.must_change_password
    ),
    'rideHistory', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'timestamp', h.occurred_at,
          'action', case h.action when 'entry' then 'Vào bãi' else 'Ra bãi' end,
          'description', case h.action when 'entry' then 'Quẹt thẻ VÀO bãi' else 'Quẹt thẻ RA bãi' end,
          'amount', h.amount,
          'balanceAfter', h.balance_after
        ) order by h.occurred_at desc
      )
      from (
        select * from public.ride_history
        where student_id = p_student_id
        order by occurred_at desc
        limit 100
      ) h
    ), '[]'::jsonb)
  )
  from public.students s
  where s.student_id = p_student_id;
$$;

create or replace function public.charge_parking(p_student_id text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance bigint;
  v_count integer;
begin
  if p_action not in ('entry', 'exit') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ACTION');
  end if;

  update public.students
  set balance = balance - 500,
      so_luot_ra_vao = so_luot_ra_vao + 1
  where student_id = p_student_id and balance >= 500
  returning balance, so_luot_ra_vao into v_balance, v_count;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_BALANCE');
  end if;

  insert into public.ride_history (student_id, action, amount, balance_after)
  values (p_student_id, p_action, -500, v_balance);

  return jsonb_build_object('ok', true, 'balance', v_balance, 'soLuotRaVao', v_count);
end;
$$;

revoke all on function public.login_student(text, text) from public, anon, authenticated;
revoke all on function public.change_student_password(text, text) from public, anon, authenticated;
revoke all on function public.dashboard_for_student(text) from public, anon, authenticated;
revoke all on function public.charge_parking(text, text) from public, anon, authenticated;
grant execute on function public.login_student(text, text) to service_role;
grant execute on function public.change_student_password(text, text) to service_role;
grant execute on function public.dashboard_for_student(text) to service_role;
grant execute on function public.charge_parking(text, text) to service_role;
