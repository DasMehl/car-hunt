const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./helpers");

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
