-- =============================================================================
-- TEST SEED: link eTime Empcode "0002" to one member + active membership + seat
--            + sample rows in etime_attendance_daily / etime_punch_raw.
--
-- Run in Supabase → SQL Editor (postgres role bypasses RLS).
--
-- Prerequisites (run in order if not already applied):
--   1) schema-profiles.sql
--   2) schema-membership-kyc-payments.sql
--   3) schema-etime-punch.sql
--   4) schema-etime-empcode-map.sql
--
-- Before running: edit v_test_email and v_seat in the DO block below.
-- Alternative: replace the `select ... into` with
--   select user_id, member_number into v_uid, v_member_no
--   from public.profiles where member_number = 2 limit 1;  -- e.g. matches Empcode "0002"
-- and remove v_test_email / the email filter.
--
-- CLEANUP (optional, before re-seeding): inspect rows then delete by id, or:
--   update public.memberships set payment_id = null where user_id = '...' and notes like 'test seed:%';
--   delete from public.payments where provider = 'test_seed' and user_id = '...';
--   delete from public.memberships where user_id = '...' and notes like 'test seed:%';
--   delete from public.etime_empcode_map where empcode = '0002';
--   delete from public.etime_attendance_daily where remark = 'TEST-SEED';
--   delete from public.etime_punch_raw where member_number = ... and punch_at::date = current_date;
-- =============================================================================

do $$
declare
  v_test_email   text := 'REPLACE_WITH_YOUR_LOGIN_EMAIL@example.com';
  v_seat         int  := 12;  -- desk/seat to show on website flow
  v_empcode      text := '0002';
  v_uid          uuid;
  v_member_no    int;
  v_payment_id   uuid;
  v_membership_id uuid;
  v_today        date := (timezone('Asia/Kolkata', now()))::date;
  v_raw_inout    jsonb;
  v_raw_punch    jsonb;
begin
  select p.user_id, p.member_number
    into v_uid, v_member_no
  from public.profiles p
  where lower(coalesce(p.email, '')) = lower(trim(v_test_email))
  limit 1;

  if v_uid is null then
    raise exception 'No profile for email %. Use a registered user email, or change the query to filter by member_number instead.', v_test_email;
  end if;

  -- Optional: unblock KYC-gated UI during manual testing (requires verification_* columns)
  update public.profiles
  set
    verification_status = 'approved',
    verification_reviewed_at = coalesce(verification_reviewed_at, now()),
    updated_at = now()
  where user_id = v_uid;

  -- Device code → internal member number (eTime sends "0002" → int 2; library allows 0–9999)
  insert into public.etime_empcode_map (empcode, member_number, notes)
  values (v_empcode, v_member_no, 'test seed: link device Empcode to member')
  on conflict (empcode) do update
    set member_number = excluded.member_number,
        notes = excluded.notes;

  -- Paid test payment + active short-term membership with a seat (mirrors Razorpay success path)
  insert into public.payments (
    user_id,
    membership_id,
    amount_rupees,
    currency,
    provider,
    provider_payment_id,
    status,
    metadata
  )
  values (
    v_uid,
    null,
    100,
    'INR',
    'test_seed',
    'test_seed_' || substr(md5(random()::text), 1, 12),
    'paid',
    jsonb_build_object('note', 'SQL test seed — not a real Razorpay charge')
  )
  returning id into v_payment_id;

  insert into public.memberships (
    user_id,
    plan_kind,
    status,
    seat_number,
    seat_label,
    starts_at,
    ends_at,
    payment_id,
    notes
  )
  values (
    v_uid,
    'short_term',
    'active',
    v_seat,
    'S(' || v_seat::text || ')',
    timezone('Asia/Kolkata', now()),
    timezone('Asia/Kolkata', now()) + interval '24 hours',
    v_payment_id,
    'test seed: Empcode ' || v_empcode || ' → member ' || v_member_no::text || ', seat ' || v_seat::text
  )
  returning id into v_membership_id;

  update public.payments
  set membership_id = v_membership_id,
      updated_at = now()
  where id = v_payment_id;

  -- Sample B1-style row (what DownloadInOutPunchData returns) stored for this member_number
  v_raw_inout := jsonb_build_object(
    'Empcode', v_empcode,
    'INTime', '09:15',
    'OUTTime', '18:05',
    'WorkTime', '08:30',
    'OverTime', '00:00',
    'BreakTime', '00:45',
    'Status', 'P',
    'DateString', to_char(v_today, 'DD/MM/YYYY'),
    'Remark', 'TEST-SEED',
    'Erl_Out', '00:00',
    'Late_In', '00:00',
    'Name', 'Test Member (seed)'
  );

  insert into public.etime_attendance_daily (
    member_number,
    work_date,
    in_time,
    out_time,
    work_time,
    overtime,
    break_time,
    status,
    remark,
    late_in,
    erl_out,
    raw
  )
  values (
    v_member_no,
    v_today,
    '09:15',
    '18:05',
    '08:30',
    '00:00',
    '00:45',
    'P',
    'TEST-SEED',
    '00:00',
    '00:00',
    v_raw_inout
  )
  on conflict (member_number, work_date) do update
    set in_time = excluded.in_time,
        out_time = excluded.out_time,
        work_time = excluded.work_time,
        overtime = excluded.overtime,
        break_time = excluded.break_time,
        status = excluded.status,
        remark = excluded.remark,
        late_in = excluded.late_in,
        erl_out = excluded.erl_out,
        raw = excluded.raw,
        fetched_at = now();

  -- Sample B2-style raw punches (unique on member_number, punch_at, mcid)
  v_raw_punch := jsonb_build_object(
    'Name', 'Test Member (seed)',
    'Empcode', v_empcode,
    'PunchDate', to_char(v_today, 'DD/MM/YYYY') || ' 09:15:00',
    'M_Flag', null,
    'mcid', '1'
  );

  insert into public.etime_punch_raw (member_number, punch_at, mcid, raw)
  values (
    v_member_no,
    ((v_today + time '09:15:00') at time zone 'Asia/Kolkata'),
    '1',
    v_raw_punch
  )
  on conflict (member_number, punch_at, mcid) do nothing;

  insert into public.etime_punch_raw (member_number, punch_at, mcid, raw)
  values (
    v_member_no,
    ((v_today + time '18:05:00') at time zone 'Asia/Kolkata'),
    '1',
    v_raw_punch || jsonb_build_object('PunchDate', to_char(v_today, 'DD/MM/YYYY') || ' 18:05:00')
  )
  on conflict (member_number, punch_at, mcid) do nothing;

  raise notice 'OK: user_id=% member_number=% empcode=% seat=% payment_id=% membership_id=%',
    v_uid, v_member_no, v_empcode, v_seat, v_payment_id, v_membership_id;
end $$;

-- -----------------------------------------------------------------------------
-- Optional: inspect what was written (same session)
-- -----------------------------------------------------------------------------
-- select * from public.etime_empcode_map where empcode = '0002';
-- select * from public.memberships where seat_number = 12 order by created_at desc limit 3;
-- select * from public.etime_attendance_daily order by work_date desc limit 5;
-- select * from public.etime_punch_raw order by punch_at desc limit 10;
