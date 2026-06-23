create extension if not exists pgcrypto;

do $$ begin
  create type public.template_category as enum ('Developer', 'Designer', 'Medical', 'Student');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.portzen_plan as enum ('trial', 'six_months', 'one_year');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.template_category not null,
  preview_url text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  subdomain text not null unique,
  plan public.portzen_plan not null,
  password_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.edit_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token text not null unique,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plan public.portzen_plan not null,
  amount integer not null check (amount > 0),
  payment_status public.payment_status not null default 'pending',
  whatsapp_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists templates_active_category_created_idx
  on public.templates (is_active, category, created_at desc);

create index if not exists edit_tokens_customer_created_idx
  on public.edit_tokens (customer_id, created_at desc);

create index if not exists orders_customer_created_idx
  on public.orders (customer_id, created_at desc);

alter table public.templates enable row level security;
alter table public.customers enable row level security;
alter table public.edit_tokens enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active templates" on public.templates;
create policy "Public can read active templates"
  on public.templates
  for select
  using (is_active = true);

insert into public.templates (name, category, preview_url, tags, is_active)
values
  ('Devfolio', 'Developer', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80', array['React', 'Dark', 'Animated'], true),
  ('Terminal', 'Developer', 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80', array['Minimal', 'Mono'], true),
  ('Studio', 'Designer', 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80', array['Gallery', 'Bold'], true),
  ('Canvas', 'Designer', 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80', array['Grid', 'Creative'], true),
  ('MediPro', 'Medical', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80', array['Clean', 'Professional'], true),
  ('Scholar', 'Student', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80', array['Fresh', 'Simple'], true)
on conflict do nothing;
