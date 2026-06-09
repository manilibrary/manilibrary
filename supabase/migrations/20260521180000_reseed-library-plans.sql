-- Restore default sellable plans if rows were deleted (e.g. manual DB cleanup).
-- Safe to run repeatedly.

insert into public.library_plans
  (code, name, floor, access_label, is_24hour, price_1m, mrp_1m, price_3m, mrp_3m, price_6m, mrp_6m, sort_order, is_active)
values
  ('morning',   'Morning shift',        2, '6 AM – 2 PM',                    false,  699,  800, 1999,  2400, 3899,  4800, 10, true),
  ('evening',   'Evening shift',        2, '2 PM – 10 PM',                   false,  799,  900, 2199,  2700, 4099,  5400, 20, true),
  ('night',     'Night shift',          2, '10 PM – 6 AM',                   false,  499,  600, 1399,  1800, 2599,  3600, 30, true),
  ('fixed_24h', '24-hour fixed seat',   1, 'Reserved seat + 24-hour access', true, 1599, 1799, 4499,  5397, 8499, 10794, 40, true)
on conflict (code) do update set
  name = excluded.name,
  floor = excluded.floor,
  access_label = excluded.access_label,
  is_24hour = excluded.is_24hour,
  price_1m = excluded.price_1m,
  mrp_1m = excluded.mrp_1m,
  price_3m = excluded.price_3m,
  mrp_3m = excluded.mrp_3m,
  price_6m = excluded.price_6m,
  mrp_6m = excluded.mrp_6m,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

update public.library_plans
set mrp_3m = mrp_1m * 3,
    mrp_6m = mrp_1m * 6,
    updated_at = now()
where mrp_3m <> mrp_1m * 3 or mrp_6m <> mrp_1m * 6;
