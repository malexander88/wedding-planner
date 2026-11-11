# Wedding Planner — the plan

A shared app for a couple to find, compare and book everything for a wedding in and around Belfast, Antrim and Newtownabbey — starting from nothing booked and no date.

This note is written for people, not just developers. It is the map for how the app is built.

---

## What the app is for

Most wedding apps assume you already have a date and a venue. This one starts earlier:

1. You say roughly how many guests, what you can spend, which season you like, where you want to marry, and the style you have in mind.
2. The app gives you a staged checklist (what to do first, what can wait) until you pick a date.
3. Once a date is set, those stages become real deadlines — including Northern Ireland legal dates such as giving notice and collecting the marriage schedule.
4. Alongside that, you can hunt for venues and suppliers, shortlist them, enquire, compare quotes, and book.
5. Booking someone automatically drops their cost into the budget, their payments into the calendar, and a placeholder into the day-of run sheet.

It works in a phone browser (you can install it on Android or iPhone as an app), and on a desktop. Later it can be wrapped as a native Android app too.

Your data lives on the device in this first version. Sharing between two phones and a public RSVP page need a cloud account, which we have not set up yet — see the end of this document.

---

## The screens

### Ready in round 1

**Welcome / onboarding**  
A short wizard: your names, a rough guest count (day and evening), a working budget, a preferred season, an area (this defaults to Belfast / Antrim / Newtownabbey), a style, the kind of ceremony (civil, religious, humanist, or not sure yet), and whether either of you has been married or in a civil partnership before (this changes the legal notice timing).

**Home**  
If there is no date yet: the stage you are in, the next few jobs, budget at a glance, and a clear nudge to compare dates and start looking at venues.  
If there is a date: a countdown, the next legal deadline, upcoming payments, and the next checklist items.

**Plan (checklist)**  
Before a date: stages such as “set your vision”, “find a venue”, “compare dates”, “book key suppliers”, “sketch the guest list”.  
After a date: the same work, now with calendar deadlines, including NI legal steps with official nidirect and Antrim & Newtownabbey Council links.

**Dates**  
Add possible wedding dates and compare them side by side: day of the week, whether it is a UK/NI bank holiday, the published Antrim & Newtownabbey registrar fee band for that kind of day, and (for any venue you have shortlisted) whether that date looks available, unavailable, or still unknown. You mark availability yourself after you have asked the venue — the app cannot see their diary. Pick one date when you are ready.

**Find (suppliers)**  
Pick a category (venue, photographer, florist, and so on). You will see:

- A starter list of real local venues and suppliers we have checked from public official pages (council-approved civil venues are the backbone of the venue list).
- One-tap buttons that open Google, Hitched, Bridebook and Google Maps, already searched for that category and your area.
- A way to add anyone yourself.

Each supplier you save becomes a card you can move through: shortlisted → enquired → quoted → viewed → booked (or not for us). You can draft an enquiry email to copy and send yourself — the app never sends it. Quotes sit side by side, with a checklist of hidden extras to ask about (VAT, corkage, supplier meals, overtime, and so on). Booking someone updates the budget, the payment calendar, and the run sheet.

**Budget**  
Every category can have an estimated, quoted and actual figure. You can say whether a number includes VAT. Deposits and balances have due dates and show up on a payment calendar. A buffer (default 12%) sits on top so surprise extras have somewhere to live.

**Guests**  
People are grouped into households. Each person can be invited to the day, the evening, or both. Plus-ones are named (or marked as still unnamed). You can note meals, dietary needs, and where someone is travelling from. Export the list as a spreadsheet (CSV) for your caterer or for safekeeping.

**Settings & backup**  
Change the basics, download a JSON backup of everything, or restore from one. Useful before a new phone, and until cloud sharing is switched on.

### Coming in round 2 (you will see them in the menu, greyed as “next”)

