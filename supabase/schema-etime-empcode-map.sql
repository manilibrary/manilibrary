-- =============================================================================
-- Map eTime device Empcode (e.g. "0002") → library profiles.device_user_id (0–9999).
-- Run once after public.profiles exists. Sync jobs resolve punches via this table
-- when the device code is not numerically equal to device_user_id.
-- =============================================================================

create table if not exists public.etime_empcode_map (
  empcode         text primary key,
  device_user_id  int not null references public.profiles (device_user_id) on update cascade on delete cascade,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists etime_empcode_map_device_user_id_idx
  on public.etime_empcode_map (device_user_id);

comment on table public.etime_empcode_map is
  'Device Empcode string from eTimeOffice → internal device_user_id; use when Empcode is zero-padded or differs from issued device_user_id.';

alter table public.etime_empcode_map enable row level security;

drop policy if exists etime_empcode_map_select on public.etime_empcode_map;
create policy etime_empcode_map_select on public.etime_empcode_map
  for select to authenticated
  using (
    device_user_id = (select p.device_user_id from public.profiles p where p.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
  );

grant select on public.etime_empcode_map to authenticated;
