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
-- Before running:
--   1) Pick a real user: run in SQL Editor (separate query):
--        select device_user_id, email, full_name
--        from public.profiles
--        order by device_user_id nulls last
--        limit 30;
--   2) In the declare block below set EITHER
--        v_device_user_id := <that row's device_user_id>
--      OR leave v_device_user_id null and set
--        v_test_email := '<exact email from profiles>'
--   3) Adjust v_seat (integer; membership will store S(<v_seat>)) and v_empcode if needed.
--
-- CLEANUP (optional, before re-seeding): inspect rows then delete by id, or:
--   update public.memberships set payment_id = null where user_id = '...' and notes like 'test seed:%';
--   delete from public.payments where provider = 'test_seed' and user_id = '...';
--   delete from public.memberships where user_id = '...' and notes like 'test seed:%';
--   delete from public.etime_empcode_map where empcode = '0002';
--   delete from public.etime_attendance_daily where remark = 'TEST-SEED';
--   delete from public.etime_punch_raw where device_user_id = ... and punch_at::date = current_date;
-- =============================================================================

do $$
declare
  -- REQUIRED: set to a row that exists in public.profiles (see header comment for lookup SQL).
  -- Example: if your test user is member #35, use v_device_user_id := 35;
  v_device_user_id int  := null;
  -- If v_device_user_id is null, set this to that user's profiles.email (case-insensitive match).
  v_test_email      text := null;
  v_seat            int  := 12;  -- desk/seat to show on website flow
  v_empcode         text := '0002';
  v_uid             uuid;
  v_member_no       int;
  v_payment_id      uuid;
  v_membership_id   uuid;
  v_today           date := (timezone('Asia/Kolkata', now()))::date;
  v_raw_inout       jsonb;
  v_raw_punch       jsonb;
begin
  if v_device_user_id is null and (v_test_email is null or trim(v_test_email) = '') then
    raise exception
      'Seed not configured. In the declare block set v_device_user_id := <existing profiles.device_user_id> OR set v_test_email to a registered email. Lookup: select device_user_id, email, full_name from public.profiles order by device_user_id nulls last limit 30;';
  end if;

  if v_device_user_id is not null then
    select p.user_id, p.device_user_id
      into v_uid, v_member_no
    from public.profiles p
    where p.device_user_id = v_device_user_id
    limit 1;
  elsif v_test_email is not null and trim(v_test_email) <> '' then
    select p.user_id, p.device_user_id
      into v_uid, v_member_no
    from public.profiles p
    where lower(coalesce(p.email, '')) = lower(trim(v_test_email))
    limit 1;
  end if;

  if v_uid is null then
    raise exception
      'No profile matched your v_device_user_id (%) or v_test_email. Run: select device_user_id, email from public.profiles order by device_user_id nulls last limit 30; — then set v_device_user_id or v_test_email to a real row.',
      v_device_user_id;
  end if;

  -- Optional: unblock KYC-gated UI during manual testing (requires verification_* columns)
  update public.profiles
  set
    verification_status = 'approved',
    verification_reviewed_at = coalesce(verification_reviewed_at, now()),
    updated_at = now()
  where user_id = v_uid;

  -- Device code → internal member number (eTime sends "0002" → int 2; library allows 0–9999)
  insert into public.etime_empcode_map (empcode, device_user_id, notes)
  values (v_empcode, v_member_no, 'test seed: link device Empcode to member')
  on conflict (empcode) do update
    set device_user_id = excluded.device_user_id,
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
    starts_at,
    ends_at,
    payment_id,
    notes
  )
  values (
    v_uid,
    'short_term',
    'active',
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

  -- Sample B1-style row (what DownloadInOutPunchData returns) stored for this device_user_id
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
    device_user_id,
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
  on conflict (device_user_id, work_date) do update
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

  -- Sample B2-style raw punches (unique on device_user_id, punch_at, mcid)
  v_raw_punch := jsonb_build_object(
    'Name', 'Test Member (seed)',
    'Empcode', v_empcode,
    'PunchDate', to_char(v_today, 'DD/MM/YYYY') || ' 09:15:00',
    'M_Flag', null,
    'mcid', '1'
  );

  insert into public.etime_punch_raw (device_user_id, punch_at, mcid, raw)
  values (
    v_member_no,
    ((v_today + time '09:15:00') at time zone 'Asia/Kolkata'),
    '1',
    v_raw_punch
  )
  on conflict (device_user_id, punch_at, mcid) do nothing;

  insert into public.etime_punch_raw (device_user_id, punch_at, mcid, raw)
  values (
    v_member_no,
    ((v_today + time '18:05:00') at time zone 'Asia/Kolkata'),
    '1',
    v_raw_punch || jsonb_build_object('PunchDate', to_char(v_today, 'DD/MM/YYYY') || ' 18:05:00')
  )
  on conflict (device_user_id, punch_at, mcid) do nothing;

  raise notice 'OK: user_id=% device_user_id=% empcode=% seat=% payment_id=% membership_id=%',
    v_uid, v_member_no, v_empcode, v_seat, v_payment_id, v_membership_id;
end $$;

-- -----------------------------------------------------------------------------
-- Optional: inspect what was written (same session)
-- -----------------------------------------------------------------------------
-- select * from public.etime_empcode_map where empcode = '0002';
-- select * from public.memberships where seat_number = 'S(12)' order by created_at desc limit 3;
-- select * from public.etime_attendance_daily order by work_date desc limit 5;
-- select * from public.etime_punch_raw order by punch_at desc limit 10;
