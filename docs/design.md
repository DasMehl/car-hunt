# Car Hunt: design

Date: 18.10.2026.

## Goal

Turn the tracker into something other people can run for their own search. Each person deploys their own copy. On first launch they describe what they are looking for, and the page, the scoring and the Claude routine all follow that description. The app grew out of one family's search, whose fixed rules are being replaced by this profile.

Out of scope: accounts or several searches in one copy, server-side scraping of marketplaces, sending messages from the website, marketplaces other than mobile.de (Kleinanzeigen is only checked for duplicates, as today).

## Decisions

- Each person runs their own copy (fork + Railway). No accounts.
- Cars arrive through a shipped Claude routine template and through a manual "Add a car" form.
- The profile is stored in each copy and edited on the site (setup wizard on first launch, Settings panel afterwards).

## The profile

Stored as `profile.json` in `DATA_DIR`, next to `cars.json` and `meta.json`. One object, version-tagged so later changes can migrate it.

```json
{
  "version": 1,
  "name": "Family car hunt",
  "owner": { "name": "Alex Example", "hasCar": false },
  "home": { "label": "Königsallee 1, 40212 Düsseldorf", "lat": 51.2254, "lon": 6.7787 },
  "languages": ["en", "de", "pt"],
  "car": {
    "fuels": ["diesel"],
    "gearbox": "automatic",
    "bodies": ["estate", "van", "hatchback", "saloon"],
    "minSeats": 5,
    "makes": { "include": ["VW", "Seat", "Audi", "BMW", "Mercedes-Benz"], "exclude": ["Opel", "Hyundai", "Kia", "Skoda", "Peugeot", "Citroen"] },
    "models": [],
    "exceptions": [],
    "yearFrom": 2014, "yearTo": null,
    "maxKm": 230000, "minHp": 110
  },
  "money": {
    "maxPrice": 10000, "negotiableUpTo": 10500,
    "finance": { "enabled": true, "monthlyCap": 250, "months": 60, "downPayment": 0, "apr": 8 }
  },
  "distance": { "maxDriveMin": 40, "preferTransit": true },
  "equipment": { "must": [], "nice": ["carplay", "camera", "acc", "ahk", "led", "seatheat"] },
  "avoid": [ { "id": "vw-dq200", "on": true }, { "id": "bmw-n47", "on": true }, { "id": "custom-1", "on": true, "label": "…", "match": "…" } ],
  "weights": { "km": 2, "docs": 2, "gearbox": 1, "seller": 1.5, "price": 1, "distance": 1.5, "equip": 1 },
  "outreach": { "enabled": true, "language": "de", "senderName": "Alex Example" }
}
```

- `fuels`: any of diesel, petrol, hybrid, plug-in hybrid, electric, LPG.
- `gearbox`: automatic, manual or any.
- `exceptions`: car ids kept even though they break a make rule.
- `avoid`: references a built-in catalogue (`public/drivetrains.json`) of known problem drivetrains, each with id, label in three languages, a matcher (make, engine code or text pattern, year range) and a one-line reason. Users toggle entries and can add free-text entries with their own pattern. Initial catalogue: VW DQ200 dry DSG, VW EA111 1.4 TSI, VW EA189 pre-update 2.0 TDI, Audi multitronic, Audi EA888 gen 2, BMW N47, BMW N13, Mercedes 7G-DCT, Mercedes OM651, any 3.0 V6 diesel, PSA PureTech belt-in-oil.
- `equipment.must` turns a feature into a criterion; `nice` only feeds the equipment sub-rating.

## Server

- `GET /api/profile` and `PUT /api/profile`, both behind the site password. PUT validates every field (types, ranges, known enum values, string lengths) and rejects unknown keys with 400. Writes are atomic like `cars.json`.
- `GET /api/profile` returns 404 when no profile exists; the page treats that as first launch.
- `POST /api/cars` (site password): manual add. Accepts listing URL, title, price, km, year, fuel, gearbox, postcode/town and optional notes. The server geocodes the town with Nominatim and gets the driving time from OSRM, both from `profile.home`, with a 5-second timeout. If either fails the car is still saved with distance left empty. Creates a new id from the title and town.
- The Basic-auth realm and the startup log use `profile.name`.
- A fresh copy starts with an empty car list. An optional seed file is applied only when `SEED=1` is set.

## Page

- **First launch:** when the profile is missing, the page shows a six-step setup wizard instead of the tracker: 1 you and home (address is geocoded on the spot), 2 the car, 3 money, 4 distance and equipment, 5 problem drivetrains and weights, 6 outreach. Each step has sensible defaults so a person can click through. Finishing saves the profile and opens the tracker.
- **Settings panel:** the same fields, reachable from the header. Saving re-renders the page.
- **Scores from weights:** the page computes each car's total from `rating` and `profile.weights` (score = Σ rating × weight ÷ Σ weights × 10, which keeps the maximum at 100). The stored `score` is ignored when a rating exists.
- **Criteria check:** each car is checked against fuel, gearbox, price (with the negotiable margin), mileage, year, makes, driving time and must-have equipment. A car that fails gets an "outside your criteria" label listing the reasons, sorts below matching cars and is hidden by a new default-on filter. Nothing is deleted.
- **Hard-coded text removed:** title, the €250 loan cap, 60 months, APR, home label, the diesel price line and the "DQ250 6-speed only" filter all come from the profile. Fuel cost uses the price of the car's own fuel (default prices for each fuel, editable in the cost panel as today).
- **Add a car** button in the header opens the manual form.
- All new interface text exists in English, German and Portuguese, like the rest of the page.

## Claude routine template

- `routine/SKILL.md` in the repo: a generic version of the current 5-hourly task with no personal data. It reads `GET /api/profile` first and builds every mobile.de search URL from it (make ids, fuel codes, body codes, gearbox, price, mileage, year, search radius in km = `maxDriveMin` × 1.25, rounded up to the next radius mobile.de offers; every hit is then checked by real OSRM driving time). It applies the avoid catalogue and weights, writes ratings (not totals), reads replies from the mobile.de inbox and Gmail, and messages sellers only when `outreach.enabled`. The duplicate check (tracker, mobile.de inbox, Gmail incl. Kleinanzeigen by seller, listing id and title; never re-send) is part of the template.
- `routine/README.md` explains installing it as a Claude Code scheduled task and the two values it needs: the site URL and the sync key.

## Repository and data

- This repository holds only the generic app: server, page, drivetrain catalogue, routine template and setup guide.
- Each copy keeps its profile, cars and car photos in `DATA_DIR` on the host's volume (`DATA_DIR/img` for photos, served by the server). No personal data lives in the code.
- README: what it does, fork, deploy on Railway with a volume, set `SITE_PASSWORD` and `SYNC_KEY`, open the site and run the wizard, install the routine.

## Testing

- Server tests (node:test, like `test/server.test.js`): profile 404 on a fresh copy, PUT validation (bad types, unknown keys, out-of-range numbers), round trip, password required; manual add with network calls stubbed, including geocoding failure; seed not applied without `SEED=1`.
- Pure functions for scoring and the criteria check move into `public/criteria.js` (loaded by the page, required by tests) and get unit tests: weights change the order, each criterion produces its reason, negotiable margin, exceptions, must-have equipment.
- Manual check in the browser: wizard on an empty data dir, settings change re-ranks, an existing data set keeps its cars, messages and statuses after the profile is added.
