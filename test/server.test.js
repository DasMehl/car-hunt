const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./helpers");
const { defaultProfile } = require("../lib/profile");

const json = (h = {}) => ({ ...h, "Content-Type": "application/json" });

test("password protects the API and the page", async () => {
  const s = await start();
  try {
    assert.equal((await fetch(s.base + "/api/cars")).status, 401);
    assert.equal((await fetch(s.base + "/")).status, 401);
    const r = await fetch(s.base + "/api/cars", { headers: s.auth });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual((await r.json()).cars, {});
  } finally { await s.close(); }
});

test("a fresh copy starts empty; the seed is applied only with SEED=1", async () => {
  const seedFile = path.join(__dirname, "fixtures", "seed.json");
  const a = await start({ seedFile });
  try { assert.deepEqual((await (await fetch(a.base + "/api/cars", { headers: a.auth })).json()).cars, {}); }
  finally { await a.close(); }
  process.env.SEED = "1";
  const b = await start({ seedFile });
  try { assert.ok((await (await fetch(b.base + "/api/cars", { headers: b.auth })).json()).cars["example-car"]); }
  finally { await b.close(); delete process.env.SEED; }
});

test("PATCH validates fields and persists", async () => {
  const s = await start();
  try {
    const put = await fetch(s.base + "/api/cars/demo", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Demo", price: 9000 }) });
    assert.equal(put.status, 200);
    assert.equal((await fetch(s.base + "/api/cars/demo", { method: "PATCH", headers: json(s.auth), body: JSON.stringify({ pick: "yes" }) })).status, 400);
    assert.equal((await fetch(s.base + "/api/cars/demo", { method: "PATCH", headers: json(s.auth), body: JSON.stringify({ price: 1 }) })).status, 400);
    assert.equal((await fetch(s.base + "/api/cars/demo", { method: "PATCH", headers: json(s.auth), body: JSON.stringify({ pick: true }) })).status, 200);
    const saved = JSON.parse(fs.readFileSync(path.join(s.dir, "cars.json"), "utf8"));
    assert.equal(saved.demo.pick, true);
  } finally { await s.close(); }
});

test("bulk writes need the sync key", async () => {
  const s = await start();
  try {
    assert.equal((await fetch(s.base + "/api/cars/x", { method: "PUT", headers: json(s.auth), body: "{}" })).status, 401);
    assert.equal((await fetch(s.base + "/api/sync", { method: "POST", headers: s.sync, body: JSON.stringify({ seen: {}, complete: false }) })).status, 200);
  } finally { await s.close(); }
});

test("/healthz is the only route open without the password", async () => {
  const s = await start();
  try {
    const h = await fetch(s.base + "/healthz");
    assert.equal(h.status, 200);
    assert.equal(await h.text(), "ok");
    assert.equal((await fetch(s.base + "/api/cars")).status, 401);
  } finally { await s.close(); }
});

test("a failing save answers 500 and the server keeps running", async () => {
  const s = await start();
  try {
    fs.rmSync(path.join(s.dir, "cars.json"));
    fs.mkdirSync(path.join(s.dir, "cars.json")); // renaming a file onto a directory fails
    const put = await fetch(s.base + "/api/cars/demo", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Demo" }) });
    assert.equal(put.status, 500);
    assert.deepEqual(await put.json(), { error: "save failed" });
    const meta = await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ lastCheck: "2026-10-18" }) });
    assert.equal(meta.status, 500);
    const sync = await fetch(s.base + "/api/sync", { method: "POST", headers: s.sync, body: JSON.stringify({ seen: {}, complete: false }) });
    assert.equal(sync.status, 500);
    assert.equal((await fetch(s.base + "/api/meta", { headers: s.auth })).status, 200);
  } finally { await s.close(); }
});

