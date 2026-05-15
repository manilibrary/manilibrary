-- Security: column length checks + idempotent payment ids (run once in Supabase SQL editor).

-- Truncate profile fields on new auth users (defense in depth if API is bypassed).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, phone, email)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', 'Member'), 100),
    nullif(left(coalesce(new.raw_user_meta_data->>'phone', new.phone::text, ''), 40), ''),
    left(coalesce(new.email::text, ''), 254)
  );
  return new;
end;
$$;

do $$
begin
  alter table public.profiles
    add constraint profiles_full_name_len check (char_length(full_name) between 2 and 100);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_phone_len check (phone is null or char_length(phone) <= 40);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_email_len check (email is null or char_length(email) <= 254);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists payments_provider_payment_id_unique
  on public.payments (provider_payment_id)
  where provider_payment_id is not null and deleted_at is null;
