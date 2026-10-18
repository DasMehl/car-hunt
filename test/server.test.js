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
    const meta = await fetch(s.base + "/api/meta", { method: "PUT", headers: s.sync, body: JSON.stringify({ x: 1 }) });
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
