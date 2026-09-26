-- Apply manually after review. Contains no credentials. No transcript/IP columns.
begin;
create table public.thinkbig_inquiries (
  id uuid primary key,
  name text not null check (length(name) between 1 and 80),
  organization text not null default '' check (length(organization) <= 120),
  need text not null check (length(need) between 1 and 1200),
  scale text not null check (length(scale) between 1 and 120),
  contact_method text not null check (contact_method in ('email', 'phone', 'line')),
  contact text not null check (length(contact) between 2 and 254),
  consent_at timestamptz not null default clock_timestamp()
);
create index thinkbig_inquiries_consent_idx on public.thinkbig_inquiries (consent_at, id);
create index thinkbig_inquiries_contact_idx on public.thinkbig_inquiries (contact_method, contact, consent_at);
alter table public.thinkbig_inquiries enable row level security;
alter table public.thinkbig_inquiries force row level security;
revoke all on public.thinkbig_inquiries from public, anon, authenticated;
grant select, insert, delete on public.thinkbig_inquiries to service_role;
create policy service_role_only on public.thinkbig_inquiries for all to service_role using (true) with check (true);

-- Security invoker: REST callers require the service_role key. Never expose to browsers.
-- Transaction locks serialize retries and contact throttling across worker instances.
create function public.submit_thinkbig_inquiry(
  p_id uuid, p_name text, p_organization text, p_need text,
  p_scale text, p_contact_method text, p_contact text
) returns text language plpgsql security invoker set search_path = '' as $$
declare existing public.thinkbig_inquiries%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inquiry-id:' || p_id::text, 0));
  select * into existing from public.thinkbig_inquiries where id = p_id;
  if found then
    if existing.name = p_name and existing.organization = p_organization and existing.need = p_need
       and existing.scale = p_scale and existing.contact_method = p_contact_method and existing.contact = p_contact then
      return 'duplicate';
    end if;
    return 'conflict';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inquiry-contact:' || p_contact_method || ':' || p_contact, 0));
  if (select count(*) from public.thinkbig_inquiries where contact_method = p_contact_method
      and contact = p_contact and consent_at > pg_catalog.clock_timestamp() - interval '30 minutes') >= 3 then
    return 'rate_limited';
  end if;
  insert into public.thinkbig_inquiries (id, name, organization, need, scale, contact_method, contact)
  values (p_id, p_name, p_organization, p_need, p_scale, p_contact_method, p_contact);
  return 'accepted';
end $$;
revoke all on function public.submit_thinkbig_inquiry(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_thinkbig_inquiry(uuid,text,text,text,text,text,text) to service_role;
commit;

-- REQUIRED retention job: enable pg_cron in the Supabase Dashboard, then run:
-- select cron.schedule('thinkbig-inquiries-retention', '*/15 * * * *',
--   $$delete from public.thinkbig_inquiries where consent_at <= now() - interval '30 days'$$);
-- A privileged external scheduler can execute the same DELETE every 15 minutes instead.
-- Deletion is due at 30 days; job cadence can introduce up to 15 minutes of delay.
-- Verify the job's recent succeeded run before enabling the UI in production.
-- These settings do not purge any old thinkbig_cs_logs rows or provider backups.
