-- Makes template categories admin-editable instead of a hardcoded Postgres
-- enum (which was also missing 'Creative' entirely — fixed here as a
-- byproduct of moving to a lookup table).

create table if not exists public.template_categories (
  id text primary key,           -- kept identical to existing enum labels — no data remap needed
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.template_categories enable row level security;

drop policy if exists "Public can read categories" on public.template_categories;
create policy "Public can read categories"
  on public.template_categories
  for select
  using (true);

insert into public.template_categories (id, label, sort_order) values
  ('Developer', 'Developer', 1),
  ('Designer', 'Designer', 2),
  ('Medical', 'Medical', 3),
  ('Student', 'Student', 4),
  ('Creative', 'Creative', 5)
on conflict (id) do nothing;

-- templates.category: enum -> plain text FK into the new lookup table.
alter table public.templates alter column category type text using category::text;

alter table public.templates drop constraint if exists templates_category_fkey;
alter table public.templates add constraint templates_category_fkey
  foreign key (category) references public.template_categories(id);