test("profile: 404 on a fresh copy, validated PUT, round trip", async () => {
  const s = await start();
  try {
    assert.equal((await fetch(s.base + "/api/profile", { headers: s.auth })).status, 404);
    const bad = await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify({ name: "x" }) });
    assert.equal(bad.status, 400);
    assert.ok((await bad.json()).details.length > 0);
    const p = defaultProfile(); p.name = "Our estate hunt";
    assert.equal((await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(p) })).status, 200);
    assert.equal((await (await fetch(s.base + "/api/profile", { headers: s.auth })).json()).name, "Our estate hunt");
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, "profile.json"), "utf8")).name, "Our estate hunt");
    assert.equal((await fetch(s.base + "/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })).status, 401);
  } finally { await s.close(); }
});

test("photos upload to DATA_DIR/img and are served from /img", async () => {
  const s = await start();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
  try {
    assert.equal((await fetch(s.base + "/api/img/a-1.jpg", { method: "PUT", headers: { ...s.auth, "Content-Type": "image/jpeg" }, body: jpeg })).status, 401);
    assert.equal((await fetch(s.base + "/api/img/..%2Fx.jpg", { method: "PUT", headers: { ...s.sync, "Content-Type": "image/jpeg" }, body: jpeg })).status, 400);
    const ok = await fetch(s.base + "/api/img/a-1.jpg", { method: "PUT", headers: { ...s.sync, "Content-Type": "image/jpeg" }, body: jpeg });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).path, "img/a-1.jpg");
    const got = await fetch(s.base + "/img/a-1.jpg", { headers: s.auth });
    assert.equal(got.status, 200);
    assert.deepEqual(Buffer.from(await got.arrayBuffer()), jpeg);
  } finally { await s.close(); }
});

const geoFetch = async url => ({ ok: true, status: 200, json: async () => url.includes("nominatim") ? [{ display_name: "45127 Essen", lat: "51.4556", lon: "7.0116" }] : { routes: [{ distance: 36000, duration: 1920 }] } });
const failFetch = async () => { throw new Error("offline"); };
const homeProfile = () => { const p = defaultProfile(); p.home = { label: "Königsallee 1, 40212 Düsseldorf", lat: 51.2254, lon: 6.7787 }; return p; };
const newCar = { url: "https://suchen.mobile.de/fahrzeuge/details.html?id=123", title: "VW Golf 7 Variant 2.0 TDI", price: 9900, km: 150000, regYear: 2016, fuel: "diesel", gearbox: "automatic", town: "45127 Essen" };

test("manual add geocodes the town and computes the drive", async () => {
  const s = await start({ fetchImpl: geoFetch });
  try {
    await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(homeProfile()) });
    const r = await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) });
    assert.equal(r.status, 201);
    const { id, car } = await r.json();
    assert.equal(id, "vw-golf-7-variant-2-0-tdi-45127-essen");
    assert.equal(car.driveMin, 32);
    assert.equal(car.roadKm, 36);
    assert.equal(car.status, "candidate");
    const again = await (await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) })).json();
    assert.equal(again.id, id + "-2");
  } finally { await s.close(); }
});

test("manual add still saves when geocoding fails, and validates input", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(homeProfile()) });
    const r = await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).car.driveMin, undefined);
    const bad = await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify({ ...newCar, price: "cheap", url: "javascript:alert(1)" }) });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).details.length, 2);
  } finally { await s.close(); }
});

test("geocode endpoint", async () => {
  const s = await start({ fetchImpl: geoFetch });
  try {
    const r = await fetch(s.base + "/api/geocode?q=Essen", { headers: s.auth });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).lat, 51.4556);
  } finally { await s.close(); }
});

test("concurrent manual adds of the same car get different ids", async () => {
  const slowGeo = async url => { await new Promise(r => setTimeout(r, 50)); return geoFetch(url); };
  const s = await start({ fetchImpl: slowGeo });
  try {
    const post = () => fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) });
    const [a, b] = await Promise.all([post(), post()]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const ida = (await a.json()).id, idb = (await b.json()).id;
    assert.notEqual(ida, idb);
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.ok(cars[ida]);
    assert.ok(cars[idb]);
    assert.equal(Object.keys(cars).length, 2);
  } finally { await s.close(); }
});

