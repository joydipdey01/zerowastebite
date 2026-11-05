-- ZeroWasteBite v2 upgrade. Run in Supabase > SQL Editor > New query, AFTER schema.sql. Safe to run again if it stops part-way.
-- Adds: supplier/ngo/buyer roles, FSSAI verification + private document storage, discounted sales, orders, new impact numbers.

-- ---------- roles and supplier verification ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles disable trigger lock_profile;   -- this trigger blocks role changes, so pause it for the one-time rename
update public.profiles set role = 'supplier' where role not in ('ngo','buyer','supplier');
alter table public.profiles enable trigger lock_profile;
alter table public.profiles add constraint profiles_role_check check (role in ('supplier','ngo','buyer'));
alter table public.profiles alter column role set default 'buyer';
alter table public.profiles
  add column if not exists fssai_no text check (fssai_no is null or fssai_no ~ '^[0-9]{14}$'),
  add column if not exists fssai_doc_path text,
  add column if not exists verified boolean not null default false,
  add column if not exists privacy_version text;

-- ---------- listings: free or discounted ----------
alter table public.donations
  add column if not exists kind text not null default 'free' check (kind in ('free','discount')),
  add column if not exists orig_price numeric(8,2), add column if not exists price numeric(8,2),
  add column if not exists left_qty int,
  add column if not exists donor_fssai text, add column if not exists donor_verified boolean not null default false;
alter table public.donations drop constraint if exists donations_price_check;
alter table public.donations add constraint donations_price_check
  check (kind = 'free' or (orig_price is not null and price is not null and price > 0 and price < orig_price));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text, buyer_phone text,
  qty int not null check (qty >= 1),
  unit_price numeric(8,2) not null, total numeric(10,2) not null, fee numeric(10,2) not null,
  status text not null default 'reserved' check (status in ('reserved','completed','cancelled')),
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_donation_idx on public.orders (donation_id);

-- ---------- helpers ----------
create or replace function public.is_buyer() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'buyer' and privacy_accepted_at is not null) $$;
-- is_donor() now means: a supplier who accepted the policy and submitted FSSAI number + certificate
create or replace function public.is_donor() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'supplier' and privacy_accepted_at is not null and fssai_no is not null and fssai_doc_path is not null) $$;
create or replace function public.has_order(p_id uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from orders where donation_id = p_id and buyer_id = auth.uid()) $$;
create or replace function public.owns_donation(p_id uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from donations where id = p_id and donor_id = auth.uid()) $$;

-- ---------- triggers ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := case new.raw_user_meta_data->>'role' when 'ngo' then 'ngo' when 'supplier' then 'supplier' else 'buyer' end;
begin
  insert into profiles (id, role, full_name, org_name, phone, email, fssai_no) values (
    new.id, r,
    left(new.raw_user_meta_data->>'full_name', 100),
    left(new.raw_user_meta_data->>'org_name', 120),
    coalesce(nullif(new.phone,''), left(new.raw_user_meta_data->>'phone', 20)),
    new.email,
    case when r = 'supplier' and new.raw_user_meta_data->>'fssai_no' ~ '^[0-9]{14}$' then new.raw_user_meta_data->>'fssai_no' end);
  return new;
end $$;

create or replace function public.lock_profile() returns trigger language plpgsql as $$
begin
  new.id := old.id; new.role := old.role; new.created_at := old.created_at;
  if auth.uid() is not null then new.verified := old.verified; end if;   -- only an admin (SQL editor) can verify
  if new.fssai_no is distinct from old.fssai_no or new.fssai_doc_path is distinct from old.fssai_doc_path then new.verified := false; end if;
  return new;
end $$;

create or replace function public.donation_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if new.best_before <= now() then raise exception 'Best-before time must be in the future.'; end if;
  select * into p from profiles where id = new.donor_id;
  new.donor_name := coalesce(nullif(p.org_name,''), p.full_name);
  new.donor_fssai := p.fssai_no; new.donor_verified := p.verified;
  new.status := 'available'; new.accepted_by := null; new.accepted_at := null; new.completed_at := null;
  new.people_served := null; new.waste_kg := null; new.ngo_name := null; new.ngo_phone := null;
  new.left_qty := case when new.kind = 'discount' then new.servings else null end;
  return new;
end $$;

-- only FREE listings alert NGOs (within 50 km, or all NGOs when a location is unknown)
create or replace function public.donation_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'free' then
    insert into notifications (user_id, donation_id, title, body)
    select p.id, new.id, 'New surplus food available', new.title || ', ' || new.servings || ' servings, ' || new.address
    from profiles p
    where p.role = 'ngo' and p.privacy_accepted_at is not null
      and (new.lat is null or p.lat is null or distance_km(p.lat, p.lng, new.lat, new.lng) <= 50);
  end if;
  return new;