- **RSVP website** — a page guests can open from a link or a QR code, without creating an account, with different details for day and evening guests.
- **Seating** — drag people onto tables, with “sit together” and “keep apart” rules, using only guests who have said yes.
- **Run sheet** — the minute-by-minute day, shared later with suppliers and the wedding party. Bookings already drop a placeholder here.
- **Gifts & thank-yous** — what each household gave, and whether you have written.
- **Mood board** — pictures and notes to share with your florist or stylist.
- **Helpers** — invite a parent or best man to do specific jobs without seeing everything (for example, not the budget).

Hen and stag planning spaces are deliberately out of scope.

---

## Who can see what (roles)

| Role | What they can do |
| --- | --- |
| **Owner** | Everything. The person who first set the wedding up. |
| **Partner** | The same as the owner, with their own login once sharing is on. |
| **Helper** | Only what you allow — typically tasks and perhaps the guest list, not the budget and not surprises. Round 2. |

Until cloud sharing is on, both of you use the same phone or pass a backup file between you.

---

## The information the app keeps

Think of this as the filing cabinet. Round 1 already uses most of it; the rest is ready so later screens do not have to start again.

- **Wedding profile** — names, area, style, season, guest guesses, budget, ceremony type, previous marriage, chosen date, candidate dates.
- **Households** — a family or couple you invite together, with an optional address and email.
- **Guests** — each person in a household, including named plus-ones, children, day/evening invites, reply, meal, dietary notes (and a note that they agreed you could store them), and where they are travelling from.
- **Events** — ceremony, wedding breakfast, evening, and any extras. Used later for RSVPs.
- **Suppliers** — anyone you are considering or have booked, with a status on the path from shortlisted to booked.
- **Quotes** — amount, whether VAT is included, what is in and what is out, and the hidden-extras questions you have asked.
- **Budget lines** — estimate, quoted and actual for each category, optionally linked to a supplier.
- **Payments** — deposits, balances and instalments, with due dates and paid dates.
- **Tasks** — checklist items, some with official links, some you add yourself.
- **Seating** — tables, who sits where, and together/apart rules (round 2).
- **Run sheet** — timed rows for the day (round 2 UI; bookings already add a row).
- **Gifts and thank-yous** (round 2).
- **Mood board items** (round 2).

Dietary notes can count as sensitive health or faith information. The app asks you to treat them carefully, collect only what the caterer needs, and (in round 2) collect the guest’s consent on the RSVP form. Do not upload passports or birth certificates into the app — the checklist only asks whether you have them ready.

---

## How finding suppliers works

There is no paid search key hidden in the app.

1. **Every approved wedding venue in Northern Ireland, in the app.** Find loads nidirect’s full list of places approved for civil marriage and civil partnership (all 11 councils, about 207 venues plus 25 council registrar offices), each with its town, council and a map pin. You can search by name or town, filter by council area, distance from Newtownabbey (straight line), kind of place and known capacity, and sort nearest-first or A–Z. Each venue has its own page: a read-only **Facts** card with the source link, a free OpenStreetMap map, directions, the registrar fees for *that* council, Save to shortlist and Draft an enquiry.
2. **The checked starter list** (18 venues around Antrim, Newtownabbey and Belfast, plus suppliers), checked against the council’s own lists or the supplier’s website. These are merged into the directory, so no venue appears twice and their checked facts and capacities stay attached.
3. **Search buttons** that open Google, Hitched, Bridebook and Google Maps with the category and your area already filled in.
4. **Add someone yourself** if you found them another way.

Your own notes stay yours: checked facts are shown in the Facts card, never copied into Notes.

Enquiry drafts are written on your phone for you to copy; nothing is emailed automatically.

### Where the venue data comes from (and the licences)

