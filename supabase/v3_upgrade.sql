-- ZeroWasteBite v3 upgrade. Run in Supabase > SQL Editor > New query, AFTER schema.sql and upgrade.sql. Safe to run again.
-- Adds: FSSAI removal (any vendor can list), food reports with photo, star ratings, warnings and bans,
--       notification types (popups) and the secure admin back end (all admin secrets live only in the database).

create extension if not exists pgcrypto;

-- ---------- 1. new columns ----------
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists warnings int not null default 0,          -- confirmed spoiled-food reports against a supplier
  add column if not exists fake_reports int not null default 0,      -- reports an admin found to be fake
  add column if not exists rating_avg numeric(3,2) not null default 0,
  add column if not exists rating_count int not null default 0;

alter table public.notifications
  add column if not exists kind text not null default 'info';
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('info','greeting','thanks','warning','rating','report'));

-- ---------- 2. helpers (banned accounts lose all access) ----------
create or replace function public.is_ngo() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'ngo' and privacy_accepted_at is not null and not banned) $$;
create or replace function public.is_buyer() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'buyer' and privacy_accepted_at is not null and not banned) $$;
-- is_donor() now means: any supplier (restaurant, cafe, food vendor, event organiser) who accepted the policy. No licence needed.
create or replace function public.is_donor() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'supplier' and privacy_accepted_at is not null and not banned) $$;

-- ---------- 3. remove FSSAI completely ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := case new.raw_user_meta_data->>'role' when 'ngo' then 'ngo' when 'supplier' then 'supplier' else 'buyer' end;
begin
  insert into profiles (id, role, full_name, org_name, phone, email) values (
    new.id, r,
    left(new.raw_user_meta_data->>'full_name', 100),
    left(new.raw_user_meta_data->>'org_name', 120),
    coalesce(nullif(new.phone,''), left(new.raw_user_meta_data->>'phone', 20)),
    new.email);
  return new;
end $$;

-- users can never change their own role, warnings, bans or ratings. Admin and system functions set zwb.sys to bypass this.
create or replace function public.lock_profile() returns trigger language plpgsql as $$
begin
  new.id := old.id; new.created_at := old.created_at;
  if auth.uid() is not null and coalesce(current_setting('zwb.sys', true), '') <> '1' then
    new.role := old.role; new.banned := old.banned; new.warnings := old.warnings; new.fake_reports := old.fake_reports;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
  end if;
  return new;
end $$;

create or replace function public.donation_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if new.best_before <= now() then raise exception 'Best-before time must be in the future.'; end if;
  select * into p from profiles where id = new.donor_id;
  new.donor_name := coalesce(nullif(p.org_name,''), p.full_name);
  new.status := 'available'; new.accepted_by := null; new.accepted_at := null; new.completed_at := null;
  new.people_served := null; new.waste_kg := null; new.ngo_name := null; new.ngo_phone := null;
  new.left_qty := case when new.kind = 'discount' then new.servings else null end;
  return new;
end $$;

alter table public.donations drop column if exists donor_fssai, drop column if exists donor_verified;
alter table public.profiles drop column if exists fssai_no, drop column if exists fssai_doc_path, drop column if exists verified;

drop policy if exists "own fssai insert" on storage.objects;
drop policy if exists "own fssai read" on storage.objects;
drop policy if exists "own fssai update" on storage.objects;
drop policy if exists "own fssai delete" on storage.objects;
-- Also delete the old "fssai-docs" bucket in Supabase > Storage (this removes the stored certificates).

