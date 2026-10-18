const { test } = require("node:test");
const assert = require("node:assert/strict");
const { geocode, drive } = require("../lib/geo");

const fakeFetch = routes => async url => {
  const hit = Object.entries(routes).find(([k]) => url.includes(k));
  if (!hit) throw new Error("unexpected " + url);
  return { ok: true, status: 200, json: async () => hit[1] };
};

test("geocode returns label and rounded coordinates", async () => {
  const f = fakeFetch({ "nominatim": [{ display_name: "Königsallee 1, Düsseldorf", lat: "51.225412345", lon: "6.778712345" }] });
  assert.deepEqual(await geocode("Königsallee 1", f), { label: "Königsallee 1, Düsseldorf", lat: 51.22541, lon: 6.77871 });
});

test("geocode returns null for no hits", async () => {
  assert.equal(await geocode("nowhere", fakeFetch({ "nominatim": [] })), null);
});

test("drive converts metres and seconds", async () => {
  const f = fakeFetch({ "router.project-osrm.org": { routes: [{ distance: 45600, duration: 1830 }] } });
  assert.deepEqual(await drive({ lat: 51.2, lon: 6.7 }, { lat: 51.4, lon: 7.0 }, f), { roadKm: 46, driveMin: 31 });
});

test("timeouts reject", async () => {
  const slow = (url, opts) => new Promise((_, reject) => opts.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  await assert.rejects(geocode("x", slow, 20));
});
