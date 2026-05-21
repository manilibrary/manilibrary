-- Member testimonials stored on profiles (one feedback per user).

alter table public.profiles
  add column if not exists user_feedback_rating smallint
    check (user_feedback_rating is null or (user_feedback_rating >= 1 and user_feedback_rating <= 5)),
  add column if not exists user_feedback_comment text
    check (user_feedback_comment is null or char_length(user_feedback_comment) <= 1000),
  add column if not exists user_feedback_submitted_at timestamptz,
  add column if not exists user_feedback_approved boolean not null default false;

create index if not exists profiles_feedback_approved_idx
  on public.profiles (user_feedback_approved)
  where user_feedback_rating is not null
    and user_feedback_comment is not null
    and deleted_at is null;
