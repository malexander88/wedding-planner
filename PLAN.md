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

1. **A curated starter list** of venues and suppliers around Antrim, Newtownabbey and Belfast, each checked against a public official page (the council’s approved civil-venue list, the supplier’s own website, or nidirect). We only store the facts we verified: name, area, website, category, and sometimes a public phone number.
2. **Search buttons** that open Google, Hitched, Bridebook and Google Maps with the category and your area already filled in.
3. **Add someone yourself** if you found them another way.

Later, an AI or web-search helper can plug into the same “find” slot without changing the shortlist, quote or booking flow. Enquiry drafts are written on your phone for you to copy; nothing is emailed automatically.

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
- GitHub Pages at https://malexander88.github.io/wedding-planner/ (project path `/wedding-planner/`). The first publish used the `gh-pages` branch because the available GitHub token could not push Actions workflow files (`workflow` scope). A workflow file lives in `.github/workflows/pages.yml` locally for when that scope is available.
- No guest identity documents, no vendor marketplace, no selling of guest data.
