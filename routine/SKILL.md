---
name: car-hunt-listing-check
description: Every few hours, scan mobile.de with the Car Hunt profile, add and rate new cars, record price changes, read seller replies and, if allowed, send one short first message per shortlisted car.
---

You maintain a Car Hunt tracker. Fill in the two values below once when installing.

- SITE: `https://YOUR-SITE.up.railway.app`
- Password and sync key: stored in files you choose, e.g. `~/.car-hunt/password` and `~/.car-hunt/sync-key`. Send the password as HTTP Basic auth on every request (`curl -s -u ":$PW" "$SITE/api/cars"`) and the sync key as header `x-sync-key` for bulk writes.

## 0. Read the profile first

`GET $SITE/api/profile`. Every rule below comes from it. If it returns 404, stop and tell the owner to finish the setup wizard on the site.

API: `GET /api/cars` → `{cars: {id: car}}`; `GET /api/meta`; `PATCH /api/cars/<id>` (password only) for `status`, `nextStep`, `notes`, `pick`, `messages`; `PATCH` replaces each field it sends, so `messages` is always the full array: the car's existing `messages` plus the new one. `PUT /api/cars/<id>` (password + sync key) merges listing fields; it ignores `pick` on existing cars, so set or change `pick` with `PATCH {pick}`; `POST /api/sync` (password + sync key) `{"seen": {id: {price, km}}, "complete": true, "checkedAt": ISO}`; `PUT /api/img/<id>-1.jpg` (password + sync key, `Content-Type: image/jpeg`) stores a photo and returns its path.

## 1. Build the searches

Base URL `https://suchen.mobile.de/fahrzeuge/search.html?isSearchRequest=true&dam=false&s=Car&vc=Car&cn=DE&sb=doc&od=down&lang=de` plus:
- price `p=%3A<negotiableUpTo>`, mileage `ml=%3A<car.maxKm>`, year `fr=<car.yearFrom>%3A<car.yearTo or empty>`, power `pw=<round(minHp × 0.7355)>%3A` when minHp > 0;
- location `ll=<home.lat>%2C<home.lon>` and radius `rd=` = maxDriveMin × 1.25 km rounded up to one of 10, 20, 50, 100, 150, 200;
- gearbox `tr=AUTOMATIC_GEAR` or `tr=MANUAL_GEAR` (omit for "any");
- one search per fuel: `ft=DIESEL`, `ft=PETROL`, `ft=HYBRID` are verified; for plug-in, electric and LPG open mobile.de's search form, choose the fuel and copy the `ft=` value from the URL;
- one search per body: `c=EstateCar`, `c=Limousine` (hatchback and saloon), `c=Van` are verified; for SUV, coupé and convertible read `c=` from the search form the same way;
- makes: if `car.makes.include` is not empty, one search per make with `ms=<id>%3B%3B%3B`. Verified ids: VW 25200, Seat 22500, Audi 1900, BMW 3500, Mercedes-Benz 17200, Toyota 24100. For other makes read `ms=` from the search form.

Open one mobile.de page in the browser tool, decline cookies, then `fetch` each search with `&pageNumber=1..5` from that tab and parse with DOMParser (plain curl gets 403). For each `a[href*="details.html"]` above "Ähnliche Fahrzeuge": listing id, title, price, km, first registration, kW, seller type, postcode and town. Stop when a page adds no new ids. Skip damaged, export- or trade-only, taxi and rental cars.

## 2. Sync and new cars

- `seen = {trackerId: {price, km}}` for tracked cars that still appear; `POST /api/sync` with `complete: true`.
- New listings = ids not contained in any tracked `url` or `kleinanzeigenUrl`. Fetch each detail page (`/fahrzeuge/details.html?id=<id>&lang=de`) for HU, owners, service book, accident-free, description (timing belt or chain, gearbox oil), equipment, dealer rating and all image ids (`img.classistatic.de/api/v1/mo-prod/images/<xx>/<uuid>`).
- Apply the profile before adding: fuel, gearbox, body, seats, makes (`exclude` never; `include` only), year, mileage, power, price (`maxPrice`, or up to `negotiableUpTo` when the listing says negotiable/VB), and driving time from home ≤ `distance.maxDriveMin` (OSRM below). Check `avoid`: for every entry with `on: true`, read its definition in `$SITE/drivetrains.json` (custom entries carry their own `match`) and skip matching cars. Adding nothing is fine.
- Look for the same car on Kleinanzeigen; if it is a tracked car, store that link in `kleinanzeigenUrl` instead of adding a duplicate.

