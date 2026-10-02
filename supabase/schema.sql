-- ZeroWasteBite — Supabase schema. Run once in: Supabase Dashboard > SQL Editor > New query > Run.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'donor' check (role in ('donor','ngo')),
  full_name text, org_name text, phone text, email text, address text,
  lat double precision, lng double precision,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete cascade,
  donor_name text,
  title text not null check (char_length(title) between 2 and 120),
  category text not null default 'cooked' check (category in ('cooked','packaged','bakery','produce','other')),
  servings int not null check (servings between 1 and 10000),
  weight_kg numeric(8,2) check (weight_kg is null or weight_kg > 0),
  notes text check (char_length(notes) <= 500),
  address text not null check (char_length(address) between 5 and 300),
  lat double precision, lng double precision,
  best_before timestamptz not null,
  status text not null default 'available' check (status in ('available','accepted','completed','cancelled')),
  accepted_by uuid references public.profiles(id) on delete set null,
  ngo_name text, ngo_phone text, accepted_at timestamptz,
  completed_at timestamptz, people_served int check (people_served is null or people_served >= 0),
  waste_kg numeric(8,2),
  created_at timestamptz not null default now()
);
create index on public.donations (status, best_before);
create index on public.donations (donor_id);
create index on public.donations (accepted_by);

-- Donor phone: visible only to the donor and the NGO that accepted the pickup
create table public.donation_contacts (
  donation_id uuid primary key references public.donations(id) on delete cascade,
  phone text not null check (char_length(phone) <= 20)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete cascade,
  title text not null, body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- ---------- helpers ----------
create function public.distance_km(a1 double precision, o1 double precision, a2 double precision, o2 double precision)
returns double precision language sql immutable as $$
  select 12742 * asin(sqrt(sin(radians(a2-a1)/2)^2 + cos(radians(a1))*cos(radians(a2))*sin(radians(o2-o1)/2)^2)) $$;

create function public.is_ngo() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'ngo' and privacy_accepted_at is not null) $$;
create function public.is_donor() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'donor' and privacy_accepted_at is not null) $$;

-- ---------- new user -> profile ----------
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, org_name, phone, email) values (
    new.id,
    case when new.raw_user_meta_data->>'role' = 'ngo' then 'ngo' else 'donor' end,
    left(new.raw_user_meta_data->>'full_name', 100),
    left(new.raw_user_meta_data->>'org_name', 120),
    coalesce(nullif(new.phone,''), left(new.raw_user_meta_data->>'phone', 20)),
    new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.lock_profile() returns trigger language plpgsql as $$
begin new.id := old.id; new.role := old.role; new.created_at := old.created_at; return new; end $$;
create trigger lock_profile before update on public.profiles for each row execute function public.lock_profile();

-- ---------- donation triggers ----------
create function public.donation_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.best_before <= now() then raise exception 'Best-before time must be in the future.'; end if;
  select coalesce(nullif(org_name,''), full_name) into new.donor_name from profiles where id = new.donor_id;
  new.status := 'available'; new.accepted_by := null; new.accepted_at := null; new.completed_at := null;
  new.people_served := null; new.waste_kg := null; new.ngo_name := null; new.ngo_phone := null;
  return new;
end $$;
create trigger donation_before_insert before insert on public.donations for each row execute function public.donation_before_insert();

-- notify NGOs within 50 km (or all NGOs when a location is unknown)
create function public.donation_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, donation_id, title, body)
  select p.id, new.id, 'New surplus food available',
         new.title || ', ' || new.servings || ' servings, ' || new.address
  from profiles p
  where p.role = 'ngo' and p.privacy_accepted_at is not null
    and (new.lat is null or p.lat is null or distance_km(p.lat, p.lng, new.lat, new.lng) <= 50);
  return new;
end $$;
create trigger donation_after_insert after insert on public.donations for each row execute function public.donation_after_insert();

