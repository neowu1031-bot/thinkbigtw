-- Apply manually after review. Contains no credentials.
-- Stores AI-generated conversation summaries for internal review; no raw transcript IP stored.
-- Run AFTER 20260927_thinkbig_inquiries.sql (depends on service_role grants).
-- D4修正版：F2 is_test rate limit、F5 pg_cron 實際執行（非注釋）
begin;

create table public.thinkbig_chat_reports (
  id            uuid        primary key,         -- session_id from frontend (client-generated v4)
  created_at    timestamptz not null default clock_timestamp(),
  user_turns    int         not null check (user_turns >= 2),
  has_contact   boolean     not null default false,
  is_test       boolean     not null default false,
  heat          text        not null default 'low' check (heat in ('high', 'medium', 'low')),
  tier_guess    text        not null default '' check (length(tier_guess) <= 60),
  summary_json  jsonb       not null default '{}',  -- structured report WITHOUT contact info
  full_messages jsonb                default '[]',   -- full conversation; relayed within ~10 min then set to null
  sent_at       timestamptz                          -- null = pending relay
);

create index thinkbig_chat_reports_pending_idx
  on public.thinkbig_chat_reports (created_at asc)
  where sent_at is null;

alter table public.thinkbig_chat_reports enable row level security;
alter table public.thinkbig_chat_reports force row level security;
revoke all on public.thinkbig_chat_reports from public, anon, authenticated;
grant select, insert, update, delete on public.thinkbig_chat_reports to service_role;
create policy service_role_only on public.thinkbig_chat_reports
  for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────
-- RPC: submit_thinkbig_chat_report
-- Returns 'accepted' | 'duplicate' | 'rate_limited'
-- F2: 非測試對話 20/hr；測試對話 5/hr（D4修正版）
-- ─────────────────────────────────────────────────────────────────
create function public.submit_thinkbig_chat_report(
  p_id            uuid,
  p_user_turns    int,
  p_has_contact   boolean,
  p_is_test       boolean,
  p_heat          text,
  p_tier_guess    text,
  p_summary_json  jsonb,
  p_full_messages jsonb
) returns text language plpgsql security invoker set search_path = '' as $$
begin
  -- Deduplicate by session id
  if exists (select 1 from public.thinkbig_chat_reports where id = p_id) then
    return 'duplicate';
  end if;

  -- F2: Global hourly rate cap for non-test conversations (20/hr)
  if not p_is_test then
    if (select count(*) from public.thinkbig_chat_reports
        where is_test = false
          and created_at > pg_catalog.clock_timestamp() - interval '1 hour') >= 20 then
      return 'rate_limited';
    end if;
  end if;

  -- F2: Separate hourly rate cap for test conversations (5/hr)
  if p_is_test then
    if (select count(*) from public.thinkbig_chat_reports
        where is_test = true
          and created_at > pg_catalog.clock_timestamp() - interval '1 hour') >= 5 then
      return 'rate_limited';
    end if;
  end if;

  insert into public.thinkbig_chat_reports
    (id, user_turns, has_contact, is_test, heat, tier_guess, summary_json, full_messages)
  values
    (p_id, p_user_turns, p_has_contact, p_is_test, p_heat, p_tier_guess, p_summary_json, p_full_messages);

  return 'accepted';
end $$;

revoke all on function public.submit_thinkbig_chat_report(uuid,int,boolean,boolean,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_thinkbig_chat_report(uuid,int,boolean,boolean,text,text,jsonb,jsonb)
  to service_role;

commit;

-- ─────────────────────────────────────────────────────────────────
-- F5: pg_cron 資料保留作業（OUTSIDE transaction block — cron.schedule 不可在 transaction 內執行）
-- 每 6 小時整（UTC 00:05/06:05/12:05/18:05）刪除 30 天以上的記錄
-- 注意：pg_cron extension 必須已在 Supabase Dashboard 啟用
-- ─────────────────────────────────────────────────────────────────
select cron.schedule(
  'thinkbig-chat-reports-retention',
  '5 */6 * * *',
  $$delete from public.thinkbig_chat_reports
    where created_at <= now() - interval '30 days'$$
);

-- ─────────────────────────────────────────────────────────────────
-- F5: 驗證查詢（遷移後手動執行確認）
--
-- 1. 確認 cron job 已登錄：
--    select jobname, schedule, command, active
--    from cron.job
--    where jobname = 'thinkbig-chat-reports-retention';
--    -- 預期：回傳 1 列，active=true，schedule='5 */6 * * *'
--
-- 2. 確認 anon key 被拒（RLS 防穿透）：
--    -- 用 anon JWT 呼叫 Supabase REST：
--    -- GET /rest/v1/thinkbig_chat_reports
--    -- 預期：HTTP 401 或 0 rows（strict RLS 下不回任何資料）
--    -- 也可在 SQL editor 執行：
--    set role anon;
--    select * from public.thinkbig_chat_reports limit 1;
--    -- 預期：ERROR: permission denied for table thinkbig_chat_reports
--    reset role;
-- ─────────────────────────────────────────────────────────────────
