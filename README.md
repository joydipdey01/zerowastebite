# ZeroWasteBite

**Rescue food. Reduce waste. Make food affordable.**

ZeroWasteBite is a local, real-time web platform that connects people who have surplus food (event organisers, caterers, restaurants, cafes, bakeries, street vendors) with nearby NGOs and budget buyers. Surplus food is either **donated free to NGOs** or **sold at a low price to nearby buyers**, and every listing carries a **live Best-Before timer** so only food that is still safe can be accepted or reserved.

- **Live demo:** https://zerowastebite-eight.vercel.app
- **Source code:** https://github.com/joydipdey01/zerowastebite
- **Team:** NexaForge
- **Project status:** **~50% complete (working MVP demo)**. The core rescue loop works end to end. Payment gateway, home delivery with delivery partners, AI integration and phone verification are the remaining 50% (see [Future Features](#future-features-full-plan) and [Roadmap](#roadmap-the-remaining-50)).

---

## At a Glance: A Social Mission With a Real Business

**The idea in one line:** ZeroWasteBite turns food that would be thrown away into free meals for people in need and cheap meals for buyers, and earns a sustainable income from it, **without ever charging for donations**.

### How ZeroWasteBite earns money

| # | Revenue stream | How it works | Status |
|---|---|---|---|
| 1 | **10% margin on every discounted sale** | When a buyer reserves discounted food, the platform keeps a **10% service fee**. The supplier gets the other 90%. The percentage is a configurable setting (`SERVICE_FEE_PCT`). Once the **payment gateway** is added, the 10% is collected automatically at payment, so revenue is secured. | Fee logic live; **gateway planned** |
| 2 | **Restaurant advertising (optional)** | Restaurants, cafes and bakeries that want more visibility can pay for **featured placement and promotions** at the top of nearby listings. Completely optional. | Planned (Phase 3) |
| 3 | **Small, non-intrusive website ads** | Light banner ads shown to a growing local audience. **Never placed inside food-safety information** (timer, reports, warnings). | Planned (Phase 3) |
| 4 | **Home delivery fee** | Buyers get cheap food **delivered to their door**. They pay a small delivery fee, the **delivery partner earns** from it, and we keep a small coordination fee. | Planned (Phase 4) |
| 5 | **Online payments (revenue collection)** | A payment gateway collects payment on the platform, deducts our margin automatically and pays the rest to suppliers and delivery partners. | Planned (Phase 3) |

**Donations always stay 100% free** for suppliers and NGOs. That builds trust and keeps a steady supply of food, which is what makes streams 1 to 5 possible.

### Example: how one meal pays for everyone

A cafe has a Rs 120 meal that would be thrown away at closing time.

| Without ZeroWasteBite | With ZeroWasteBite (sold at Rs 50) |
|---|---|
| Rs 120 of food wasted, cafe earns Rs 0 | Cafe earns **Rs 45** |
| Buyer pays full price elsewhere | Buyer saves **Rs 70** and eats a good meal |
| Nobody earns | Platform earns **Rs 5** (10% margin) |

**Every side gains:** the supplier earns from waste, the buyer saves money, the platform earns a margin, and the food reaches a plate instead of a bin.

### Why this business can scale

- **Zero cost of goods:** we never buy, store or cook food. Suppliers already have it, so our margin is almost pure service income.
- **Self-growing flywheel:** more free donations build trust, so more NGOs and buyers join, so more suppliers list food, so more sales and ad reach, so more revenue funds growth.
- **Built-in demand:** every restaurant, cafe, caterer and event organiser produces surplus daily, and every city has price-sensitive buyers and NGOs looking for food.
- **Multiple income streams** (sales margin, restaurant ads, website ads, delivery fees, all collected through one payment gateway) instead of depending on one.
- **Illustrative example (not a measured result):** if a city reaches 1,000 discounted meals a day at an average Rs 50, that is Rs 50,000 of sales a day and about **Rs 5,000 a day (roughly Rs 1.5 lakh a month)** from the 10% margin alone, before ads and delivery.

---

## Table of Contents

0. [At a Glance: How We Earn](#at-a-glance-a-social-mission-with-a-real-business)
1. [The Problem](#1-the-problem)
2. [What We Are Building](#2-what-we-are-building)
3. [Why This Is Needed](#3-why-this-is-needed)
4. [How It Works](#4-how-it-works)
5. [Key Features (Built and Working)](#5-key-features-built-and-working)
6. [The Best-Before Timer: Our Core Edge](#6-the-best-before-timer-our-core-edge)
7. [Trust and Safety System](#7-trust-and-safety-system)
8. [AI Integration: Report Checking](#8-ai-integration-report-checking)
9. [Why We Are Better](#9-why-we-are-better)
10. [Technical Approach](#10-technical-approach)
11. [Business Model](#11-business-model)
12. [Impact](#12-impact)
13. [Project Status: 50% Done (MVP Demo)](#13-project-status-50-done-mvp-demo)
14. [Future Features (Full Plan)](#future-features-full-plan)
    - [Roadmap: The Remaining 50%](#roadmap-the-remaining-50)
15. [What Is New in v3](#15-what-is-new-in-v3)
16. [Setup Guide](#16-setup-guide)
17. [Admin Login](#17-admin-login)
18. [Notes](#18-notes)
19. [Team](#19-team)

---

## 1. The Problem

Good food is wasted every day while people go hungry.

| Statistic | Figure |
|---|---|
| Food wasted worldwide in 2022 | **1.05 billion tonnes** |
| People affected by hunger | **783 million** |
| Household food waste in India every year | **~78 million tonnes** |

*Source: UNEP Food Waste Index Report 2024.*

Where the chain is broken today:

- **Events and caterers:** many guests do not turn up, so food cooked for hundreds is left untouched and thrown away.
- **Restaurants and cafes:** at closing time, unsold meals and bakery items earn Rs 0 once they go in the bin.
- **Small vendors are left out:** street vendors and one-time event hosts often have no formal food licence, so licence-gated platforms exclude them.
- **No accountability for quality:** when food is shared, nobody checks it. Receivers fear unsafe food and suppliers fear false complaints.
- **No organised link:** NGOs cannot find nearby donors in time, and low-income buyers cannot find cheap, good meals.

**The gap:** there is no open, trusted and local platform that links every surplus-food giver to nearby NGOs and buyers in real time, inside the short safe-to-eat window, with accountability for food quality.

---

## 2. What We Are Building

ZeroWasteBite is a responsive web app (works in any phone browser, nothing to install) with three types of users and one hidden admin:

| Role | What they do |
|---|---|
| **Supplier** | Lists surplus food in under a minute: food, portions, pickup spot, best-before time, and either *Free* or *Discounted* with a price |
| **NGO** | Sees nearby free food with a live timer, accepts it, collects it, distributes it and confirms how many people were fed |
| **Buyer** | Sees nearby discounted food, reserves portions, pays the supplier at pickup, then rates the food or reports a problem |
| **Admin** (hidden login) | Reviews reports, warns, bans, edits or deletes anything, and sends messages, greetings and thank-yous |
| **Rider** (future) | Will deliver discounted meals to the doorstep and earn per delivery |

Two models work together on **one platform**:

1. **Free donation:** surplus goes to NGOs and people in need.
2. **Low-price sale:** surplus is sold cheaply, so the supplier recovers some money and buyers eat well for less.

### Two real-life examples (illustrative numbers)

**Event leftovers.** Guests did not turn up, but the caterer cooked for everyone. The caterer lists the extra food with a best-before time and chooses:
- *Donate:* 100 portions feed 100 people, or
- *Sell at Rs 40:* 100 x Rs 40 = Rs 4,000 recovered instead of Rs 0.

**Restaurant or cafe closing time.** The manager lists unsold meals at Rs 30 instead of Rs 80. Students, workers and families nearby reserve them: 20 items = Rs 600 earned instead of Rs 0, and buyers eat well for less. Extra food can still be donated to an NGO.

---

## 3. Why This Is Needed

- **Food is being wasted at the exact place and time where it could be rescued.** The safe-to-eat window is short. Without a real-time, local system, surplus food is binned before anyone who needs it can find it.
- **Existing options solve only one side.** Donation-only models give suppliers no revenue incentive. Paid-bag-only models do not reach people who cannot pay at all.
- **Small suppliers are excluded.** Licence-gated platforms leave out street vendors, small cafes and one-time event hosts, who produce a lot of surplus.
- **Trust is the real barrier.** People will not eat shared food, and suppliers will not share it, unless there is a clear way to check quality and punish both bad food and false complaints.
- **Impact is invisible.** Without a public, honest counter, nobody sees how many meals were actually rescued.

ZeroWasteBite is designed to fix each of these.

---

## 4. How It Works

### A. Free donation
1. Supplier lists surplus as **FREE** with food, portions, pickup spot and best-before time.
2. The timer starts. Nearby NGOs are alerted, soonest-to-expire first.
3. An NGO accepts. Contact details unlock for pickup.
4. The NGO collects, distributes and confirms how many people were fed.
5. Impact is recorded. The NGO rates the food or reports a problem.

### B. Discounted sale
1. Supplier lists with original and sale price.
2. Buyers see the food, distance and live timer.
3. A buyer reserves portions. A thank-you popup confirms.
4. The buyer pays the supplier at pickup, before the best-before time.
5. The sale is recorded. The buyer rates the food or reports a problem.

### C. Home delivery (planned)
1. Buyer chooses **home delivery** at checkout and pays online (food at the low price plus a small delivery fee).
2. A nearby **delivery partner** accepts the order.
3. The delivery partner collects the food from the supplier.
4. The delivery partner delivers to the doorstep **before the best-before time**.
5. The delivery partner **earns for every delivery**.

So people can buy food at a low rate and still get it delivered at home.

---

## 5. Key Features (Built and Working)

- Supplier, NGO and buyer accounts with email code sign-in
- **No FSSAI or licence needed:** any restaurant, cafe, vendor or event organiser can donate or sell
- Free and discounted listings with the **live Best-Before timer**
- Nearby discovery with distance, **soonest to expire first**
- NGO accept and buyer reserve flows, with **thank-you popups**
- Pickup, completion and cancellation flows
- **Impact dashboard:** meals rescued, people fed, kg of food saved, CO2e avoided, by day, month and year (counts completed pickups only)
- **1 to 5 star ratings** with instant supplier alerts and a running average
- **Photo-proof food reports** with admin review
- **Automatic warnings and permanent removal rules**
- **Hidden admin panel:** warn, ban, edit, delete, message users
- Privacy Policy, Terms of Use and Cookie Policy with consent before use
- Light and dark theme, works on any phone

---

## 6. The Best-Before Timer: Our Core Edge

1. The supplier sets the best-before time while listing the food.
2. A live countdown starts and ticks every second for every NGO and buyer.
3. **Colour shows urgency:** green (over 3 hours), amber (1 to 3 hours), red (under 1 hour).
4. **Soonest to expire is shown first**, so the most urgent food is rescued first.
5. At best-before time the listing **expires automatically**, disappears, and can no longer be accepted or reserved.

**Result:** people in need and buyers only act on food that is still safe, and they know exactly how long they have to collect it. Suppliers never offer food past the time they set.

---

## 7. Trust and Safety System

A surplus-food platform only works if people trust the food. Our timer prevents stale food; ratings, reports and warnings remove bad actors on **both** sides.

**Ratings.** After collecting food, an NGO or buyer rates it from 1 to 5 stars. The supplier is notified instantly (for example "Helpers NGO rated you 5 stars") and the average rating on every listing updates.

**Reports.** After accepting or reserving, a receiver can report spoiled food with a **photo (required)** and a written reason. Only the reporter and the admin can see the photo.

**Admin decision.** The admin reviews the photo, reason and history, then decides:

| Outcome | Consequence |
|---|---|
| **Report is true** (food was spoiled) | Supplier gets a **final warning**. A second confirmed case permanently removes the account. |
| **Report is fake** | Reporter gets a **warning**. A second fake report permanently removes the reporter. |

Both sides are notified of every decision. Honest suppliers stay protected; unsafe food and false claims are both punished.

---

## 8. AI Integration: Report Checking

> **Planned, using the AI platform and AI credits provided by the hackathon organisers.**

Today every food report is reviewed manually by the admin. As the platform grows this becomes slow and inconsistent. We will integrate **the organisers' AI** to pre-check reports so admin decisions are faster, more consistent and cheaper to run.

**How the AI report check will work:**

1. A receiver submits a report with a **photo and a written reason**.
2. The report is sent to the organisers' AI service from a protected server function (the API key is never exposed in website code).
3. The AI analyses the **photo** (visible spoilage, mould, discolouration, packaging condition) and the **text** (does the reason match the photo, and does it look genuine or copied/spam?).
4. The AI returns a **suggested verdict** (likely spoiled / likely fake / unclear) with a short explanation and a confidence level.
5. The admin sees this suggestion next to the report and **makes the final decision**. The AI assists; it never bans or warns anyone on its own.

**Why this matters:**
- Faster resolution, so honest suppliers are not left waiting under a false complaint
- More consistent decisions across reports
- Helps detect repeated fake-report patterns
- Lower manual workload for admins, so the platform can scale city by city

**Further planned AI use:** AI to help run and moderate the website, and AI demand prediction to help suppliers list the right quantity at the right time.

---

## 9. Why We Are Better

| Feature | Robin Hood Army | Too Good To Go | **ZeroWasteBite** |
|---|---|---|---|
| Live Best-Before timer on every listing | Not described | Pickup window only | **Yes, live countdown** |
| Free food reaches people in need | Yes, volunteer drives | No, paid bags only | **Yes, via NGOs** |
| Discounted meals for buyers | No | Yes | **Yes** |
| Supplier recovers some revenue | No, donation only | Yes | **Yes** |
| Donation and sale on one platform | No | No | **Yes, both together** |
| Nearby discovery in an app | Partly, local volunteers | Yes | **Yes, with distance sorting** |
| Photo-proof reports, warnings, removal | Not described | Not described | **Yes, admin reviewed (AI-assisted planned)** |

*The comparison reflects publicly described models and may vary by region.*

**Our advantages in short:**
- **Two models, one platform:** free donation and low-price sale serve both people in need and budget buyers.
- **Safety built in:** the live timer plus reports, ratings, warnings and AI-assisted review give accountability others do not describe.
- **Open to every vendor:** no FSSAI or licence barrier, so small vendors and event hosts can join and earn trust through ratings.
- **Fair to both sides:** suppliers are protected from fake reports, and receivers are protected from unsafe food.
- **Zero install:** a responsive web app that opens in any phone browser.

---

## 10. Technical Approach

```
Supplier | NGO | Buyer | Admin (hidden login) | Rider (future)
                      |
        Responsive web app (HTML5, CSS3, JavaScript)
        Hosted on Vercel, code on GitHub
                      |
                Supabase backend
   Auth | PostgreSQL | Realtime | Row Level Security
                      |
   Business rules run as protected server functions
```

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (responsive, light and dark theme) |
| Hosting | Vercel (code on GitHub) |
| Backend | Supabase |
| Auth | Email code sign-in, 3 user roles |
| Database | PostgreSQL: listings, orders, reports, ratings, alerts, impact |
| Live updates | Supabase Realtime |
| Security | Row Level Security so each user sees only what they should |
| Address search and location | OpenStreetMap Nominatim, browser geolocation |
| Planned | Payment gateway, phone verification, organisers' AI service |

**Key design decisions**
- **Privacy by default:** contact details unlock only after accept or reserve. Reports and photos are visible only to the reporter and admin.
- **Hidden, hardened admin:** admin ID, key and password are stored hashed in the database, never in site code. Sessions expire and login attempts are logged.
- **Rules on the server:** listing, accepting, reserving, cancelling, reporting, rating and admin actions are enforced by the database, not the browser.
- **Honest impact numbers:** the dashboard counts completed pickups only, from stored data.
- **Consent first:** Privacy Policy, Terms and Cookie Policy are shown before use.

---

## 11. Business Model

Donation always stays free, so our social mission is never paid for by the people we serve.

| Stream | Description | Status |
|---|---|---|
| Free donations | Always free for suppliers and NGOs; builds trust and steady supply | Live |
| Service fee on discounted sales | 10% margin per reservation (configurable); buyers still save most of the price. Collected automatically once the payment gateway is added | Fee logic live, gateway planned |
| Restaurant advertising | Featured placement and promotions | Planned (Phase 3) |
| Small, non-intrusive ads | Light banner ads, never inside food-safety information | Planned (Phase 3) |
| Home delivery fee | Buyer pays a small delivery fee; the delivery partner earns from it and we keep a small coordination fee | Planned (Phase 4) |
| AI lowers cost | AI pre-checks reports and helps run the site | Planned (Phase 5) |

**Example (Rs 120 surplus meal sold at Rs 50):** instead of Rs 120 wasted, the supplier earns most of Rs 50, the platform earns a small fee, and the buyer saves Rs 70.

**Growth flywheel:** more free donations build trust, so more NGOs and buyers join, so more suppliers list surplus, so more sales and ad reach, so more revenue funds growth.

---

## 12. Impact

- **Social:** more safe meals reach people in need.
- **Environmental:** less food rots in landfill (about 2.5 kg CO2e avoided per kg of food rescued, an estimate).
- **Economic:** suppliers recover revenue, buyers save money, and riders will earn from deliveries.

Food service is a large source of waste (290 million tonnes globally in 2022, per UNEP 2024), and that is where our suppliers sit.

**Illustrative target (not a measured result):** if each partner supplier shares 20 meals a day, 10 suppliers rescue about 6,000 meals a month, 50 suppliers about 30,000, and 100 suppliers about 60,000.

A public daily counter shows meals rescued, people fed, kg of food saved and CO2e avoided, updated from completed pickups only.

---

## 13. Project Status: 50% Done (MVP Demo)

ZeroWasteBite is **about 50% complete: a working MVP demo**. The core rescue loop works end to end: listing, timer, accept or reserve, pickup, rating, report and admin decision.

**Done (about 50%, the MVP demo)**
- [x] Supplier, NGO and buyer accounts
- [x] Free and discounted listings with live Best-Before timer
- [x] Nearby discovery sorted by soonest to expire
- [x] NGO accept and buyer reserve with thank-you popups
- [x] Pickup, completion and cancellation flows
- [x] Impact dashboard (day, month, year)
- [x] 1 to 5 star ratings with supplier alerts
- [x] Photo-proof reports, warnings and permanent removal rules
- [x] Hidden admin panel with its own login
- [x] Privacy Policy, Terms of Use, Cookie Policy with consent
- [x] Light and dark theme, mobile friendly

**Remaining (about 50%)**
- [ ] Online payment gateway (to collect revenue automatically)
- [ ] Home delivery with delivery partners who earn per delivery
- [ ] AI integration for report checking (organisers' AI)
- [ ] Phone number verification
- [ ] Restaurant advertising and small website ads
- [ ] Subscription billing
- [ ] AI demand prediction and AI website assistant

What remains builds on the same foundation and does not require redesigning what already works. The MVP proves the hardest part, the safe, timed, trusted rescue loop. The next 50% adds money flow, delivery and intelligence.

---

## Future Features (Full Plan)

Everything below is **planned and not built yet**. It builds on the working MVP.

### 1. Home delivery with delivery partners (delivery boys earn)

**The goal:** people buy food at a low rate and still get it delivered to their home, while delivery partners earn a steady income.

- **New Rider role** with its own sign-up, phone verification and profile.
- **Buyer checkout option:** choose *Pickup* or *Home delivery*.
- **Order flow:** buyer orders, nearby riders are alerted, one rider accepts, collects from the supplier, delivers to the doorstep, and the buyer confirms receipt.
- **Time-safe delivery:** the Best-Before timer keeps running. Delivery is only offered when the food can reach the buyer before it expires.
- **Live order status:** accepted, picked up, on the way, delivered.
- **Rider earnings:** the delivery fee is split, so the rider earns on **every delivery**. The platform keeps a small coordination fee. A rider earnings page shows trips, earnings and payout history.
- **Example (illustrative numbers):** a buyer pays Rs 50 for a biryani plus a Rs 30 delivery fee. The supplier gets Rs 45 (after the 10% margin), the rider earns about Rs 25, and the platform keeps about Rs 10 in total. The buyer gets a hot meal at home for far less than usual restaurant prices.
- **New income for locals:** students and part-time workers can earn by delivering rescued meals in their own area.

### 2. Online payment gateway (to collect revenue)

- **Online payments** by UPI, cards and wallets through a payment gateway (the exact provider will be chosen in Phase 3).
- **Automatic revenue collection:** the 10% margin is deducted at payment time, so the platform earns on every sale without chasing anyone.
- **Automatic settlement:** the remaining amount goes to the supplier, and the delivery fee portion goes to the rider.
- **Payments only for sales.** Free donations never involve payment.
- **Safer for everyone:** payment records, receipts and refunds when a report is confirmed true (food was spoiled).
- **Pay at pickup stays** as an option during the pilot.

### 3. AI integration (using the organisers' AI)

- **AI report checking:** photo and text pre-check of spoiled-food reports. The AI suggests *likely spoiled*, *likely fake* or *unclear* with a short explanation, and the **admin makes the final decision**.
- **Fake-report pattern detection:** flags users who file repeated suspicious reports.
- **AI to help run the website:** moderation help and automatic handling of routine admin work.
- **AI demand prediction:** helps suppliers list the right quantity at the right time, using past listing and pickup data.
- **AI suggestions for pricing:** recommends a low price likely to sell before the timer ends.

### 4. Phone verification

- OTP-based phone verification for suppliers, NGOs, buyers and riders.
- Fewer fake accounts and fake reports, and safer pickup and delivery contact.

### 5. Advertising and visibility income

- **Restaurant advertising (optional):** featured placement and promotions for restaurants, cafes and bakeries that want more visibility.
- **Small, non-intrusive website ads:** light banners for a growing local audience, never inside food-safety information.

### 6. Growth and platform features

- **Subscription plans** for high-volume suppliers.
- **Bulk supplier onboarding:** hostels, canteens, marriage halls and restaurant groups.
- **Regional languages** so more NGOs, vendors and buyers can use the app.
- **Local NGO and restaurant-group partnerships**, expanding city by city.

---

## Roadmap: The Remaining 50%

| Phase | Focus | What we will add |
|---|---|---|
| **Now (MVP, ~50%)** | Working demo | Core rescue loop, live timer, ratings, reports, admin, impact dashboard |
| **Phase 2** | Local pilot | Onboard restaurants, bakeries and NGOs in one area; collect feedback and tune the fee; **phone verification** |
| **Phase 3** | Monetise | **Online payment gateway** (automatic 10% margin), restaurant advertising and small website ads |
| **Phase 4** | Home delivery | **Delivery partner module:** riders sign up, accept orders, deliver to the doorstep and **earn on every delivery** |
| **Phase 5** | AI and cities | **AI report checking** (organisers' AI), AI website assistant, AI demand prediction, expand city by city |

**Next up in detail**
1. **Payment gateway:** collect payments online and keep our 10% margin automatically.
2. **Home delivery:** a new Rider role so buyers get low-price food at home and delivery partners earn per delivery.
3. **AI integration:** photo and text pre-check of food reports with the organisers' AI, with the admin keeping the final say.
4. **Phone verification:** OTP verification to cut fake accounts and fake reports.

**Scale levers:** bulk suppliers such as hostels, canteens and marriage halls; regional languages; local partnerships with NGOs and restaurant groups.

---

## 15. What Is New in v3

- **No FSSAI needed.** Any restaurant, cafe, food vendor or event organiser can donate or sell surplus food at a low price. The FSSAI number, certificate upload and verification are removed.
- **Reports.** After an NGO accepts food or a buyer reserves it, they can report spoiled food with a photo and a reason.
- **Star ratings.** NGOs and buyers rate the food. The supplier gets an alert such as "Helpers NGO rated you 5 stars" and a running average rating.
- **Warnings.** A confirmed spoiled-food report gives the supplier a final warning, and a second one removes the account for good. A fake report warns the reporter, and a second fake report removes that account for good. Both sides are notified of every decision.
- **Admin panel.** Hidden, with its own login. The admin ID, key and password live only in Supabase (hashed), never in the website code. Admins can review reports, warn, ban, edit or delete anything and send messages, greetings and thank-yous.
- **Thank-you popups** after a buyer reserves food and after an NGO accepts food. Warnings, greetings and thank-yous sent by the admin also pop up.

**Earlier (v2):** supplier, NGO and buyer accounts, free or discounted listings, buyer reservations (service fee 10%), impact dashboard, plans page, Privacy Policy, Terms of Use and Cookie Policy.

**Not built yet (planned):** online payment gateway, home delivery with delivery partners, subscription billing, AI report checking, AI demand prediction, phone verification, advertising.

---

## 16. Setup Guide

1. Create a project at https://supabase.com. In the SQL Editor run `supabase/schema.sql`, then `supabase/upgrade.sql`, then `supabase/v3_upgrade.sql` (once each, in that order). Already running v2? Run only `supabase/v3_upgrade.sql`.
2. Copy the Project URL and anon key into `js/config.js`. `SUPPORT_EMAIL` is already set.
3. Sign-in settings are unchanged: Email provider on with Confirm email, custom SMTP, `{{ .Token }}` in the Confirm sign up and Reset password templates, optional Phone provider, Site URL = your domain.
4. Run locally with any static server (`npx serve .`) or deploy to Vercel with Framework Preset: Other and no build command.

---

## 17. Admin Login

Open `supabase/admin_setup.sql` in the Supabase SQL Editor, replace the three `CHANGE_ME` values with your own secret ID, key and password, and run it. **Do not commit your real values to GitHub.** The panel checks them inside the database, and sessions last 2 hours. Re-run the file with new values any time to change the login.

After running `v3_upgrade.sql`, delete the old `fssai-docs` bucket in Supabase > Storage.

---

## 18. Notes

- If you change `KG_PER_SERVING` or `SERVICE_FEE_PCT`, change them in both `js/config.js` and `supabase/upgrade.sql`.
- Address search uses OpenStreetMap Nominatim (light usage only).
- The Supabase anon key is public by design. **Never commit the `service_role` key, SMTP passwords or any AI API key.**

---

## 19. Team

**Team NexaForge**

| Name | Role |
|---|---|
| Joydip Dey | Team Leader |
| Dev Prakash Sahu | Team Member |
| Ankita Ghosh | Team Member |
| Javed Akhtar | Team Member |
| Madhusudan Ojha | Team Member |

Created by Joydip Dey. Contact: [nexaforge83@gmail.com](mailto:nexaforge83@gmail.com)

© Joydip Dey. All rights reserved.