-- ---------- RPCs (all status changes go through these) ----------
create function public.accept_donation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare d donations; n profiles;
begin
  if not is_ngo() then raise exception 'Only NGO accounts can accept pickups.'; end if;
  select * into n from profiles where id = auth.uid();
  update donations set status='accepted', accepted_by=auth.uid(), accepted_at=now(),
         ngo_name = coalesce(nullif(n.org_name,''), n.full_name), ngo_phone = n.phone
   where id = p_id and status='available' and best_before > now() returning * into d;
  if d.id is null then raise exception 'This donation was already accepted, cancelled or has expired.'; end if;
  insert into notifications (user_id, donation_id, title, body)
  values (d.donor_id, d.id, 'Your donation was accepted', d.ngo_name || ' will collect "' || d.title || '".');
end $$;

create function public.complete_donation(p_id uuid, p_people int) returns void language plpgsql security definer set search_path = public as $$
declare d donations;
begin
  update donations set status='completed', completed_at=now(), people_served = greatest(coalesce(p_people, servings),0),
         waste_kg = coalesce(weight_kg, round(servings * 0.35, 2))   -- keep 0.35 in sync with KG_PER_SERVING in js/config.js
   where id = p_id and accepted_by = auth.uid() and status='accepted' returning * into d;
  if d.id is null then raise exception 'Pickup not found or already completed.'; end if;
  insert into notifications (user_id, donation_id, title, body)
  values (d.donor_id, d.id, 'Food distributed', '"' || d.title || '" reached ' || d.people_served || ' people. Thank you!');
end $$;

create function public.cancel_donation(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare d donations;
begin
  update donations set status='cancelled' where id = p_id and donor_id = auth.uid() and status in ('available','accepted') returning * into d;
  if d.id is null then raise exception 'This listing cannot be cancelled.'; end if;
  if d.accepted_by is not null then
    insert into notifications (user_id, donation_id, title, body) values (d.accepted_by, d.id, 'Pickup cancelled', 'The donor cancelled "' || d.title || '".');
  end if;
end $$;

-- impact for the signed-in user (donor: own donations, NGO: own pickups)
create function public.impact_series(p_unit text) returns table (bucket date, pickups bigint, meals bigint, people bigint, kg numeric)
language sql stable security definer set search_path = public as $$
  select date_trunc(p_unit, completed_at)::date, count(*), sum(servings)::bigint, sum(coalesce(people_served, servings))::bigint, coalesce(sum(waste_kg),0)
  from donations
  where p_unit in ('day','month','year') and status='completed' and (donor_id = auth.uid() or accepted_by = auth.uid())
    and completed_at >= case p_unit when 'day' then now() - interval '30 days' when 'month' then now() - interval '12 months' else now() - interval '5 years' end
  group by 1 order by 1 $$;

-- public, aggregate-only numbers for the login screen
create function public.platform_totals() returns table (pickups bigint, meals bigint, people bigint, kg numeric)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(servings),0)::bigint, coalesce(sum(coalesce(people_served, servings)),0)::bigint, coalesce(sum(waste_kg),0)
  from donations where status='completed' $$;

create function public.delete_my_account() returns void language sql security definer set search_path = public, auth as
$$ delete from auth.users where id = auth.uid() $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.donation_contacts enable row level security;
alter table public.notifications enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "donations read" on public.donations for select to authenticated using (
  donor_id = auth.uid() or accepted_by = auth.uid() or (status = 'available' and is_ngo()));
create policy "donor creates" on public.donations for insert to authenticated with check (donor_id = auth.uid() and is_donor());

create policy "contact read" on public.donation_contacts for select to authenticated using (
  exists (select 1 from donations d where d.id = donation_id and (d.donor_id = auth.uid() or d.accepted_by = auth.uid())));
create policy "contact insert" on public.donation_contacts for insert to authenticated with check (
  exists (select 1 from donations d where d.id = donation_id and d.donor_id = auth.uid()));

create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- function permissions ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_ngo(), public.is_donor(), public.distance_km(double precision,double precision,double precision,double precision) to authenticated;
grant execute on function public.accept_donation(uuid), public.complete_donation(uuid,int), public.cancel_donation(uuid),
  public.impact_series(text), public.delete_my_account() to authenticated;
grant execute on function public.platform_totals() to anon, authenticated;

-- ---------- table permissions (needed because "Automatically expose new tables" is OFF) ----------
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, org_name, phone, address, lat, lng, privacy_accepted_at) on public.profiles to authenticated;
grant select, insert on public.donations to authenticated;
grant select, insert on public.donation_contacts to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.notifications, public.donations;
