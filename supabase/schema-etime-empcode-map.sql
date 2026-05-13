-- =============================================================================
-- Map eTime device Empcode (e.g. "0002") → library profiles.member_number (0–9999).
-- Run once after public.profiles exists. Sync jobs resolve punches via this table
-- when the device code is not numerically equal to member_number.
-- =============================================================================

create table if not exists public.etime_empcode_map (
  empcode         text primary key,
  member_number   int not null references public.profiles (member_number) on update cascade on delete cascade,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists etime_empcode_map_member_number_idx
  on public.etime_empcode_map (member_number);

comment on table public.etime_empcode_map is
  'Device Empcode string from eTimeOffice → internal member_number; use when Empcode is zero-padded or differs from issued member_number.';

alter table public.etime_empcode_map enable row level security;

drop policy if exists etime_empcode_map_select on public.etime_empcode_map;
create policy etime_empcode_map_select on public.etime_empcode_map
  for select to authenticated
  using (
    member_number = (select p.member_number from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

grant select on public.etime_empcode_map to authenticated;
