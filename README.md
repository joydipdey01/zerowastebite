# ZeroWasteBite v2

Rescue food. Reduce waste. Make food affordable. Surplus food is donated free to nearby NGOs or sold at a discount to nearby buyers, with a live best-before timer on every listing.

**Live demo:** https://zerowastebite-eight.vercel.app

## What is new in v2
- Three account types: **supplier** (restaurant, cafe, hotel, bakery), **NGO** and **buyer**
- Suppliers sign up with restaurant/cafe name, FSSAI licence number (14 digits) and a photo of the FSSAI certificate (private storage). NGOs give their organisation name. Buyers sign up normally
- Free donation or discounted sale for every listing, with FSSAI number and verified mark shown to NGOs and buyers
- Buyers reserve portions, pay the supplier at pickup, suppliers mark the order picked up (service fee 10%)
- Impact dashboard now shows revenue recovered (suppliers) and money saved (buyers)
- Supplier Plans page (paid plans are waitlist only, no payments yet)
- New Privacy Policy, Terms of Use, **Cookie Policy** and a cookie notice. Changing `POLICY_VERSION` in `js/config.js` asks everyone to accept again
- Mobile-first layout (bottom navigation on phones), same design, same security headers

Not built yet (marked future in the pitch): online payment gateway, home delivery, subscription billing, AI demand prediction.

## Setup
1. Create a project at https://supabase.com. In **SQL Editor** run `supabase/schema.sql`, then run `supabase/upgrade.sql` (both once, in that order).
2. Copy the Project URL and anon key into `js/config.js`. `SUPPORT_EMAIL` is already set.
3. Sign-in settings are unchanged: Email provider on with **Confirm email**, custom SMTP, `{{ .Token }}` in the Confirm sign up and Reset password templates, optional Phone provider, Site URL = your domain.
4. Run locally with any static server (`npx serve .`) or deploy to Vercel with **Framework Preset: Other** and no build command.

## Verifying suppliers
Suppliers can list food as soon as they submit the number and certificate, and show **FSSAI under review**. After you check the photo in **Storage > fssai-docs**, run the `update ... set verified = true` line at the bottom of `supabase/upgrade.sql`. Editing the FSSAI number or photo resets the verified mark.

## Notes
- If you change `KG_PER_SERVING` or `SERVICE_FEE_PCT`, change them in both `js/config.js` and `supabase/upgrade.sql`.
- Address search uses OpenStreetMap Nominatim (light usage only).
- The Supabase anon key is public by design. Never commit the `service_role` key or SMTP passwords.

## Author
Created by **Joydip Dey**. Contact: nexaforge83@gmail.com

© Joydip Dey. All rights reserved.
