-- profiles.phone → bigint: only digits, 7–15 digits (e.g. 9876543210).

begin;

update public.profiles
set email = left(trim(phone::text), 254)
where phone is not null
  and trim(phone::text) like '%@%'
  and (email is null or trim(email) = '');

alter table public.profiles
  add column if not exists phone_int bigint;

update public.profiles p
set phone_int = s.v
from (
  select
    user_id,
    case
      when phone is null then null::bigint
      when trim(phone::text) like '%@%' then null::bigint
      else (
        case
          when length(d) between 7 and 15 and d ~ '^[0-9]+$' then d::bigint
          else null::bigint
        end
      )
    end as v
  from (
    select
      user_id,
      phone,
      nullif(regexp_replace(trim(phone::text), '\D', '', 'g'), '') as d
    from public.profiles
  ) x
) s
where p.user_id = s.user_id;

-- active_profiles is select * — must drop before column swap
drop view if exists public.active_profiles;

alter table public.profiles drop column if exists phone;
alter table public.profiles rename column phone_int to phone;

alter table public.profiles
  drop constraint if exists profiles_phone_len_check;

alter table public.profiles
  drop constraint if exists profiles_phone_len;

alter table public.profiles
  drop constraint if exists profiles_phone_format_check;

alter table public.profiles
  drop constraint if exists profiles_phone_digits_check;

alter table public.profiles
  add constraint profiles_phone_int_check
  check (
    phone is null
    or (phone >= 1000000 and phone <= 999999999999999)
  );

create or replace view public.active_profiles as
  select * from public.profiles where deleted_at is null;

grant select on public.active_profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  raw_phone text;
  digits text;
  phone_val bigint;
begin
  raw_phone := coalesce(new.raw_user_meta_data->>'phone', new.phone::text, '');
  digits := nullif(regexp_replace(trim(raw_phone), '\D', '', 'g'), '');
  phone_val := null;
  if digits is not null
    and digits !~ '@'
    and length(digits) between 7 and 15
    and digits ~ '^[0-9]+$'
  then
    phone_val := digits::bigint;
  end if;

  insert into public.profiles (user_id, full_name, phone, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', 'Member'), 100),
    phone_val,
    left(coalesce(new.email::text, ''), 254)
  );
  return new;
end;
$$;

commit;
