-- Mani Library: persist F(n) / S(n) seat labels on memberships (maps still use seat_number int).
-- Apply in Supabase SQL Editor or via migration workflow alongside app deploy.

alter table public.memberships
  add column if not exists seat_label text;

comment on column public.memberships.seat_label is
  'Label at assignment time, e.g. F(47) for long_term or S(12) for short_term. '
  'Seat maps and btree_gist exclusivity constraints continue to use seat_number (integer).';

-- Backfill legacy rows: only where label is missing but numeric seat exists.
update public.memberships m
set seat_label = case
  when m.seat_number is null then null
  when m.plan_kind = 'long_term' then 'F(' || m.seat_number::text || ')'
  when m.plan_kind = 'short_term' then 'S(' || m.seat_number::text || ')'
  else m.seat_number::text
end
where m.seat_label is null
  and m.seat_number is not null;
