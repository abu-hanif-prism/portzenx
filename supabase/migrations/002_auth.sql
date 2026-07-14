-- Adds real Supabase Auth-backed identity on top of the existing customers/
-- templates/edit_tokens/orders tables. Additive only — does not touch or
-- attempt to reconcile the drift between 001_initial.sql and the live schema.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- customers = one row per purchased site, now owned by a profile.
alter table public.customers add column if not exists user_id uuid references auth.users(id);

create index if not exists customers_user_id_idx on public.customers (user_id);

drop policy if exists "Users can view own sites" on public.customers;
create policy "Users can view own sites"
  on public.customers
  for select
  using (auth.uid() = user_id);

-- orders carries the same identity through to the paid-signup path
-- (sslcommerz-ipn copies it onto the customers row it creates).
alter table public.orders add column if not exists user_id uuid references auth.users(id);