end $$;

-- ---------- RPCs ----------
create or replace function public.accept_donation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare d donations; n profiles;
begin
  if not is_ngo() then raise exception 'Only NGO accounts can accept pickups.'; end if;
  select * into n from profiles where id = auth.uid();
  update donations set status='accepted', accepted_by=auth.uid(), accepted_at=now(),
         ngo_name = coalesce(nullif(n.org_name,''), n.full_name), ngo_phone = n.phone
   where id = p_id and kind='free' and status='available' and best_before > now() returning * into d;
  if d.id is null then raise exception 'This donation was already accepted, cancelled or has expired.'; end if;
  insert into notifications (user_id, donation_id, title, body)
  values (d.donor_id, d.id, 'Your donation was accepted', d.ngo_name || ' will collect "' || d.title || '".');
end $$;

create or replace function public.complete_donation(p_id uuid, p_people int) returns void language plpgsql security definer set search_path = public as $$
declare d donations;
begin
  update donations set status='completed', completed_at=now(), people_served = greatest(coalesce(p_people, servings),0),
         waste_kg = coalesce(weight_kg, round(servings * 0.35, 2))   -- keep 0.35 in sync with KG_PER_SERVING in js/config.js
   where id = p_id and kind='free' and accepted_by = auth.uid() and status='accepted' returning * into d;
  if d.id is null then raise exception 'Pickup not found or already completed.'; end if;
  insert into notifications (user_id, donation_id, title, body)
  values (d.donor_id, d.id, 'Food distributed', '"' || d.title || '" reached ' || d.people_served || ' people. Thank you!');
end $$;

create or replace function public.cancel_donation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare d donations;
begin
  update donations set status='cancelled' where id = p_id and donor_id = auth.uid() and status in ('available','accepted') returning * into d;
  if d.id is null then raise exception 'This listing cannot be cancelled.'; end if;
  if d.accepted_by is not null then
    insert into notifications (user_id, donation_id, title, body) values (d.accepted_by, d.id, 'Pickup cancelled', 'The donor cancelled "' || d.title || '".');
  end if;
  insert into notifications (user_id, donation_id, title, body)
    select buyer_id, d.id, 'Reservation cancelled', 'The supplier cancelled "' || d.title || '".' from orders where donation_id = p_id and status = 'reserved';
  update orders set status = 'cancelled' where donation_id = p_id and status = 'reserved';
end $$;

create or replace function public.reserve_donation(p_id uuid, p_qty int) returns void language plpgsql security definer set search_path = public as $$
declare d donations; b profiles; bn text;
begin
  if not is_buyer() then raise exception 'Only buyer accounts can reserve meals.'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'Choose at least 1 portion.'; end if;
  select * into b from profiles where id = auth.uid();
  update donations set left_qty = left_qty - p_qty
   where id = p_id and kind='discount' and status='available' and best_before > now() and left_qty >= p_qty returning * into d;
  if d.id is null then raise exception 'Not enough portions left, or the listing has expired.'; end if;
  bn := coalesce(nullif(b.full_name,''), 'A buyer');
  insert into orders (donation_id, buyer_id, buyer_name, buyer_phone, qty, unit_price, total, fee)
  values (d.id, auth.uid(), bn, b.phone, p_qty, d.price, d.price * p_qty,
          round(d.price * p_qty * 0.10, 2));   -- keep 0.10 in sync with SERVICE_FEE_PCT in js/config.js
  insert into notifications (user_id, donation_id, title, body)
  values (d.donor_id, d.id, 'New reservation', bn || ' reserved ' || p_qty || ' x "' || d.title || '".');
end $$;

create or replace function public.complete_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders; t text;
begin
  update orders set status='completed', completed_at=now() where id = p_id and status='reserved' and owns_donation(donation_id) returning * into o;
  if o.id is null then raise exception 'Order not found or already closed.'; end if;
  select title into t from donations where id = o.donation_id;
  insert into notifications (user_id, donation_id, title, body)
  values (o.buyer_id, o.donation_id, 'Pickup recorded', 'Your order for "' || t || '" was marked as picked up. Enjoy your meal!');
end $$;

