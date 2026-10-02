# ZeroWasteBite

Real-time surplus food donation platform. Static frontend (HTML, CSS, JS, no build step) + Supabase (Auth, Postgres, Realtime).
&copy; Joydip Dey. All rights reserved.

## 1. Create the Supabase project
1. Create a project at https://supabase.com.
2. **SQL Editor > New query**: paste all of `supabase/schema.sql` and press **Run** (once).
3. **Project Settings > API**: copy the **Project URL** and the **anon public** key into `js/config.js`. Set `SUPPORT_EMAIL` too.

## 2. Configure sign-in (Authentication)
- **Providers > Email**: enabled. Keep "Confirm email" ON (users verify with a code).
- **Email OTP length**: 6 (Authentication > Providers > Email).
- **Email templates** (Authentication > Email Templates): the app asks users to type a code, so put `{{ .Token }}` in both templates:
  - *Confirm signup*: `<p>Your ZeroWasteBite verification code is <b>{{ .Token }}</b>. It expires soon.</p>`
  - *Reset password*: `<p>Your ZeroWasteBite password reset code is <b>{{ .Token }}</b>. Ignore this if you did not ask for it.</p>`
- **Mobile number sign-up / SMS OTP** (optional): Providers > Phone > enable and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Without it, email sign-up still works and phone sign-up will show an error.
- **Production email**: Supabase's built-in mailer is rate-limited. Add your own SMTP (Resend, Brevo, SendGrid) under Project Settings > Auth > SMTP.
- **URL Configuration**: set Site URL to your deployed domain.

## 3. Deploy
Upload the folder to any static host. Vercel: `vercel --prod` (headers in `vercel.json` are applied automatically). Netlify / Cloudflare Pages / GitHub Pages: publish the root folder, no build command. If you use another host, copy the security headers from `vercel.json`.

## How it works
- Sign up as **Donor** or **NGO** with email or mobile; log in with either. Forgot password sends a one-time code, then the user sets a new password.
- After first login the **Privacy Policy** must be accepted (saved to the profile). Declining logs the user out and the app stays closed. Row Level Security also blocks all data access until consent is saved.
- Donors list food with a best-before countdown and a typed or live location. NGOs within 50 km (or all NGOs if a location is missing) get an alert. The first NGO to press **Accept pickup** wins; it is atomic, so two NGOs cannot take the same food.
- The NGO marks food distributed and enters the people served. The dashboard updates automatically (daily, monthly, yearly) and explains every formula.

## Notes
- Edit the policy text in `js/app.js` (`policy()` and `terms()`), and `KG_PER_SERVING` in both `js/config.js` and `complete_donation()` in the SQL if you change it.
- Address search uses the free OpenStreetMap Nominatim service (light usage only). For heavy traffic use a paid geocoder.
- Pin the Supabase script with an SRI hash or self-host it if you want stricter supply-chain protection.
- Full testing needs your own Supabase project: create one donor and one NGO account and run a listing through the full flow before launch.
