# ZeroWasteBite

Real-time surplus food donation platform that connects donors with nearby NGOs, so good food reaches people instead of bins.

**Live demo:** https://zerowastebite-eight.vercel.app

## Features
- Donor and NGO accounts, with sign-up by email or mobile number
- Password reset with a one-time code (OTP)
- Privacy Policy consent gate: the app stays closed until it is accepted
- Donors list food with a best-before countdown and a typed or live location
- Nearby NGOs (within 50 km) get a realtime alert, and the first NGO to accept collects the food
- Impact dashboard with daily, monthly and yearly meals, people fed, food saved and CO2e avoided
- Day and night mode, responsive on mobile

## Tech stack
HTML, CSS and vanilla JavaScript (no build step) with Supabase (Auth, PostgreSQL, Realtime, Row Level Security), deployed on Vercel.

## Setup

### 1. Supabase project
1. Create a project at https://supabase.com.
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and click **Run** once.
3. Open **Project Settings > API** and copy the Project URL and the anon public key into `js/config.js`. Set `SUPPORT_EMAIL` too.

### 2. Sign-in settings
- **Authentication > Providers > Email:** enabled, with **Confirm email** ON.
- **Custom SMTP:** enable it under **Authentication > Emails > SMTP Settings** (Gmail app password, Brevo or Resend). Supabase only allows editing email templates after this.
- **Email templates:** put `{{ .Token }}` in both templates so users receive a code instead of a link.
  - Confirm sign up: `<p>Your ZeroWasteBite verification code is <b>{{ .Token }}</b>.</p>`
  - Reset password: `<p>Your ZeroWasteBite password reset code is <b>{{ .Token }}</b>.</p>`
- **Mobile sign-up (optional):** enable Phone and connect an SMS provider such as Twilio. Without it, only email sign-up works.
- **URL Configuration:** set Site URL to your deployed domain.

### 3. Run locally
Use any static server, for example VS Code Live Server or `npx serve .`. Do not open `index.html` as a plain file.

### 4. Deploy
Push to GitHub and import the repo in Vercel with **Framework Preset: Other** and no build command. The security headers in `vercel.json` apply automatically.

## Notes
- Policy text is in `js/app.js` (`policy()` and `terms()`). If you change `KG_PER_SERVING`, change it in both `js/config.js` and `complete_donation()` in the SQL.
- Address search uses OpenStreetMap Nominatim (light usage only).
- The Supabase anon key in `js/config.js` is public by design. Never commit the `service_role` key or SMTP passwords.

## Author
Created by **Joydip Dey**

&copy; Joydip Dey. All rights reserved.
