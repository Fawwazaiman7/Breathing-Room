-- Only needed if you already ran 005_signup_domains.sql from the earlier zip.
-- Puts sign-up back to: every new account is a student, any email address.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, student_number, class_name)
  values (
    new.id,
    left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    nullif(left(btrim(new.raw_user_meta_data ->> 'student_number'), 30), ''),
    nullif(left(btrim(new.raw_user_meta_data ->> 'class_name'), 30), '')
  );
  return new;
end;
$$;

drop table if exists public.signup_email_domains;
