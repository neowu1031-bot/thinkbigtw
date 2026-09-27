-- Apply manually after review. Contains no credentials.
-- Stores AI-generated conversation summaries for internal review; no raw transcript IP stored.
-- Run AFTER 20260927_thinkbig_inquiries.sql (depends on service_role grants).
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
  full_messages jsonb       not null default '[]',  -- full conversation (handled locally, never to TG)
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

-- Hourly rate cap (20 non-test per hour across all IPs) enforced via a function.
-- Worker calls this; returns 'accepted' | 'duplicate' | 'rate_limited'.
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

  -- Global hourly rate cap (non-test only)
  if not p_is_test then
    if (select count(*) from public.thinkbig_chat_reports
        where is_test = false
          and created_at > pg_catalog.clock_timestamp() - interval '1 hour') >= 20 then
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

-- REQUIRED retention job (run in Supabase Dashboard after enabling pg_cron):
-- select cron.schedule('thinkbig-chat-reports-retention', '5 */6 * * *',
--   $$delete from public.thinkbig_chat_reports where created_at <= now() - interval '30 days'$$);
