-- Daily call counts for the Google Places proxy (supabase/functions/places).
-- Only the Edge Function (service role) can count; the app's anon/publishable key has no access at all.
create table if not exists public.places_usage (
  day date not null default (now() at time zone 'Europe/London')::date,
  sku text not null check (sku in ('find', 'details', 'photos')),
  calls integer not null default 0,
  primary key (day, sku)
);
alter table public.places_usage enable row level security;
-- No policies: with RLS on, anon and authenticated can't read or write rows.
revoke all on public.places_usage from anon, authenticated;

-- Count one call and say whether it is still within today's cap. Atomic, so parallel requests can't overshoot.
create or replace function public.places_bump(p_sku text, p_cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.places_usage as u (day, sku, calls)
  values ((now() at time zone 'Europe/London')::date, p_sku, 1)
  on conflict (day, sku) do update set calls = u.calls + 1
  returning calls into n;
  return n <= p_cap;
end;
$$;
revoke all on function public.places_bump(text, integer) from public, anon, authenticated;
grant execute on function public.places_bump(text, integer) to service_role;
