// server.js — Car Hunt: static page + JSON API. Data lives in DATA_DIR.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readJson, writeJsonAtomic } = require("./lib/store");
const { validateProfile } = require("./lib/profile");
const { geocode, drive } = require("./lib/geo");

const STATUSES = ["candidate", "contacted", "replied", "call", "viewing", "declined", "dropped", "bought"];
const LISTING_FIELDS = ["title", "shortName", "displayTitle", "make", "model", "fuel", "engine", "facelift", "variant", "trim", "colour", "price", "negotiable", "km", "regMonth", "regYear", "hp", "gearbox", "dsgType", "hu", "owners", "serviceHistory", "timingBelt", "dsgOil", "docsReview", "carplay", "carplayStatus", "camera", "location", "city", "distanceKm", "airKm", "roadKm", "driveMin", "transitMin", "transitCheckedAt", "transitSource", "transitDestination", "transitApproximate", "lat", "lon", "bahnUrl", "mapsUrl", "sellerName", "sellerType", "phone", "url", "kleinanzeigenUrl", "photos", "verdict", "pros", "cons", "questions", "i18n", "equip", "score", "rating", "replyAssessment", "visit", "order", "addedAt", "lastSeenAt", "priceHistory", "gone", "source"];
const LINK_FIELDS = ["url", "mapsUrl", "bahnUrl", "kleinanzeigenUrl"];
const isHttpUrl = v => typeof v === "string" && /^https?:\/\//i.test(v);
const today = () => new Date().toISOString().slice(0, 10);