- **List of places:** nidirect, “Registration office venues for civil marriage and civil partnerships” (https://www.nidirect.gov.uk/articles/registration-office-venues-civil-marriage-and-civil-partnerships). The page was last updated on 15 September 2026, and we checked it on 11 November 2026. nidirect’s copyright statement says its content is Crown copyright and may be re-used free of charge under the **Open Government Licence v3.0**, as long as you acknowledge the source and don’t imply official endorsement. Logos and third-party images are excluded. The app shows the attribution “Contains public sector information licensed under the Open Government Licence v3.0.” in Find and on every venue page, with a link to the source. We only use the text list (names, towns, phone numbers), never nidirect’s logos or images.
- **Map pins:** geocoded once at build time with OpenStreetMap Nominatim. We sent one request per second or slower, with an identifying User-Agent, and cached every answer in the repo (`scripts/venues/geocode-cache.json`), so the app never calls Nominatim itself. The coordinates are © OpenStreetMap contributors and available under the **ODbL**. The derived file `scripts/venues/geocoded.json` and the copy inside `src/data/venues.generated.json` stay under ODbL, and the app credits OpenStreetMap wherever pins or maps appear. Where Nominatim found only the town, the venue page says the pin is approximate.
- **Maps:** an OpenStreetMap embed that loads only when you tap “Show map”, with © OpenStreetMap contributors shown underneath.
- **Kind of place** (hotel, castle, country house and so on) is our guess from the name, and the app labels it that way. **Capacity** is shown only where a checked source gives it, which today means the starter venues.
- **Registrar fees** come only from each council’s own published pages or PDFs. Where a council doesn’t publish an approved-venue fee (Ards & North Down, Armagh Banbridge & Craigavon, Derry & Strabane, Mid Ulster, and Newry Mourne & Down at the time of checking), the app says so and gives the registrar’s phone number instead of guessing.

**Refreshing the list** (every few months, or when nidirect’s “updated” date changes):

```
curl -s https://www.nidirect.gov.uk/articles/registration-office-venues-civil-marriage-and-civil-partnerships > scripts/venues/nidirect-snapshot.html
node scripts/venues/parse-nidirect.mjs     # -> scripts/venues/nidirect.json
node scripts/venues/geocode.mjs            # only new places hit Nominatim; the rest come from the cache
node scripts/venues/build-directory.mjs    # -> src/data/venues.generated.json (set checkedOn inside)
npm test
```

If a starter venue’s nidirect name changes, update `STARTER_MATCH` in `src/data/venues.ts`. The tests check that no venue appears twice.

### Google Places (prepared, switched off)

The app works fully without this. When it’s switched on, a venue page also shows Google’s photo, address and a Google Maps link, plus phone, website and rating if you choose the Enterprise tier. That information is fetched fresh each time the page opens and never stored. The only thing kept is Google’s `place_id` on a shortlisted venue, which Google’s terms allow caching.

How it is built:
- `supabase/functions/places/index.ts` is a Supabase Edge Function that holds the Google key. The browser never sees the key.
- The function uses tight field masks:
  - Finding a venue uses Text Search with `places.id` only (the Essentials IDs Only SKU).
  - Details use the Pro fields `id, displayName, formattedAddress, googleMapsUri, businessStatus, photos`. Phone, website and rating are added only with `PLACES_TIER=enterprise`.
  - It fetches at most one photo, using `skipHttpRedirect`, so the image URL doesn’t carry the key.
- Daily caps keep usage inside Google’s monthly free allowance. The defaults are 300 finds, 150 Pro details (or 30 Enterprise) and 30 photos a day. They are counted atomically in `public.places_usage` by `places_bump()` (`supabase/002_places_usage.sql`). Row-level security is on, there are no policies, and the function is executable only by the service role, so the app’s publishable key can’t read or change the counts.
- Origins are restricted to an allowlist (GitHub Pages and localhost by default), and requests must carry the app’s publishable key.
- Attribution: the venue page labels the section “From Google”, links to Google Maps, and shows the photo author credits Google returns.

Setup, when you have a key:
1. In Google Cloud, create a project, enable **Places API (New)**, create an API key and restrict it to Places API (New). Billing must be on, but the caps above are designed to keep you within the free monthly usage. Also set a budget alert.
2. In the Supabase SQL editor, run `supabase/002_places_usage.sql`.
3. `supabase secrets set GOOGLE_PLACES_KEY=... PLACES_CLIENT_KEY=<the app's publishable key>`. Optionally also set `PLACES_TIER=enterprise`, `PLACES_CAP_DETAILS=...` and `PLACES_ALLOWED_ORIGINS=...`.
4. `supabase functions deploy places --no-verify-jwt`. Publishable keys aren’t JWTs, so the function checks the key and origin itself.
5. Build the app with `VITE_PLACES_ENABLED=true` (and `VITE_PLACES_FUNCTION_URL=` if the function URL isn’t `<project>/functions/v1/places`), then redeploy.

To switch it off again, rebuild without `VITE_PLACES_ENABLED`, or `supabase secrets unset GOOGLE_PLACES_KEY`. The function then answers 503 and the app simply doesn’t show the Google card.

---

## Northern Ireland legal dates the checklist uses

These come from official nidirect and Antrim & Newtownabbey Borough Council pages. Fees can change — the app shows them as a guide and links to the official pages.

- Notice can only be given in the **12 months** before the wedding, and must reach the registrar of the district **where you will marry** (not necessarily where you live).
- Send notice about **8 weeks** beforehand, or **10 weeks** if either of you has been married or in a civil partnership before.
- The legal minimum is **28 days**. Leaving it that late risks a postponement. An immigration check can stretch notice to **70 days**.
- There is no marriage without a **marriage schedule**. It cannot be issued more than **14 days** before the day, and only one of you can collect it.
- After a religious or humanist ceremony the signed schedule must go back to the registrar within **3 days**.
- You need **two witnesses aged 16 or over**.

Antrim & Newtownabbey also publish what they charge for the registrar to conduct a ceremony: different amounts for the Civic Centre, Ballyclare Town Hall, and approved venues, and higher on Saturdays and public holidays. The date comparer uses those published bands.

---

## The build rounds

### Round 1 — this build

Onboarding, home, staged then dated checklist with NI legal links, date comparer, supplier finder with shortlists, cards, enquiry drafts and quote comparison, budget with payments, guest list with CSV, JSON backup, installable on a phone as a website-app (PWA). Data stored on the device.

### Round 2

RSVP site with day/evening views, seating with conflict rules, run sheet screen, gifts and thank-yous, mood board, helper permissions.

### Round 3

Cloud sync so both phones stay in step (Supabase in an EU region, with access rules so only you two — and invited helpers — can see the wedding). Public RSVP links. A packaged Android app (Capacitor) if you still want one after using the installable website.

---

## Sharing, privacy and what we still need from you

Round 1 is **local-first**: everything is saved in your browser (IndexedDB) behind a storage layer that can later talk to a cloud database.

A Supabase project is already waiting for the sync round (nothing in round 1 talks to it yet — the app still saves on the device through a storage interface):

- Project reference: `edytqwcnxqqzxeepgdjn`
- URL: https://edytqwcnxqqzxeepgdjn.supabase.co
- Region: **eu-west-2 (London)**
- Plan: Free

No API keys are stored in this repository. To turn on two-phone sharing and a public RSVP page, we will still need:

1. The project’s **anonymous public key** (the `anon` key), given securely — never the secret service-role key, and never committed to git.
2. An email address each so you and your partner can sign in separately (magic link).
3. A short privacy note you are happy to show guests (especially if we store dietary needs).

The database schema, row-level security, and the Supabase storage adapter belong in the sync round. Until then, use the JSON backup if you want a copy of your data.

---

## Technical notes (for whoever builds the next round)

- Vite, React and TypeScript.
- A `StorageAdapter` (`getState` / `setState`) with an IndexedDB implementation now; a Supabase implementation later that upserts the same document or normalised tables, with row-level security.
- PWA via `vite-plugin-pwa` so Android and iPhone can “Add to Home Screen”. A Capacitor Android wrapper can come in round 3.
- GitHub Pages at https://malexander88.github.io/wedding-planner/ (project path `/wedding-planner/`). Deep links such as `/wedding-planner/budget` use the spa-github-pages pattern. The generated `404.html` redirects to `/wedding-planner/?/budget`, which is served with a 200, and a small script in `index.html` restores the real path before React starts. A bare `/wedding-planner` is normalised to `/wedding-planner/`. The first publish used the `gh-pages` branch because the available GitHub token could not push Actions workflow files (`workflow` scope). A workflow file lives in `.github/workflows/pages.yml` locally for when that scope is available.
- No guest identity documents, no vendor marketplace, no selling of guest data.
