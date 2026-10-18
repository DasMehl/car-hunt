// server.js — Car Hunt: static page + JSON API. Data lives in DATA_DIR.
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readJson, writeJsonAtomic } = require("./lib/store");
const { validateProfile } = require("./lib/profile");

const STATUSES = ["candidate", "contacted", "replied", "call", "viewing", "declined", "dropped", "bought"];
const LISTING_FIELDS = ["title", "shortName", "displayTitle", "make", "model", "fuel", "engine", "facelift", "variant", "trim", "colour", "price", "negotiable", "km", "regMonth", "regYear", "hp", "gearbox", "dsgType", "hu", "owners", "serviceHistory", "timingBelt", "dsgOil", "docsReview", "carplay", "carplayStatus", "camera", "location", "city", "distanceKm", "airKm", "roadKm", "driveMin", "transitMin", "transitCheckedAt", "transitSource", "transitDestination", "transitApproximate", "lat", "lon", "bahnUrl", "mapsUrl", "sellerName", "sellerType", "phone", "url", "kleinanzeigenUrl", "photos", "verdict", "pros", "cons", "questions", "i18n", "equip", "score", "rating", "replyAssessment", "visit", "order", "addedAt", "lastSeenAt", "priceHistory", "gone"];
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
      res.set("WWW-Authenticate", `Basic realm="${(state.profile && state.profile.name || "Car Hunt").replace(/"/g, "")}"`);
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

  app.put("/api/cars/:id", requireKey, async (req, res) => {
    const id = req.params.id, incoming = req.body || {};
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return res.status(400).json({ error: "invalid id" });
    const listing = Object.fromEntries(Object.entries(incoming).filter(([k]) => LISTING_FIELDS.includes(k)));
    const prev = state.cars[id];
    state.cars[id] = prev ? { ...prev, ...listing } : { status: "candidate", pick: false, notes: "", nextStep: "", messages: [], addedAt: today(), ...listing };
    if (!prev && typeof incoming.pick === "boolean") state.cars[id].pick = incoming.pick;
    if (!prev) state.meta.log.unshift({ date: today(), type: "new", id, text: state.cars[id].displayTitle || state.cars[id].title, price: state.cars[id].price });
    try { await persist(); } catch (e) { return res.status(500).json({ error: "save failed" }); }
    res.json({ ok: true, created: !prev });
  });

  app.put("/api/meta", requireKey, async (req, res) => {
    Object.assign(state.meta, req.body || {});
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
      } else if (req.body.complete && !c.gone && !["bought", "declined", "dropped"].includes(c.status)) {
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
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`Car Hunt on :${port}`));
}
