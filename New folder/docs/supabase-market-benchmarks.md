# Supabase market benchmark setup

This app expects a public read table called `market_benchmarks`.

## Suggested table

```sql
create table if not exists public.market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  level text not null,
  p25 numeric not null check (p25 >= 0),
  p50 numeric not null check (p50 >= 0),
  p75 numeric not null check (p75 >= 0),
  source text,
  effective_date date,
  created_at timestamptz not null default now(),
  constraint market_benchmarks_percentiles_check check (p25 <= p50 and p50 <= p75)
);
```

## Indexes

```sql
create index if not exists market_benchmarks_family_level_idx
  on public.market_benchmarks (lower(family), lower(level));

create index if not exists market_benchmarks_effective_date_idx
  on public.market_benchmarks (effective_date desc);
```

If family and level searches need partial matching at scale, enable trigram indexes:

```sql
create extension if not exists pg_trgm;

create index if not exists market_benchmarks_family_trgm_idx
  on public.market_benchmarks using gin (family gin_trgm_ops);

create index if not exists market_benchmarks_level_trgm_idx
  on public.market_benchmarks using gin (level gin_trgm_ops);
```

## Row level security

For a public benchmarking lookup tool, enable RLS and allow anonymous reads only:

```sql
alter table public.market_benchmarks enable row level security;

create policy "Allow public benchmark reads"
  on public.market_benchmarks
  for select
  to anon
  using (true);
```

Do not add anonymous insert, update, or delete policies unless users are meant to maintain the benchmark dataset from the app.

## Data quality checks

- Keep `family` and `level` naming consistent, for example `Engineering` and `L3`.
- Store salaries as annual GBP numbers without currency symbols.
- Add `source` and `effective_date` before using results for business decisions.
- Prefer importing curated benchmark rows through Supabase admin tools or a protected server-side workflow, not from the public client.