-- ---------- 4. ratings and reports ----------
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  rater_name text,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (donation_id, rater_id)
);
create index if not exists ratings_supplier_idx on public.ratings (supplier_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_name text, reporter_role text,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 10 and 600),
  photo text not null check (char_length(photo) <= 600000 and photo like 'data:image/%'),
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  admin_note text, resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (donation_id, reporter_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.ratings enable row level security;
alter table public.reports enable row level security;
drop policy if exists "ratings read" on public.ratings;
create policy "ratings read" on public.ratings for select to authenticated using (rater_id = auth.uid() or supplier_id = auth.uid());
drop policy if exists "reports read" on public.reports;
create policy "reports read" on public.reports for select to authenticated using (reporter_id = auth.uid());
grant select on public.ratings to authenticated;
grant select (id, donation_id, reporter_id, reporter_name, reporter_role, supplier_id, reason, status, created_at, resolved_at) on public.reports to authenticated;  -- never the photo column

-- ---------- 5. user functions: rate and report ----------
create or replace function public.supplier_ratings(p_ids uuid[]) returns table (id uuid, rating numeric, cnt int)
language sql stable security definer set search_path = public as
$$ select id, rating_avg, rating_count from profiles where id = any(p_ids) and role = 'supplier' $$;

-- may this signed-in user rate or report this listing? (NGO that accepted it, or buyer with an active/completed order)
create or replace function public._can_review(p_donation uuid, p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from donations d join profiles u on u.id = p_user
                  where d.id = p_donation and not u.banned and u.privacy_accepted_at is not null and (
                    (u.role = 'ngo' and d.accepted_by = u.id and d.status in ('accepted','completed'))
                    or (u.role = 'buyer' and exists (select 1 from orders o where o.donation_id = d.id and o.buyer_id = u.id and o.status in ('reserved','completed')))))
$$;

create or replace function public.rate_food(p_id uuid, p_stars int) returns void language plpgsql security definer set search_path = public as $$
declare d donations; me profiles; nm text; had int;
begin
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
  if not _can_review(p_id, auth.uid()) then raise exception 'You can rate food only after you accept or buy it.'; end if;
  select * into d from donations where id = p_id;
  select * into me from profiles where id = auth.uid();
  nm := coalesce(nullif(me.org_name,''), nullif(me.full_name,''), 'A user');
  select stars into had from ratings where donation_id = d.id and rater_id = me.id;
  insert into ratings (donation_id, rater_id, rater_name, supplier_id, stars) values (d.id, me.id, nm, d.donor_id, p_stars)
    on conflict (donation_id, rater_id) do update set stars = excluded.stars, created_at = now();
  perform set_config('zwb.sys', '1', true);
  update profiles p set rating_count = x.c, rating_avg = x.a
    from (select count(*)::int c, coalesce(round(avg(stars), 2), 0) a from ratings where supplier_id = d.donor_id) x where p.id = d.donor_id;
  insert into notifications (user_id, donation_id, kind, title, body) values (d.donor_id, d.id, 'rating',
    case when had is null then nm || ' rated you ' else nm || ' changed their rating to ' end || p_stars || case when p_stars = 1 then ' star' else ' stars' end,
    '"' || d.title || '" received ' || p_stars || ' out of 5.');
end $$;

create or replace function public.report_food(p_id uuid, p_reason text, p_photo text) returns void language plpgsql security definer set search_path = public as $$
declare d donations; me profiles; nm text;
begin
  p_reason := trim(coalesce(p_reason, ''));
  if char_length(p_reason) < 10 then raise exception 'Please explain the problem in at least 10 characters.'; end if;
  if p_photo is null or p_photo not like 'data:image/%' or char_length(p_photo) > 600000 then raise exception 'A photo of the food is required.'; end if;
  if not _can_review(p_id, auth.uid()) then raise exception 'You can report food only after you accept or buy it.'; end if;
  select * into d from donations where id = p_id;
  select * into me from profiles where id = auth.uid();
  nm := coalesce(nullif(me.org_name,''), nullif(me.full_name,''), 'A user');
  begin
    insert into reports (donation_id, reporter_id, reporter_name, reporter_role, supplier_id, reason, photo)
    values (d.id, me.id, nm, me.role, d.donor_id, left(p_reason, 600), p_photo);
  exception when unique_violation then raise exception 'You have already reported this food.';
  end;
  insert into notifications (user_id, donation_id, kind, title, body) values (d.donor_id, d.id, 'report',
    nm || ' reported your food',
    nm || ' reported "' || d.title || '". Our admin team will review it. If the food is found to be spoiled you will get a final warning, and a repeat can lead to permanent removal from ZeroWasteBite.');
end $$;

-- ---------- 6. admin back end ----------
-- Admin ID, admin key and password are stored ONLY here, as bcrypt hashes, and are never in the website code.
create table if not exists public.admin_credentials (admin_id text primary key, key_hash text not null, pass_hash text not null, created_at timestamptz not null default now());
create table if not exists public.admin_sessions (token_hash text primary key, admin_id text not null, expires_at timestamptz not null, created_at timestamptz not null default now());
create table if not exists public.admin_attempts (id bigserial primary key, ip text not null, ok boolean not null, at timestamptz not null default now());
alter table public.admin_credentials enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_attempts enable row level security;
revoke all on public.admin_credentials, public.admin_sessions, public.admin_attempts from anon, authenticated;
revoke all on sequence public.admin_attempts_id_seq from anon, authenticated;

create or replace function public.admin_check(p_token text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare a text;
begin
  select admin_id into a from admin_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and expires_at > now();
  if a is null then raise exception 'Admin session expired. Please log in again.'; end if;
  perform set_config('zwb.sys', '1', true);
  return a;
end $$;

-- returns a session token, null for wrong details, or 'locked' after 5 failed tries from one address in 15 minutes
create or replace function public.admin_login(p_id text, p_key text, p_password text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare c admin_credentials; v_ip text; fails int; tok text; good boolean;
begin
  v_ip := coalesce(nullif(split_part(coalesce((coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json)->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  delete from admin_attempts where at < now() - interval '1 day';
  select count(*) into fails from admin_attempts where ip = v_ip and not ok and at > now() - interval '15 minutes';
  if fails >= 5 then return 'locked'; end if;
  select * into c from admin_credentials where admin_id = trim(coalesce(p_id, ''));
  if c.admin_id is null then perform crypt('x', gen_salt('bf', 10)); good := false;
  else good := c.key_hash = crypt(coalesce(p_key, ''), c.key_hash) and c.pass_hash = crypt(coalesce(p_password, ''), c.pass_hash); end if;
  if not good then insert into admin_attempts (ip, ok) values (v_ip, false); return null; end if;
  delete from admin_attempts where ip = v_ip;
  delete from admin_sessions where expires_at < now();
  tok := encode(gen_random_bytes(32), 'hex');
  insert into admin_sessions (token_hash, admin_id, expires_at) values (encode(digest(tok, 'sha256'), 'hex'), c.admin_id, now() + interval '2 hours');
  return tok;
end $$;

create or replace function public.admin_logout(p_token text) returns void language sql security definer set search_path = public, extensions as
$$ delete from admin_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') $$;

-- bans an account for good: it can never log in again, and its open listings and reservations are cancelled
create or replace function public._ban_user(p_uid uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  perform set_config('zwb.sys', '1', true);
  update profiles set banned = true where id = p_uid;
  update donations set status = 'cancelled' where donor_id = p_uid and status = 'available';
  insert into notifications (user_id, donation_id, kind, title, body)
    select o2.buyer_id, o2.donation_id, 'info', 'Reservation cancelled', 'The supplier is no longer on ZeroWasteBite, so your reservation was cancelled.'
    from orders o2 join donations d on d.id = o2.donation_id where d.donor_id = p_uid and o2.status = 'reserved';
  update orders set status = 'cancelled' where status = 'reserved' and donation_id in (select id from donations where donor_id = p_uid);
  for o in select * from orders where buyer_id = p_uid and status = 'reserved' loop
    update orders set status = 'cancelled' where id = o.id;
    update donations set left_qty = left_qty + o.qty where id = o.donation_id;
  end loop;
end $$;

create or replace function public._notify(p_uid uuid, p_donation uuid, p_kind text, p_title text, p_body text) returns void language sql security definer set search_path = public as
$$ insert into notifications (user_id, donation_id, kind, title, body) values (p_uid, p_donation, p_kind, p_title, p_body) $$;

create or replace function public.admin_overview(p_token text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_check(p_token);
  return jsonb_build_object(
    'users', (select count(*) from profiles), 'suppliers', (select count(*) from profiles where role = 'supplier'),
    'ngos', (select count(*) from profiles where role = 'ngo'), 'buyers', (select count(*) from profiles where role = 'buyer'),
    'banned', (select count(*) from profiles where banned), 'live', (select count(*) from donations where status = 'available' and best_before > now()),
    'listings', (select count(*) from donations), 'orders', (select count(*) from orders),
    'open_reports', (select count(*) from reports where status = 'open'), 'ratings', (select count(*) from ratings));
end $$;

create or replace function public.admin_reports(p_token text, p_status text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_check(p_token);
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select r.id, r.created_at, r.status, r.reason, r.admin_note, r.reporter_id, r.reporter_name, r.reporter_role, r.supplier_id,
           (select coalesce(nullif(org_name, ''), full_name) from profiles where id = r.supplier_id) as supplier_name,
           (select warnings from profiles where id = r.supplier_id) as supplier_warnings,
           (select fake_reports from profiles where id = r.reporter_id) as reporter_fakes,
           d.title as food, d.donor_name
    from reports r join donations d on d.id = r.donation_id
    where p_status = 'all' or r.status = p_status order by r.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_report_photo(p_token text, p_id uuid) returns text language plpgsql security definer set search_path = public, extensions as $$
declare p text;
begin perform admin_check(p_token); select photo into p from reports where id = p_id; return p; end $$;

-- verdict 'upheld' = food really was spoiled, 'dismissed' = report was fake
create or replace function public.admin_resolve_report(p_token text, p_id uuid, p_verdict text, p_note text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare r reports; s profiles; rp profiles; t text; note text;
begin
  perform admin_check(p_token);
  if p_verdict not in ('upheld', 'dismissed') then raise exception 'Choose a verdict.'; end if;
  note := nullif(trim(coalesce(p_note, '')), '');
  update reports set status = p_verdict, admin_note = note, resolved_at = now() where id = p_id and status = 'open' returning * into r;
  if r.id is null then raise exception 'Report not found or already reviewed.'; end if;
  select title into t from donations where id = r.donation_id;
  if p_verdict = 'upheld' then
    update profiles set warnings = warnings + 1 where id = r.supplier_id returning * into s;
    if s.warnings >= 2 then
      perform _ban_user(s.id);
      perform _notify(s.id, r.donation_id, 'warning', 'Your account has been removed',
        'Our admin team confirmed that "' || t || '" was spoiled. Because you had already received a final warning, your ZeroWasteBite account has been permanently removed.' || coalesce(' Admin note: ' || note, ''));
    else
      perform _notify(s.id, r.donation_id, 'warning', 'Final warning: spoiled food confirmed',
        'Our admin team reviewed the report on "' || t || '" and confirmed the food was spoiled. This is your last warning. If you do this again, your account will be removed from ZeroWasteBite forever.' || coalesce(' Admin note: ' || note, ''));
    end if;
    perform _notify(r.reporter_id, r.donation_id, 'thanks', 'Thank you for your report',
      'We reviewed your report on "' || t || '" and confirmed the food was spoiled. Action has been taken against the supplier. Thank you for helping keep ZeroWasteBite safe.');
  else
    perform _notify(r.supplier_id, r.donation_id, 'info', 'The earlier report was fake',
      'Our admin team reviewed the report on "' || t || '" and found it to be fake. No action will be taken against you. We are sorry for the trouble.' || coalesce(' Admin note: ' || note, ''));
    update profiles set fake_reports = fake_reports + 1 where id = r.reporter_id returning * into rp;
    if rp.fake_reports >= 2 then
      perform _ban_user(rp.id);
      perform _notify(rp.id, r.donation_id, 'warning', 'Your account has been removed',
        'Your report on "' || t || '" was found to be fake. Because you had already been warned, your ZeroWasteBite account has been permanently removed.');
    else
      perform _notify(rp.id, r.donation_id, 'warning', 'Warning: your report was found to be fake',
        'Our admin team reviewed your report on "' || t || '" and found that it was not genuine. If you submit a fake report once again, your account will be removed from ZeroWasteBite forever.' || coalesce(' Admin note: ' || note, ''));
    end if;
  end if;
end $$;

create or replace function public.admin_users(p_token text, p_q text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_check(p_token);
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select id, role, full_name, org_name, email, phone, banned, warnings, fake_reports, rating_avg, rating_count, created_at
    from profiles
    where coalesce(p_q, '') = '' or concat_ws(' ', id::text, full_name, org_name, email, phone) ilike '%' || p_q || '%'
    order by created_at desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.admin_user_action(p_token text, p_id uuid, p_action text) returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  perform admin_check(p_token);
  if p_action = 'warn' then
    update profiles set warnings = warnings + 1 where id = p_id;
    perform _notify(p_id, null, 'warning', 'Warning from ZeroWasteBite admin', 'Our admin team has issued a warning on your account. Please follow the platform rules. Repeated violations can lead to permanent removal.');
  elsif p_action = 'ban' then perform _ban_user(p_id);
  elsif p_action = 'unban' then update profiles set banned = false, warnings = 0, fake_reports = 0 where id = p_id;
  elsif p_action = 'delete' then delete from auth.users where id = p_id;
  else raise exception 'Unknown action.'; end if;
end $$;

-- generic reader/editor so the admin can see and change anything in the main tables
create or replace function public.admin_list(p_token text, p_table text, p_q text, p_limit int) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare res jsonb;
begin
  perform admin_check(p_token);
  if p_table <> all (array['profiles','donations','orders','reports','ratings','notifications']) then raise exception 'Table not allowed.'; end if;
  execute format($f$select coalesce(jsonb_agg(x order by ca desc), '[]'::jsonb) from (
      select (to_jsonb(t) - 'photo') as x, t.created_at as ca from public.%I t
      where $1 = '' or (to_jsonb(t) - 'photo')::text ilike '%%' || $1 || '%%' order by t.created_at desc limit $2) s$f$, p_table)
    into res using coalesce(p_q, ''), least(greatest(coalesce(p_limit, 50), 1), 200);
  return res;
end $$;

create or replace function public.admin_update(p_token text, p_table text, p_id uuid, p_changes jsonb) returns void language plpgsql security definer set search_path = public, extensions as $$
declare k text; v jsonb;
begin
  perform admin_check(p_token);
  if p_table <> all (array['profiles','donations','orders','reports','ratings','notifications']) then raise exception 'Table not allowed.'; end if;
  for k, v in select * from jsonb_each(p_changes) loop
    if k in ('id', 'created_at', 'photo') then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = k) then raise exception 'Unknown field: %', k; end if;
    execute format('update public.%I set %I = (jsonb_populate_record(null::public.%I, $1)).%I where id = $2', p_table, k, p_table, k) using jsonb_build_object(k, v), p_id;
  end loop;
end $$;

create or replace function public.admin_delete(p_token text, p_table text, p_id uuid) returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  perform admin_check(p_token);
  if p_table <> all (array['profiles','donations','orders','reports','ratings','notifications']) then raise exception 'Table not allowed.'; end if;
  if p_table = 'profiles' then delete from auth.users where id = p_id;
  else execute format('delete from public.%I where id = $1', p_table) using p_id; end if;
end $$;

-- send a notification to one user (id, email or phone), a whole role, or everyone. {name} in the text becomes the person's name.
create or replace function public.admin_notify(p_token text, p_scope text, p_value text, p_kind text, p_title text, p_body text) returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform admin_check(p_token);
  if p_kind not in ('info','greeting','thanks','warning') then raise exception 'Unknown message type.'; end if;
  p_title := trim(coalesce(p_title, '')); p_body := trim(coalesce(p_body, ''));
  if char_length(p_title) not between 1 and 120 then raise exception 'Title must be 1 to 120 characters.'; end if;
  if char_length(p_body) > 600 then raise exception 'Message must be 600 characters or fewer.'; end if;
  insert into notifications (user_id, kind, title, body)
  select id, p_kind, replace(p_title, '{name}', coalesce(nullif(full_name, ''), 'friend')), replace(p_body, '{name}', coalesce(nullif(full_name, ''), 'friend'))
  from profiles
  where not banned and case p_scope
      when 'all' then true
      when 'role' then role = p_value
      when 'user' then id::text = trim(p_value) or lower(email) = lower(trim(p_value)) or phone = trim(p_value)
      else false end;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- 7. permissions ----------
revoke execute on function public.admin_check(text), public._ban_user(uuid), public._notify(uuid,uuid,text,text,text), public._can_review(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.admin_login(text,text,text), public.admin_logout(text), public.admin_overview(text), public.admin_reports(text,text),
  public.admin_report_photo(text,uuid), public.admin_resolve_report(text,uuid,text,text), public.admin_users(text,text), public.admin_user_action(text,uuid,text),
  public.admin_list(text,text,text,int), public.admin_update(text,text,uuid,jsonb), public.admin_delete(text,text,uuid),
  public.admin_notify(text,text,text,text,text,text), public.rate_food(uuid,int), public.report_food(uuid,text,text), public.supplier_ratings(uuid[]) from public;
-- admin functions check the secret session token inside, so the browser may call them without a user account
grant execute on function public.admin_login(text,text,text), public.admin_logout(text), public.admin_overview(text), public.admin_reports(text,text),
  public.admin_report_photo(text,uuid), public.admin_resolve_report(text,uuid,text,text), public.admin_users(text,text), public.admin_user_action(text,uuid,text),
  public.admin_list(text,text,text,int), public.admin_update(text,text,uuid,jsonb), public.admin_delete(text,text,uuid),
  public.admin_notify(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.rate_food(uuid,int), public.report_food(uuid,text,text), public.supplier_ratings(uuid[]) to authenticated;
revoke execute on function public.rate_food(uuid,int), public.report_food(uuid,text,text), public.supplier_ratings(uuid[]) from anon;
