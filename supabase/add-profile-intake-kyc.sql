-- Profile intake (safe last-4 Aadhaar) + optional student meta. Run after schema-profiles.sql / schema-membership-kyc-payments.sql.
-- Full Aadhaar is never stored; only last 4 digits for desk cross-check.

alter table public.profiles
  add column if not exists aadhaar_last_four text,
  add column if not exists student_roll_number text,
  add column if not exists institution_type text
    check (institution_type is null or institution_type in ('school', 'college', 'freelance', 'other')),
  add column if not exists preparing_for text,
  add column if not exists verification_reviewed_by uuid references auth.users (id);

comment on column public.profiles.aadhaar_last_four is 'Last 4 digits of Aadhaar only (XXXX). Never store full number.';
comment on column public.profiles.institution_type is 'school | college | freelance | other';
comment on column public.profiles.verification_reviewed_by is 'Admin user who last set verification_status to approved/rejected.';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_aadhaar_last_four_digits'
  ) then
    alter table public.profiles
      add constraint profiles_aadhaar_last_four_digits
      check (aadhaar_last_four is null or aadhaar_last_four ~ '^[0-9]{4}$');
  end if;
end $$;