create or replace function public.cancel_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders; d donations;
begin
  update orders set status='cancelled' where id = p_id and status='reserved' and (buyer_id = auth.uid() or owns_donation(donation_id)) returning * into o;
  if o.id is null then raise exception 'This order cannot be cancelled.'; end if;
  update donations set left_qty = left_qty + o.qty where id = o.donation_id returning * into d;
  insert into notifications (user_id, donation_id, title, body)
  values (case when auth.uid() = o.buyer_id then d.donor_id else o.buyer_id end, d.id, 'Order cancelled', 'An order for "' || d.title || '" was cancelled.');
end $$;

-- impact now includes completed sales: suppliers see revenue after fee, buyers see money saved
drop function if exists public.impact_series(text);
create or replace function public.impact_series(p_unit text) returns table (bucket date, pickups bigint, meals bigint, people bigint, kg numeric, amount numeric)
language sql stable security definer set search_path = public as $$
  with ev as (
    select completed_at t, servings m, coalesce(people_served, servings) p, coalesce(waste_kg, 0) k, 0::numeric a
      from donations where kind='free' and status='completed' and (donor_id = auth.uid() or accepted_by = auth.uid())
    union all
    select o.completed_at, o.qty, o.qty, round(o.qty * 0.35, 2),
           case when d.donor_id = auth.uid() then o.total - o.fee else o.qty * (d.orig_price - d.price) end
      from orders o join donations d on d.id = o.donation_id
     where o.status='completed' and (d.donor_id = auth.uid() or o.buyer_id = auth.uid()))
  select date_trunc(p_unit, t)::date, count(*), sum(m)::bigint, sum(p)::bigint, coalesce(sum(k),0), coalesce(sum(a),0)
  from ev
  where p_unit in ('day','month','year')
    and t >= case p_unit when 'day' then now() - interval '30 days' when 'month' then now() - interval '12 months' else now() - interval '5 years' end
  group by 1 order by 1 $$;

create or replace function public.platform_totals() returns table (pickups bigint, meals bigint, people bigint, kg numeric)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(m),0)::bigint, coalesce(sum(p),0)::bigint, coalesce(sum(k),0) from (
    select servings m, coalesce(people_served, servings) p, coalesce(waste_kg, 0) k from donations where kind='free' and status='completed'
    union all select qty, qty, round(qty * 0.35, 2) from orders where status='completed') x $$;

-- ---------- Row Level Security ----------
alter table public.orders enable row level security;
drop policy if exists "orders read" on public.orders;
create policy "orders read" on public.orders for select to authenticated using (buyer_id = auth.uid() or owns_donation(donation_id));

drop policy if exists "donations read" on public.donations;
create policy "donations read" on public.donations for select to authenticated using (
  donor_id = auth.uid() or accepted_by = auth.uid() or has_order(id)
  or (status = 'available' and kind = 'free' and is_ngo())
  or (status = 'available' and kind = 'discount' and is_buyer()));

drop policy if exists "contact read" on public.donation_contacts;
create policy "contact read" on public.donation_contacts for select to authenticated using (
  has_order(donation_id) or exists (select 1 from donations d where d.id = donation_id and (d.donor_id = auth.uid() or d.accepted_by = auth.uid())));

-- ---------- private storage for FSSAI certificates (own folder only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fssai-docs', 'fssai-docs', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
drop policy if exists "own fssai insert" on storage.objects;
create policy "own fssai insert" on storage.objects for insert to authenticated with check (bucket_id = 'fssai-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own fssai read" on storage.objects;
create policy "own fssai read" on storage.objects for select to authenticated using (bucket_id = 'fssai-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own fssai update" on storage.objects;
create policy "own fssai update" on storage.objects for update to authenticated using (bucket_id = 'fssai-docs' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'fssai-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own fssai delete" on storage.objects;
create policy "own fssai delete" on storage.objects for delete to authenticated using (bucket_id = 'fssai-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- permissions ----------
revoke execute on function public.is_buyer(), public.has_order(uuid), public.owns_donation(uuid), public.reserve_donation(uuid,int),
  public.complete_order(uuid), public.cancel_order(uuid), public.impact_series(text) from public, anon;
grant execute on function public.is_buyer(), public.has_order(uuid), public.owns_donation(uuid), public.reserve_donation(uuid,int),
  public.complete_order(uuid), public.cancel_order(uuid), public.impact_series(text) to authenticated;
grant select on public.orders to authenticated;
grant update (fssai_no, fssai_doc_path, privacy_version) on public.profiles to authenticated;

do $$ begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end $$;

-- To verify a supplier after checking their certificate (Storage > fssai-docs > <user id> > fssai):
--   update public.profiles set verified = true where id = '<supplier user id>';
