# Wedding Planner

A shared wedding planner for couples starting from scratch — no date, nothing booked yet. Built first for a wedding in and around Belfast, Antrim and Newtownabbey, with Northern Ireland legal dates baked into the checklist.

## What’s in this version

Onboarding, a home dashboard, a staged then dated checklist, a date comparer (UK/NI bank holidays and Antrim & Newtownabbey registrar fee bands), a supplier finder with a verified local starter list plus search buttons, quote comparison, a budget with payments, and a household guest list with CSV export.

Data is stored on your device. Two-phone sharing and a public RSVP page need a cloud database, which is not connected yet.

Install it from the browser: on iPhone use Share → Add to Home Screen; on Android use the install prompt or the browser menu.

The live site is https://malexander88.github.io/wedding-planner/

See `PLAN.md` for the full picture and later rounds.

## Develop

```bash
npm install
npm run dev
```

GitHub Pages builds set `GITHUB_PAGES=true` so the app is served from `/wedding-planner/`.
