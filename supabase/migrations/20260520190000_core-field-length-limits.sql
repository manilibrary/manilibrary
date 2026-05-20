-- Field-length limits (safety net). Keep in sync with src/lib/security/field-limits.ts

-- profiles
alter table public.profiles
  add constraint profiles_full_name_trim_len_check
    check (char_length(trim(full_name)) >= 2 and char_length(trim(full_name)) <= 100),
  add constraint profiles_phone_len_check
    check (phone is null or char_length(phone) <= 40),
  add constraint profiles_email_len_check
    check (email is null or char_length(trim(email)) <= 254),
  add constraint profiles_avatar_url_len_check
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  add constraint profiles_profile_extras_size_check
    check (octet_length(profile_extras::text) <= 24576),
  add constraint profiles_profile_pii_cipher_size_check
    check (profile_pii_cipher is null or octet_length(profile_pii_cipher) <= 32768);

-- verification
alter table public.verification
  add constraint verification_student_message_len_check
    check (student_message is null or char_length(student_message) <= 2000),
  add constraint verification_admin_note_cipher_size_check
    check (admin_internal_note_cipher is null or octet_length(admin_internal_note_cipher) <= 32768),
  add constraint verification_resubmit_count_bounds
    check (resubmit_count >= 0 and resubmit_count <= 100);

-- verification_documents
alter table public.verification_documents
  add constraint verification_documents_bucket_len_check
    check (char_length(storage_bucket) <= 128),
  add constraint verification_documents_path_len_check
    check (char_length(storage_path) <= 1024),
  add constraint verification_documents_content_type_len_check
    check (char_length(content_type) <= 128);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'verification_documents' and column_name = 'original_filename'
  ) then
    alter table public.verification_documents
      add constraint verification_documents_original_filename_len_check
        check (original_filename is null or char_length(original_filename) <= 256);
  end if;
end $$;

-- memberships
alter table public.memberships
  add constraint memberships_seat_number_len_check
    check (seat_number is null or char_length(seat_number) <= 64),
  add constraint memberships_notes_len_check
    check (notes is null or char_length(notes) <= 4000);

-- payments
alter table public.payments
  add constraint payments_currency_len_check
    check (char_length(trim(currency)) = 3),
  add constraint payments_provider_len_check
    check (provider is null or char_length(provider) <= 64),
  add constraint payments_provider_payment_id_len_check
    check (provider_payment_id is null or char_length(provider_payment_id) <= 255),
  add constraint payments_idempotency_key_len_check
    check (idempotency_key is null or char_length(idempotency_key) <= 128),
  add constraint payments_metadata_size_check
    check (octet_length(metadata::text) <= 32768),
  add constraint payments_amount_rupees_bounds
    check (amount_rupees >= 0 and amount_rupees <= 999999999999);

-- membership_events
alter table public.membership_events
  add constraint membership_events_old_status_len_check
    check (old_status is null or char_length(old_status) <= 64),
  add constraint membership_events_new_status_len_check
    check (new_status is null or char_length(new_status) <= 64),
  add constraint membership_events_note_len_check
    check (note is null or char_length(note) <= 4000);

-- attendance_days
alter table public.attendance_days
  add constraint attendance_days_device_from_dmy_len_check
    check (char_length(device_from_dmy) <= 32),
  add constraint attendance_days_device_to_dmy_len_check
    check (char_length(device_to_dmy) <= 32),
  add constraint attendance_days_source_len_check
    check (char_length(source) <= 128),
  add constraint attendance_days_processed_by_full_name_len_check
    check (processed_by_full_name is null or char_length(processed_by_full_name) <= 100),
  add constraint attendance_days_items_size_check
    check (octet_length(items::text) <= 1048576),
  add constraint attendance_days_member_rows_size_check
    check (octet_length(member_rows::text) <= 1048576);

-- library_export_audit
alter table public.library_export_audit
  add constraint library_export_audit_full_name_len_check
    check (full_name is null or char_length(full_name) <= 100);

-- device_api_records
alter table public.device_api_records
  add constraint device_api_records_empcode_len_check
    check (char_length(empcode) <= 64),
  add constraint device_api_records_mcid_len_check
    check (char_length(mcid) <= 128),
  add constraint device_api_records_raw_size_check
    check (octet_length(raw::text) <= 65536);

-- etime_empcode_map
alter table public.etime_empcode_map
  add constraint etime_empcode_map_empcode_len_check
    check (char_length(empcode) <= 64),
  add constraint etime_empcode_map_notes_len_check
    check (notes is null or char_length(notes) <= 4000);

-- member_manual_import
alter table public.member_manual_import
  add constraint member_manual_import_full_name_len_check
    check (full_name is null or char_length(full_name) <= 100),
  add constraint member_manual_import_phone_len_check
    check (phone is null or char_length(phone) <= 40),
  add constraint member_manual_import_email_len_check
    check (email is null or char_length(email) <= 254),
  add constraint member_manual_import_suggested_empcode_len_check
    check (suggested_empcode is null or char_length(suggested_empcode) <= 64),
  add constraint member_manual_import_notes_len_check
    check (notes is null or char_length(notes) <= 4000),
  add constraint member_manual_import_error_message_len_check
    check (error_message is null or char_length(error_message) <= 2000),
  add constraint member_manual_import_raw_row_size_check
    check (octet_length(raw_row::text) <= 24576);

-- device_api_sync_state
alter table public.device_api_sync_state
  add constraint device_api_sync_state_empcode_len_check
    check (char_length(empcode) <= 64),
  add constraint device_api_sync_state_last_cursor_len_check
    check (char_length(last_cursor) <= 2048);

-- plans / shifts / feedback (20260520120000 — skip if not applied yet)
do $$
begin
  if to_regclass('public.library_settings') is not null then
    alter table public.library_settings
      add constraint library_settings_timezone_len_check
        check (char_length(library_timezone) <= 64);
  end if;
  if to_regclass('public.library_shifts') is not null then
    alter table public.library_shifts
      add constraint library_shifts_code_len_check check (char_length(code) <= 64),
      add constraint library_shifts_display_name_len_check check (char_length(display_name) <= 120);
  end if;
  if to_regclass('public.plan_catalog') is not null then
    alter table public.plan_catalog
      add constraint plan_catalog_duration_key_len_check check (char_length(duration_key) <= 80),
      add constraint plan_catalog_label_len_check check (char_length(label) <= 200);
  end if;
  if to_regclass('public.member_feedback') is not null then
    alter table public.member_feedback
      add constraint member_feedback_entries_size_check check (octet_length(entries::text) <= 262144);
  end if;
end $$;
