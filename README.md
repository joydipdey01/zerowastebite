# ZeroWasteBite v3

Rescue food. Reduce waste. Make food affordable. Surplus food is donated free to nearby NGOs or sold at a discount to nearby buyers, with a live best-before timer on every listing.

**Live demo:** https://zerowastebite-eight.vercel.app

## What is new in v3
- **No FSSAI needed.** Any restaurant, cafe, food vendor or event organiser can donate or sell surplus food at a low price. The FSSAI number, certificate upload and verification are gone
- **Reports.** After an NGO accepts food or a buyer reserves it, they can report spoiled food with a photo and a reason
- **Star ratings.** NGOs and buyers rate the food. The supplier gets an alert such as "Helpers NGO rated you 5 stars" and a running average rating
- **Warnings.** A confirmed spoiled-food report gives the supplier a final warning, and a second one removes the account for good. A fake report warns the reporter, and a second fake report removes that account for good. Both sides are notified of every decision
- **Admin panel.** Hidden, with its own login. The admin ID, key and password live only in Supabase (hashed), never in the website code. Admins can review reports, warn, ban, edit or delete anything and send messages, greetings and thank-yous
- **Thank-you popups** after a buyer reserves food and after an NGO accepts food. Warnings, greetings and thank-yous sent by the admin also pop up

Earlier (v2): supplier, NGO and buyer accounts, free or discounted listings, buyer reservations (service fee 10%), impact dashboard, plans page, Privacy Policy, Terms of Use and Cookie Policy.

Not built yet (marked future in the pitch): online payment gateway, home delivery, subscription billing, AI demand prediction.

## Setup
1. Create a project at https://supabase.com. In **SQL Editor** run `supabase/schema.sql`, then `supabase/upgrade.sql`, then `supabase/v3_upgrade.sql` (once each, in that order). Already running v2? Run only `supabase/v3_upgrade.sql`.
2. Copy the Project URL and anon key into `js/config.js`. `SUPPORT_EMAIL` is already set.
3. Sign-in settings are unchanged: Email provider on with **Confirm email**, custom SMTP, `{{ .Token }}` in the Confirm sign up and Reset password templates, optional Phone provider, Site URL = your domain.
4. Run locally with any static server (`npx serve .`) or deploy to Vercel with **Framework Preset: Other** and no build command.

## Admin login
Open `supabase/admin_setup.sql` in the Supabase SQL Editor, replace the three CHANGE_ME values with your own secret ID, key and password, and run it. Do not commit your real values to GitHub. The panel checks them inside the database, and sessions last 2 hours. Re-run the file with new values any time to change the login.

After running `v3_upgrade.sql`, delete the old **fssai-docs** bucket in Supabase > Storage.

## Notes
- If you change `KG_PER_SERVING` or `SERVICE_FEE_PCT`, change them in both `js/config.js` and `supabase/upgrade.sql`.
- Address search uses OpenStreetMap Nominatim (light usage only).
- The Supabase anon key is public by design. Never commit the `service_role` key or SMTP passwords.

## Author
Created by **Joydip Dey**. Contact: nexaforge83@gmail.com

© Joydip Dey. All rights reserved.
