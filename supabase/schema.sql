-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- Single shared blob holding the whole app state (members, programs, worklogs, etc).
-- Row id is always 1 — mirrors the app's previous single shared window.storage key.
create table if not exists app_state (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);

-- One row per user holding their private progress-photo gallery.
create table if not exists user_photos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;
alter table user_photos enable row level security;

-- Any signed-in member of the group can read/write the shared state.
-- (Fine-grained per-role checks, e.g. "only admins can approve members", stay
-- enforced in the app itself, same as before — this just gates by "is signed in".)
create policy "authenticated read app_state" on app_state
  for select using (auth.role() = 'authenticated');
create policy "authenticated write app_state" on app_state
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update app_state" on app_state
  for update using (auth.role() = 'authenticated');

-- Photos are private to the owning user.
create policy "own photos read" on user_photos
  for select using (auth.uid() = user_id);
create policy "own photos write" on user_photos
  for insert with check (auth.uid() = user_id);
create policy "own photos update" on user_photos
  for update using (auth.uid() = user_id);