function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, "data");
  const password = options.password ?? process.env.SITE_PASSWORD ?? "";
  const syncKey = options.syncKey ?? process.env.SYNC_KEY ?? "";
  const seedFile = options.seedFile || path.join(__dirname, "seed.json");
  const files = { cars: path.join(dataDir, "cars.json"), meta: path.join(dataDir, "meta.json"), profile: path.join(dataDir, "profile.json") };
  fs.mkdirSync(path.join(dataDir, "img"), { recursive: true });

  const state = {
    cars: readJson(files.cars, null),
    meta: readJson(files.meta, { lastCheck: null, log: [] }),
    profile: readJson(files.profile, null)
  };
  if (!state.cars) {
    state.cars = {};
    if (process.env.SEED === "1") {
      const seed = readJson(seedFile, { cars: {} });
      state.cars = seed.cars || {};
      state.meta.lastCheck = seed.snapshotAt || null;
    }
    fs.writeFileSync(files.cars, JSON.stringify(state.cars));
  }

  let writing = Promise.resolve();
  const persist = () => (writing = writing.catch(() => {}).then(() => Promise.all([writeJsonAtomic(files.cars, state.cars), writeJsonAtomic(files.meta, state.meta)])));

  const app = express();
  app.locals.state = state;
  app.locals.files = files;
  app.locals.persist = persist;
  app.locals.fetchImpl = options.fetchImpl || globalThis.fetch;
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff"); res.set("X-Frame-Options", "DENY"); res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/healthz", (req, res) => res.type("text").send("ok"));

  if (password) {
    app.use((req, res, next) => {
      const [scheme, b64] = (req.headers.authorization || "").split(" ");
      const pass = scheme === "Basic" && b64 ? Buffer.from(b64, "base64").toString().split(":").slice(1).join(":") : "";
      const a = Buffer.from(pass), b = Buffer.from(password);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
      // Header values must be Latin-1; keep printable ASCII only so any profile name is safe.
      const realm = String(state.profile && state.profile.name || "").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "").trim() || "Car Hunt";
      res.set("WWW-Authenticate", `Basic realm="${realm}"`);
      res.status(401).send("Password required");
    });
  }

  const requireKey = (req, res, next) => {
    if (!syncKey) return res.status(503).json({ error: "SYNC_KEY not configured" });
    if (req.headers["x-sync-key"] !== syncKey) return res.status(401).json({ error: "bad sync key" });
    next();
  };
  app.locals.requireKey = requireKey;

  app.get("/api/cars", (req, res) => res.json({ cars: state.cars, updatedAt: new Date().toISOString() }));
  app.get("/api/meta", (req, res) => res.json(state.meta));

  app.get("/api/profile", (req, res) => state.profile ? res.json(state.profile) : res.status(404).json({ error: "no profile" }));

  app.put("/api/profile", async (req, res) => {
    const { errors, value } = validateProfile(req.body);
    if (errors.length) return res.status(400).json({ error: "invalid profile", details: errors });
    state.profile = value;
    try { await writeJsonAtomic(files.profile, value); res.json({ ok: true, profile: value }); }
    catch (e) { res.status(500).json({ error: "save failed" }); }
  });

  // Validates listing facts as the add-car dialog sends them. With partial, every field is optional
  // and only the ones present are checked (PATCH /api/cars/:id/listing).
  function checkListing(b, partial) {
    const errors = [], has = k => !partial || k in b;
    const s = (k, max, opt) => { if (!has(k) || (opt && (b[k] == null || b[k] === ""))) return; if (typeof b[k] !== "string" || !b[k].trim() || b[k].length > max) errors.push(`${k}: text expected`); };
    const n = (k, min, max, opt) => { if (!has(k) || (opt && b[k] == null)) return; if (!Number.isInteger(b[k]) || b[k] < min || b[k] > max) errors.push(`${k}: whole number ${min}–${max} expected`); };
    s("title", 120); s("town", 120); s("notes", 5000, true);
    if (has("url") && (typeof b.url !== "string" || !/^https:\/\/[^\s]{4,500}$/.test(b.url))) errors.push("url: https link expected");
    n("price", 0, 1000000); n("km", 0, 2000000); n("regYear", 1980, 2100); n("regMonth", 1, 12, true); n("hp", 1, 2000, true);
    if (has("fuel") && !["diesel", "petrol", "hybrid", "plugin", "electric", "lpg"].includes(b.fuel)) errors.push("fuel: unknown");
    if (has("gearbox") && !["automatic", "manual"].includes(b.gearbox)) errors.push("gearbox: automatic or manual expected");
    if ("negotiable" in b && typeof b.negotiable !== "boolean") errors.push("negotiable: true or false expected");
    return errors;
  }

  // Coordinates, drive from home and route link for a town; fields stay absent when lookup fails.
  async function locate(town) {
    const out = {};
    try {
      const where = await geocode(town, app.locals.fetchImpl);
      if (where) {
        out.lat = where.lat; out.lon = where.lon;
        const home = state.profile && state.profile.home;
        if (home) {
          const r = await drive(home, where, app.locals.fetchImpl);
          if (r) Object.assign(out, r);
          out.mapsUrl = "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(home.label) + `&destination=${where.lat},${where.lon}`;
        }
      }
    } catch (e) { /* distance stays empty */ }
    return out;
  }

  const slug = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

  app.get("/api/geocode", async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q || q.length > 200) return res.status(400).json({ error: "query expected" });
    try { const g = await geocode(q, app.locals.fetchImpl); g ? res.json(g) : res.status(404).json({ error: "not found" }); }
    catch (e) { res.status(502).json({ error: "geocoding failed" }); }
  });

  app.post("/api/cars", async (req, res) => {
    const b = req.body || {}, errors = checkListing(b);
    if (errors.length) return res.status(400).json({ error: "invalid car", details: errors });

    const d = today();
    const car = {
      title: b.title.trim(), displayTitle: `${b.title.trim()} · ${b.regYear}`, model: b.title.trim(), fuel: b.fuel,
      gearbox: b.gearbox === "automatic" ? "Automatic" : "Manual", price: b.price, negotiable: b.negotiable === true, km: b.km, regYear: b.regYear, regMonth: b.regMonth ?? null,
      hp: b.hp ?? null, location: b.town.trim(), city: b.town.trim(), url: b.url, photos: [], source: "manual",
      status: "candidate", pick: false, notes: b.notes || "", nextStep: "", messages: [], addedAt: d, lastSeenAt: d, priceHistory: [{ date: d, price: b.price }]
    };
    Object.assign(car, await locate(b.town));
    // Id is chosen and stored synchronously, after the last await, so concurrent adds cannot share one.
    let id = slug(b.title + " " + b.town) || "car";
    if (state.cars[id]) { let i = 2; while (state.cars[`${id}-${i}`]) i++; id = `${id}-${i}`; }
    state.cars[id] = car;
    const entry = { date: d, type: "new", id, text: car.displayTitle, price: car.price };
    state.meta.log.unshift(entry);
    try { await persist(); }
    catch (e) {
      delete state.cars[id];
      const at = state.meta.log.indexOf(entry);
      if (at >= 0) state.meta.log.splice(at, 1);
      return res.status(500).json({ error: "save failed" });
    }
    res.status(201).json({ ok: true, id, car });
  });

  app.put("/api/img/:name", requireKey, express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), async (req, res) => {
    const name = req.params.name;
    if (!/^[a-z0-9][a-z0-9-]{0,80}\.(jpg|png|webp)$/.test(name)) return res.status(400).json({ error: "invalid name" });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: "image body expected" });
    const file = path.join(dataDir, "img", name);
    const tmp = file + ".tmp";
    try { await fs.promises.writeFile(tmp, req.body); await fs.promises.rename(tmp, file); res.json({ ok: true, path: "img/" + name }); }
    catch (e) { res.status(500).json({ error: "save failed" }); }
  });

  app.patch("/api/cars/:id", async (req, res) => {
    const c = state.cars[req.params.id];
    if (!c) return res.status(404).json({ error: "unknown car" });
    const p = req.body;
    if (!p || typeof p !== "object" || Array.isArray(p)) return res.status(400).json({ error: "invalid update" });
    const allowed = ["status", "nextStep", "notes", "pick", "messages"];
    if (Object.keys(p).some(k => !allowed.includes(k))) return res.status(400).json({ error: "unsupported field" });
    if ("status" in p && !STATUSES.includes(p.status)) return res.status(400).json({ error: "invalid status" });
    if (["nextStep", "notes"].some(k => k in p && (typeof p[k] !== "string" || p[k].length > 10000))) return res.status(400).json({ error: "invalid text" });
    if ("pick" in p && typeof p.pick !== "boolean") return res.status(400).json({ error: "invalid pick" });
    if ("messages" in p && (!Array.isArray(p.messages) || p.messages.length > 200 || p.messages.some(m => !m || typeof m !== "object" || typeof m.text !== "string" || m.text.length > 10000))) return res.status(400).json({ error: "invalid messages" });
    for (const k of allowed) if (k in p) c[k] = p[k];
    try { await persist(); res.json({ ok: true, car: c }); } catch (e) { res.status(500).json({ error: "save failed" }); }
  });

  const EDITABLE = ["url", "title", "price", "km", "regYear", "regMonth", "hp", "fuel", "gearbox", "town", "negotiable"];
  // Fields that describe where the car is; a new town makes all of them stale.
  const PLACE_FIELDS = ["lat", "lon", "roadKm", "driveMin", "mapsUrl", "distanceKm", "airKm", "transitMin", "transitCheckedAt", "transitSource", "transitDestination", "transitApproximate", "bahnUrl"];

  app.patch("/api/cars/:id/listing", async (req, res) => {
    const id = req.params.id, p = req.body;
    if (!state.cars[id]) return res.status(404).json({ error: "unknown car" });
    if (!p || typeof p !== "object" || Array.isArray(p)) return res.status(400).json({ error: "invalid update" });
    if (Object.keys(p).some(k => !EDITABLE.includes(k))) return res.status(400).json({ error: "unsupported field" });
    const errors = checkListing(p, true);
    if (errors.length) return res.status(400).json({ error: "invalid car", details: errors });
    const place = "town" in p ? await locate(p.town.trim()) : null;
    // Everything below runs without awaiting, so a concurrent delete or edit cannot interleave.
    const c = state.cars[id];
    if (!c) return res.status(404).json({ error: "unknown car" });
    const prev = structuredClone(c), d = today();
    const manual = c.source === "manual";
    for (const k of ["url", "km", "regYear", "regMonth", "hp", "fuel", "negotiable"]) if (k in p) c[k] = p[k];
    if ("gearbox" in p) c.gearbox = p.gearbox === "automatic" ? "Automatic" : "Manual";
    if ("title" in p) { c.title = p.title.trim(); if (manual) c.model = c.title; }
    if ("title" in p || (manual && "regYear" in p)) c.displayTitle = c.regYear ? `${c.title} · ${c.regYear}` : c.title;
    let entry = null;
    if ("price" in p && p.price !== c.price) {
      entry = { date: d, type: "price", id, text: c.displayTitle || c.title, from: c.price ?? null, to: p.price };
      c.priceHistory = [...(c.priceHistory || []), { date: d, price: p.price }];
      c.price = p.price;
      state.meta.log.unshift(entry);
    }
    if (place) {
      c.location = c.city = p.town.trim();
      for (const k of PLACE_FIELDS) delete c[k];
      Object.assign(c, place);
    }
    try { await persist(); }
    catch (e) {
      if (state.cars[id] === c) state.cars[id] = prev;
      const at = entry ? state.meta.log.indexOf(entry) : -1;
      if (at >= 0) state.meta.log.splice(at, 1);
      return res.status(500).json({ error: "save failed" });
    }
    res.json({ ok: true, car: c });
  });

  app.delete("/api/cars/:id", async (req, res) => {
    const id = req.params.id, c = state.cars[id];
    if (!c) return res.status(404).json({ error: "unknown car" });
    const log = state.meta.log;
    delete state.cars[id];
    state.meta.log = log.filter(e => e.id !== id);
    try { await persist(); }
    catch (e) {
      if (!state.cars[id]) state.cars[id] = c;
      if (state.meta.log.every(e => e.id !== id)) state.meta.log = [...state.meta.log, ...log.filter(e => e.id === id)].sort((a, b) => log.indexOf(a) - log.indexOf(b));
      return res.status(500).json({ error: "save failed" });
    }
    // Photos are named <id>-N; skip files of another car whose id itself starts with "<id>-".
    const img = path.join(dataDir, "img"), others = Object.keys(state.cars).filter(o => o.startsWith(id + "-"));
    try {
      for (const f of await fs.promises.readdir(img)) {
        if (!f.startsWith(id + "-") || others.some(o => f.startsWith(o + "-"))) continue;
        await fs.promises.unlink(path.join(img, f)).catch(() => {});
      }
    } catch (e) { /* photos stay behind; the car is gone */ }
    res.json({ ok: true });
  });

  app.put("/api/cars/:id", requireKey, async (req, res) => {
    const id = req.params.id, incoming = req.body || {};
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return res.status(400).json({ error: "invalid id" });
    const listing = Object.fromEntries(Object.entries(incoming).filter(([k, v]) => LISTING_FIELDS.includes(k) && (!LINK_FIELDS.includes(k) || isHttpUrl(v))));
    const prev = state.cars[id];
    state.cars[id] = prev ? { ...prev, ...listing } : { status: "candidate", pick: false, notes: "", nextStep: "", messages: [], addedAt: today(), ...listing };
    if (!prev && typeof incoming.pick === "boolean") state.cars[id].pick = incoming.pick;
    if (!prev) state.meta.log.unshift({ date: today(), type: "new", id, text: state.cars[id].displayTitle || state.cars[id].title, price: state.cars[id].price });
    try { await persist(); } catch (e) { return res.status(500).json({ error: "save failed" }); }
    res.json({ ok: true, created: !prev });
  });

  app.put("/api/meta", requireKey, async (req, res) => {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some(k => k !== "lastCheck")) return res.status(400).json({ error: "unsupported field" });
    if ("lastCheck" in b) {
      if (b.lastCheck !== null && (typeof b.lastCheck !== "string" || b.lastCheck.length > 40)) return res.status(400).json({ error: "invalid lastCheck" });
      state.meta.lastCheck = b.lastCheck;
    }
    try { await persist(); } catch (e) { return res.status(500).json({ error: "save failed" }); }
    res.json({ ok: true, meta: state.meta });
  });

  app.post("/api/sync", requireKey, async (req, res) => {
    const seen = (req.body && req.body.seen) || {}, d = today(), changes = [];
    for (const [id, c] of Object.entries(state.cars)) {
      const s = seen[id];
      if (s) {
        c.lastSeenAt = d;
        if (c.gone) { c.gone = false; changes.push({ date: d, type: "back", id, text: c.displayTitle }); }
        if (s.price && s.price !== c.price) { c.priceHistory = [...(c.priceHistory || []), { date: d, price: s.price }]; changes.push({ date: d, type: "price", id, text: c.displayTitle, from: c.price, to: s.price }); c.price = s.price; }
        if (s.km && s.km !== c.km) c.km = s.km;
      } else if (req.body.complete && c.source !== "manual" && !c.gone && !["bought", "declined", "dropped"].includes(c.status)) {
        c.gone = true; c.goneAt = d; changes.push({ date: d, type: "gone", id, text: c.displayTitle });
      }
    }
    state.meta.lastCheck = req.body.checkedAt || new Date().toISOString();
    state.meta.log = [...changes, ...state.meta.log].slice(0, 200);
    try { await persist(); } catch (e) { return res.status(500).json({ error: "save failed" }); }
    res.json({ ok: true, changes });
  });

  app.use("/img", express.static(path.join(dataDir, "img"), { maxAge: "1d" }));
  app.use(express.static(path.join(__dirname, "public"), { index: "index.html", setHeaders: (res, p) => res.set("Cache-Control", /\.(html|json|js)$/.test(p) ? "no-cache" : "public, max-age=86400") }));
  return app;
}

module.exports = { createApp, LISTING_FIELDS, STATUSES };

if (require.main === module) {
  if (!process.env.SITE_PASSWORD) {
    if (process.env.ALLOW_OPEN !== "1") {
      console.error("SITE_PASSWORD is not set. Set it, or set ALLOW_OPEN=1 to run without a password (local use only).");
      process.exit(1);
    }
    console.warn("Warning: ALLOW_OPEN=1 and no SITE_PASSWORD: anyone who can reach this server can see and edit the hunt.");
  }
  const port = process.env.PORT || 3000;
  const app = createApp();
  const profile = app.locals.state.profile;
  app.listen(port, () => console.log(`Car Hunt on :${port}${profile ? ` (${profile.name})` : ""}`));
}
