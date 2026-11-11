-- Wedding Planner — household sync (round 2)
-- ------------------------------------------------------------------
-- Paste this whole file into the Supabase dashboard SQL editor and run it.
-- It is idempotent: running it again is safe and just refreshes the functions.
--
-- Model
--   * One row per household (the two of you). No sign-in, no email.
--   * The app holds an unguessable secret (32 random bytes, base64url, 43 chars).
--     Only sha256(secret) is stored here, never the secret itself.
--   * The table has RLS on and NO policies, and anon/authenticated have no
--     table privileges, so the publishable/anon key cannot read or write rows
--     directly. Every read/write goes through the SECURITY DEFINER functions
--     below, which only touch the one row whose hash matches the secret.
--   * `state` is an opaque JSON document the app merges per record
--     (last-writer-wins per record, with tombstones for deletes).
--   * `version` is bumped on every write; put_state only succeeds when the
--     caller's base_version matches (optimistic concurrency). On a mismatch
--     it returns the current state so the app can merge and retry.
-- ------------------------------------------------------------------

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  state       jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Size guard (about 5 MB of JSON). Added separately so re-runs are safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'households_state_size' and conrelid = 'public.households'::regclass
  ) then
    alter table public.households
      add constraint households_state_size check (octet_length(state::text) < 5000000);
  end if;
end $$;

alter table public.households enable row level security;
-- Not FORCE: the table owner (used by the SECURITY DEFINER functions) must
-- still reach rows; API roles have no policies and no grants, so they cannot.
alter table public.households no force row level security;

-- No direct table access for API roles (RLS with no policies also denies).
revoke all on table public.households from public, anon, authenticated;

-- Remove any policies an earlier experiment may have added.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'households' loop
    execute format('drop policy %I on public.households', p.policyname);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- Private helpers (not exposed through the API)
-- ------------------------------------------------------------------
create schema if not exists wp_private;
revoke all on schema wp_private from public, anon, authenticated;

-- sha256 hex of the secret. Uses Postgres's built-in sha256(); this gives the
-- same digest as pgcrypto's digest(x, 'sha256') without depending on which
-- schema pgcrypto is installed in.
create or replace function wp_private.secret_hash(p_secret text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_secret is null
     or length(p_secret) < 40
     or length(p_secret) > 200
     or p_secret !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid household secret' using errcode = '22023';
  end if;
  return encode(pg_catalog.sha256(convert_to(p_secret, 'UTF8')), 'hex');
end;
$$;

revoke all on function wp_private.secret_hash(text) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Public RPCs (called by the app with the publishable/anon key)
-- ------------------------------------------------------------------

-- Create the household on the first device and upload its current state.
-- Safe to retry: if the same secret already exists, returns that row instead.
create or replace function public.create_household(p_secret text, p_state jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text := wp_private.secret_hash(p_secret);
  r public.households%rowtype;
begin
  insert into public.households (secret_hash, state)
  values (h, coalesce(p_state, '{}'::jsonb))
  on conflict (secret_hash) do nothing;

  select * into r from public.households where secret_hash = h;
  return jsonb_build_object(
    'ok', true,
    'found', true,
    'version', r.version,
    'state', r.state,
    'updated_at', r.updated_at
  );
end;
$$;

-- Read the shared state. Returns {found:false} for an unknown or replaced link.
create or replace function public.get_state(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h text := wp_private.secret_hash(p_secret);
  r public.households%rowtype;
begin
  select * into r from public.households where secret_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'found', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'found', true,
    'version', r.version,
    'state', r.state,
    'updated_at', r.updated_at
  );
end;
$$;

-- Write the shared state if nobody else wrote since p_base_version.
-- On a version mismatch returns {ok:false, conflict:true, version, state}
-- so the app can merge and try again.
create or replace function public.put_state(p_secret text, p_state jsonb, p_base_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text := wp_private.secret_hash(p_secret);
  r public.households%rowtype;
  v integer;
  t timestamptz;
begin
  if p_state is null then
    raise exception 'state is required' using errcode = '22023';
  end if;

  select * into r from public.households where secret_hash = h for update;
  if not found then
    return jsonb_build_object('ok', false, 'found', false);
  end if;

  if p_base_version is distinct from r.version then
    return jsonb_build_object(
      'ok', false,
      'found', true,
      'conflict', true,
      'version', r.version,
      'state', r.state,
      'updated_at', r.updated_at
    );
  end if;

  update public.households
     set state = p_state,
         version = r.version + 1,
         updated_at = now()
   where id = r.id
  returning version, updated_at into v, t;

  return jsonb_build_object('ok', true, 'found', true, 'version', v, 'updated_at', t);
end;
$$;

-- Re-key the household: the old link stops working immediately.
create or replace function public.rotate_secret(p_old_secret text, p_new_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_h text := wp_private.secret_hash(p_old_secret);
  new_h text := wp_private.secret_hash(p_new_secret);
  r public.households%rowtype;
begin
  if old_h = new_h then
    raise exception 'new secret must differ' using errcode = '22023';
  end if;

  update public.households
     set secret_hash = new_h,
         updated_at = now()
   where secret_hash = old_h
  returning * into r;

  if not found then
    return jsonb_build_object('ok', false, 'found', false);
  end if;
  return jsonb_build_object('ok', true, 'found', true, 'version', r.version);
end;
$$;

-- Only the RPCs are callable by the app's key.
revoke all on function public.create_household(text, jsonb) from public;
revoke all on function public.get_state(text) from public;
revoke all on function public.put_state(text, jsonb, integer) from public;
revoke all on function public.rotate_secret(text, text) from public;

grant execute on function public.create_household(text, jsonb) to anon, authenticated;
grant execute on function public.get_state(text) to anon, authenticated;
grant execute on function public.put_state(text, jsonb, integer) to anon, authenticated;
grant execute on function public.rotate_secret(text, text) to anon, authenticated;

-- Let the security-definer functions' owner use the helper.
do $$ begin execute format('grant usage on schema wp_private to %I', current_user); end $$;

-- Ask the API to pick up the new functions straight away.
notify pgrst, 'reload schema';
