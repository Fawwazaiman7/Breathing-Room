-- Ruang Pulih: initial database schema.
-- Run once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Access model
--   * Students and advisors sign in with Supabase Auth.
--   * The browser may only READ, and only the rows allowed by the policies
--     below (Row Level Security).
--   * Every WRITE goes through the NestJS backend using the secret key, so a
--     screening result can never be created or edited from the browser.

-- ---------------------------------------------------------------------------
-- Profiles: one row per signed-up user
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'advisor');

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.user_role not null default 'student',
  full_name      text not null default '',
  student_number text unique,   -- NIM; null for advisors
  class_name     text,          -- e.g. 'TI 6A'; null for advisors
  advisor_id     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index profiles_advisor_id_idx on public.profiles (advisor_id);

-- ---------------------------------------------------------------------------
-- Screenings: one row per completed screening
-- ---------------------------------------------------------------------------
create table public.screenings (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Raw answers, kept so any result can be recomputed and audited.
  nasa_pairwise_choices text[]   not null
    check (cardinality(nasa_pairwise_choices) = 15),
  nasa_ratings          jsonb    not null,
  olbi_answers          smallint[] not null
    check (cardinality(olbi_answers) = 16),

  -- Computed by the backend screening core.
  nasa_weights           jsonb        not null,
  nasa_weighted_workload numeric(7,2) not null,
  nasa_score             numeric(5,2) not null
    check (nasa_score between 0 and 100),
  workload_level         text not null
    check (workload_level in ('VERY_LOW','LOW','MODERATE','HIGH','VERY_HIGH')),
  exhaustion_score       numeric(3,2) not null
    check (exhaustion_score between 1 and 4),
  exhaustion_level       text not null
    check (exhaustion_level in ('LOW','HIGH')),
  disengagement_score    numeric(3,2) not null
    check (disengagement_score between 1 and 4),
  disengagement_level    text not null
    check (disengagement_level in ('LOW','HIGH')),

  -- Rule-Based decision. This is the authoritative screening result.
  rule_id            text not null check (rule_id ~ '^R([1-9]|1[0-9]|20)$'),
  category           text not null
    check (category in ('NO_BURNOUT','LOW_RISK','MODERATE_RISK','HIGH_RISK')),
  intervention_level text not null
    check (intervention_level in ('PROMOTIVE','PREVENTIVE','CURATIVE')),

  -- LLM explanation ("A note for you"). Filled in after the decision and
  -- never used to determine it.
  feedback_text         text,
  feedback_generated_at timestamptz
);

create index screenings_student_created_idx
  on public.screenings (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Create a profile automatically when someone signs up.
-- New users are always students. Promote an advisor by hand:
--   update public.profiles set role = 'advisor' where id = '<user uuid>';
-- (The role is deliberately NOT read from sign-up data, which the user
-- controls.)
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only access from the browser
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.screenings enable row level security;

revoke all on public.profiles, public.screenings from anon, authenticated;
grant select on public.profiles, public.screenings to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Advisors can read their advisees' profiles"
  on public.profiles for select to authenticated
  using (advisor_id = (select auth.uid()));

create policy "Students can read their own screenings"
  on public.screenings for select to authenticated
  using (student_id = (select auth.uid()));

create policy "Advisors can read their advisees' screenings"
  on public.screenings for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = screenings.student_id
        and p.advisor_id = (select auth.uid())
    )
  );