test("a failed manual-add save answers 500 and leaves no car or log entry behind", async () => {
  const s = await start({ fetchImpl: geoFetch });
  try {
    fs.rmSync(path.join(s.dir, "cars.json"));
    fs.mkdirSync(path.join(s.dir, "cars.json")); // renaming a file onto a directory fails
    const r = await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: "save failed" });
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.deepEqual(cars, {});
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.equal(meta.log.length, 0);
  } finally { await s.close(); }
});

test("a profile name outside Latin-1 still gives a 401 with a password prompt", async () => {
  const s = await start();
  try {
    const p = defaultProfile(); p.name = "Škoda hunt 🚗";
    assert.equal((await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(p) })).status, 200);
    const r = await fetch(s.base + "/");
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("www-authenticate"), 'Basic realm="koda hunt"');
  } finally { await s.close(); }
});

test("sync with complete: true never marks a manually added car gone", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id, car } = await (await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) })).json();
    assert.equal(car.source, "manual");
    await fetch(s.base + "/api/cars/routine-car", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Routine car", price: 9000 }) });
    const r = await fetch(s.base + "/api/sync", { method: "POST", headers: s.sync, body: JSON.stringify({ seen: {}, complete: true }) });
    assert.equal(r.status, 200);
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.notEqual(cars[id].gone, true);
    assert.equal(cars["routine-car"].gone, true);
  } finally { await s.close(); }
});

test("PUT /api/meta accepts only lastCheck", async () => {
  const s = await start();
  try {
    const bad = await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ log: "x" }) });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error: "unsupported field" });
    assert.equal((await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ lastCheck: 5 }) })).status, 400);
    assert.equal((await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ lastCheck: "x".repeat(41) }) })).status, 400);
    const ok = await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ lastCheck: "2026-10-18T10:00:00Z" }) });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).meta.lastCheck, "2026-10-18T10:00:00Z");
    assert.equal((await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ lastCheck: null }) })).status, 200);
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.ok(Array.isArray(meta.log));
  } finally { await s.close(); }
});

test("manual add without regMonth or hp stores null", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { car } = await (await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) })).json();
    assert.equal(car.regMonth, null);
    assert.equal(car.hp, null);
  } finally { await s.close(); }
});

test("PUT /api/cars drops link fields that are not http(s)", async () => {
  const s = await start();
  try {
    const body = { title: "Links", url: "javascript:alert(1)", mapsUrl: "https://maps.example/x", bahnUrl: "data:text/html,x", kleinanzeigenUrl: 42 };
    assert.equal((await fetch(s.base + "/api/cars/links", { method: "PUT", headers: s.sync, body: JSON.stringify(body) })).status, 200);
    const c = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars.links;
    assert.equal(c.url, undefined);
    assert.equal(c.mapsUrl, "https://maps.example/x");
    assert.equal(c.bahnUrl, undefined);
    assert.equal(c.kleinanzeigenUrl, undefined);
    await fetch(s.base + "/api/cars/links", { method: "PUT", headers: s.sync, body: JSON.stringify({ url: "http://a.example/1" }) });
    await fetch(s.base + "/api/cars/links", { method: "PUT", headers: s.sync, body: JSON.stringify({ url: "javascript:x" }) });
    assert.equal((await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars.links.url, "http://a.example/1");
  } finally { await s.close(); }
});

const { spawnSync } = require("node:child_process");
const runServer = env => spawnSync(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { PATH: process.env.PATH, PORT: "0", DATA_DIR: fs.mkdtempSync(path.join(require("node:os").tmpdir(), "car-hunt-start-")), ...env }, timeout: 1500, encoding: "utf8" });

test("the server refuses to start without SITE_PASSWORD unless ALLOW_OPEN=1", () => {
  const refused = runServer({});
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /SITE_PASSWORD/);
  const open = runServer({ ALLOW_OPEN: "1" });
  assert.equal(open.status, null); // still running when the timeout kills it
  assert.match(open.stderr, /ALLOW_OPEN/);
  assert.match(open.stdout, /Car Hunt on/);
});

