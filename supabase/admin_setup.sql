-- ZeroWasteBite: create or change the admin login. Run in Supabase > SQL Editor AFTER v3_upgrade.sql.
-- 1. Replace the three CHANGE_ME values with your own secret ID, key and password (long and different from each other).
-- 2. Click Run. Only bcrypt hashes are stored, so nobody can read the originals back, not even from the database.
-- 3. NEVER commit this file to GitHub with real values in it. Put the real values only in the SQL Editor, then close the tab.
-- Run it again with new values any time to change the login. Old admin sessions are signed out.
insert into public.admin_credentials (admin_id, key_hash, pass_hash)
values ('CHANGE_ME_ADMIN_ID', crypt('CHANGE_ME_ADMIN_KEY', gen_salt('bf', 10)), crypt('CHANGE_ME_PASSWORD', gen_salt('bf', 10)))
on conflict (admin_id) do update set key_hash = excluded.key_hash, pass_hash = excluded.pass_hash;
delete from public.admin_sessions;
-- To remove an admin login completely: delete from public.admin_credentials where admin_id = 'THE_ID';