### Photos and documents
Download every photo at `?rule=mo-640`, build a contact sheet (`magick montage -tile 6x -geometry 320x240+6+6 *.jpg sheet.jpg`) and look at it. Read document photos (service book, invoices, stickers, odometer) at `?rule=mo-1600`. Write `docsReview` from what the photos prove. Upload the two best photos with `PUT /api/img/<id>-1.jpg` and `-2.jpg` and set `photos` to the returned paths.

### Distance
Geocode "postcode town, Germany" with Nominatim (1 request per second, a descriptive User-Agent), then OSRM `https://router.project-osrm.org/route/v1/driving/<home.lon>,<home.lat>;<lon>,<lat>?overview=false` for `roadKm` and `driveMin`. If `distance.preferTransit` is true, also plan a weekday 10:00 journey with Transitous (`https://api.transitous.org/api/v1/plan?fromPlace=<home.lat>,<home.lon>&toPlace=<lat>,<lon>&time=<ISO>`) and store `transitMin`, `transitCheckedAt`, `transitSource`, `transitDestination`, `transitApproximate`.

### The record
`PUT /api/cars/<id>` with id `<model>-<town>` (lowercase ASCII, unique). Fields: title, displayTitle ("<Make> <Model> <Body> <Trim> · <year>"), make, model, fuel, engine, price, negotiable, km, regMonth, regYear, hp, gearbox, dsgType (name the gearbox and its known risk), hu, owners, serviceHistory, timingBelt, dsgOil, docsReview, carplay, camera, location, city, sellerName, sellerType ("Dealer, 4.8★ (120)" or "Private"), url, photos, equip {carplay, camera, acc, ahk, led, pano, navi, seatheat as 0, 0.3, 0.6 or 1}, lat, lon, roadKm, driveMin, verdict (two sentences), pros, cons, questions, `rating` {km, docs, gearbox, seller, price, distance, equip} from 0 to 10, translations in `i18n.<lang>` for every language in `profile.languages` other than English, addedAt, lastSeenAt, priceHistory. Do not send `score`: the page computes it from `rating` and `profile.weights`. For a new car, send `pick: true` in the PUT when the computed score (Σ rating × weight ÷ Σ weights × 10) is 65 or more; for an existing car set or change it with `PATCH {pick}`.

Rating guide: km ≤ 70 % of maxKm 9–10, ≤ 85 % 7, ≤ 100 % 5. docs: full history with belt and gearbox oil proven 9–10, full history 7–8, described only 5–6, nothing 2–4. gearbox: torque converter or wet dual-clutch 9, dry dual-clutch 5, lower when the oil was never changed. seller: well-rated dealer 8–9, small dealer 7, private 4. price: well under maxPrice 9–10, at maxPrice 7, negotiable range 5. distance: ≤ 50 % of maxDriveMin 10, ≤ 100 % 7–8. equip: every nice-to-have 9–10, half 7, none 4.

## 3. Replies (browser where the owner is logged in)

mobile.de message center (`https://www.mobile.de/message-center`) and the owner's email for seller replies. For each new reply PATCH `messages` with the full array: the car's existing `messages` plus the new message `{date, dir: "in", from, via, text, i18n}`; set `status` (`replied`, `call` if they ask for a call, `declined` if sold or trade-only) and a concrete `nextStep`. Update the facts and `rating` with PUT, and set `replyAssessment` `{score 0–10, summary per language, assessedAt}`. Keep `visit` `{rank, why, next}` on the 3–5 replied cars most worth seeing; remove with `{"visit": null}`.

## 4. First messages (only if `outreach.enabled`)

If `outreach.enabled` is false, skip to section 5.

For each car with `pick: true`, status `candidate`, not gone:
1. Duplicate check, every time, no exceptions: search the tracker (`sellerName`, `url`, `kleinanzeigenUrl`, all message texts), the mobile.de message center and the owner's email for the seller name, the listing id and the listing title (Kleinanzeigen replies arrive as "Re: Nutzer-Anfrage zu deiner Anzeige …"). If any contact exists, do not send; PATCH `status: "contacted"` with a note naming the existing conversation.
2. Re-fetch `GET /api/cars` right before sending; if a message was logged meanwhile, do not send.
3. Write a short, friendly first message in `outreach.language`, signed `outreach.senderName`, with at most three questions: still available and accident-free; service history and gearbox maintenance documented; when a viewing is possible.
4. Send it through `https://www.mobile.de/checkout/core/<listingId>`. It counts as sent once the page title says "Anfrage erfolgreich gesendet". Never send again because a confirmation seems missing; tell the owner instead.
5. PATCH immediately: `status: "contacted"`, `nextStep: "Wait for reply"`, and `messages` as the full array: the car's existing `messages` plus the outgoing message.

## 5. Report

Short summary: searches run, new cars (title, price, km, town, score, drive time), price changes, cars gone, replies read, messages sent or skipped as duplicates.