// ---------- editing and deleting cars ----------
const otherTownFetch = async url => ({ ok: true, status: 200, json: async () => url.includes("nominatim") ? [{ display_name: "50667 Köln", lat: "50.9384", lon: "6.9599" }] : { routes: [{ distance: 41000, duration: 2700 }] } });
const addManual = async s => (await (await fetch(s.base + "/api/cars", { method: "POST", headers: json(s.auth), body: JSON.stringify(newCar) })).json());
const editListing = (s, id, body, headers = json(s.auth)) => fetch(s.base + "/api/cars/" + id + "/listing", { method: "PATCH", headers, body: JSON.stringify(body) });
const breakSaves = s => { fs.rmSync(path.join(s.dir, "cars.json")); fs.mkdirSync(path.join(s.dir, "cars.json")); };

test("editing the price appends to the price history and logs the change", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id } = await addManual(s);
    const r = await editListing(s, id, { price: 9400 });
    assert.equal(r.status, 200);
    const { ok, car } = await r.json();
    assert.equal(ok, true);
    assert.equal(car.price, 9400);
    assert.deepEqual(car.priceHistory.map(p => p.price), [9900, 9400]);
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.equal(meta.log[0].type, "price");
    assert.equal(meta.log[0].id, id);
    assert.equal(meta.log[0].from, 9900);
    assert.equal(meta.log[0].to, 9400);
    const saved = JSON.parse(fs.readFileSync(path.join(s.dir, "cars.json"), "utf8"));
    assert.equal(saved[id].price, 9400);
  } finally { await s.close(); }
});

test("editing the title updates displayTitle and, for manual cars, the model", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id } = await addManual(s);
    const { car } = await (await editListing(s, id, { title: "Skoda Octavia Combi", regYear: 2017, regMonth: 5, hp: null, negotiable: true })).json();
    assert.equal(car.title, "Skoda Octavia Combi");
    assert.equal(car.displayTitle, "Skoda Octavia Combi · 2017");
    assert.equal(car.model, "Skoda Octavia Combi");
    assert.equal(car.regMonth, 5);
    assert.equal(car.hp, null);
    assert.equal(car.negotiable, true);
    await fetch(s.base + "/api/cars/routine-car", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Routine car", displayTitle: "Routine · special", model: "Golf", regYear: 2018, price: 9000 }) });
    const kept = (await (await editListing(s, "routine-car", { km: 120000 })).json()).car;
    assert.equal(kept.displayTitle, "Routine · special");
    const renamed = (await (await editListing(s, "routine-car", { title: "Renamed" })).json()).car;
    assert.equal(renamed.displayTitle, "Renamed · 2018");
    assert.equal(renamed.model, "Golf");
  } finally { await s.close(); }
});

test("editing the town re-geocodes and recomputes the drive", async () => {
  let impl = geoFetch;
  const s = await start({ fetchImpl: (...a) => impl(...a) });
  try {
    await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(homeProfile()) });
    const { id, car: before } = await addManual(s);
    assert.equal(before.driveMin, 32);
    await fetch(s.base + "/api/cars/" + id, { method: "PUT", headers: s.sync, body: JSON.stringify({ transitMin: 50, transitCheckedAt: "2026-10-18" }) });
    impl = otherTownFetch;
    const { car } = await (await editListing(s, id, { town: "50667 Köln" })).json();
    assert.equal(car.location, "50667 Köln");
    assert.equal(car.city, "50667 Köln");
    assert.equal(car.lat, 50.9384);
    assert.equal(car.lon, 6.9599);
    assert.equal(car.roadKm, 41);
    assert.equal(car.driveMin, 45);
    assert.match(car.mapsUrl, /destination=50\.9384,6\.9599$/);
    assert.equal(car.transitMin, undefined);
    assert.equal(car.transitCheckedAt, undefined);
  } finally { await s.close(); }
});

test("editing the town when geocoding fails keeps the town and clears the old distance", async () => {
  let impl = geoFetch;
  const s = await start({ fetchImpl: (...a) => impl(...a) });
  try {
    await fetch(s.base + "/api/profile", { method: "PUT", headers: json(s.auth), body: JSON.stringify(homeProfile()) });
    const { id } = await addManual(s);
    impl = failFetch;
    const r = await editListing(s, id, { town: "Nowhere" });
    assert.equal(r.status, 200);
    const { car } = await r.json();
    assert.equal(car.location, "Nowhere");
    assert.equal(car.city, "Nowhere");
    for (const k of ["lat", "lon", "roadKm", "driveMin", "mapsUrl", "transitMin", "transitCheckedAt"]) assert.equal(car[k], undefined, k);
  } finally { await s.close(); }
});

test("listing edits reject unknown fields, invalid values, unknown cars and missing passwords", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id } = await addManual(s);
    const unknown = await editListing(s, id, { status: "bought" });
    assert.equal(unknown.status, 400);
    assert.deepEqual(await unknown.json(), { error: "unsupported field" });
    const bad = await editListing(s, id, { price: "cheap", url: "http://insecure.example/x", regMonth: 13, negotiable: "yes", fuel: "steam" });
    assert.equal(bad.status, 400);
    const j = await bad.json();
    assert.equal(j.error, "invalid car");
    assert.equal(j.details.length, 5);
    assert.equal((await editListing(s, "no-such-car", { price: 1000 })).status, 404);
    assert.equal((await editListing(s, id, { price: 1000 }, { "Content-Type": "application/json" })).status, 401);
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.equal(cars[id].price, 9900);
  } finally { await s.close(); }
});

test("a failed listing save answers 500 and restores the car", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id } = await addManual(s);
    breakSaves(s);
    const r = await editListing(s, id, { price: 8000, title: "Changed" });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: "save failed" });
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.equal(cars[id].price, 9900);
    assert.equal(cars[id].title, newCar.title);
    assert.equal(cars[id].priceHistory.length, 1);
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.equal(meta.log.filter(e => e.type === "price").length, 0);
  } finally { await s.close(); }
});

test("DELETE removes the car, its log entries and its photos", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    await fetch(s.base + "/api/cars/golf", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Golf", price: 9000 }) });
    await fetch(s.base + "/api/cars/golf-2", { method: "PUT", headers: s.sync, body: JSON.stringify({ title: "Golf 2", price: 9500 }) });
    await editListing(s, "golf", { price: 8800 });
    const img = path.join(s.dir, "img");
    for (const f of ["golf-1.jpg", "golf-2.jpg", "golf-2-1.jpg", "polo-1.jpg"]) fs.writeFileSync(path.join(img, f), "x");
    assert.equal((await fetch(s.base + "/api/cars/golf", { method: "DELETE", headers: { "Content-Type": "application/json" } })).status, 401);
    const r = await fetch(s.base + "/api/cars/golf", { method: "DELETE", headers: s.auth });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.equal(cars.golf, undefined);
    assert.ok(cars["golf-2"]);
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.equal(meta.log.filter(e => e.id === "golf").length, 0);
    assert.equal(meta.log.filter(e => e.id === "golf-2").length, 1);
    assert.deepEqual(fs.readdirSync(img).sort(), ["golf-2-1.jpg", "polo-1.jpg"]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.dir, "cars.json"), "utf8")).golf, undefined);
    assert.equal((await fetch(s.base + "/api/cars/golf", { method: "DELETE", headers: s.auth })).status, 404);
  } finally { await s.close(); }
});

test("a failed delete answers 500 and restores the car and its log entries", async () => {
  const s = await start({ fetchImpl: failFetch });
  try {
    const { id } = await addManual(s);
    fs.writeFileSync(path.join(s.dir, "img", id + "-1.jpg"), "x");
    breakSaves(s);
    const r = await fetch(s.base + "/api/cars/" + id, { method: "DELETE", headers: s.auth });
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: "save failed" });
    const cars = (await (await fetch(s.base + "/api/cars", { headers: s.auth })).json()).cars;
    assert.ok(cars[id]);
    const meta = await (await fetch(s.base + "/api/meta", { headers: s.auth })).json();
    assert.equal(meta.log.filter(e => e.id === id).length, 1);
    assert.ok(fs.existsSync(path.join(s.dir, "img", id + "-1.jpg")));
  } finally { await s.close(); }
});
