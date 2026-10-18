const { test } = require("node:test");
const assert = require("node:assert/strict");
const { defaultProfile, validateProfile } = require("../lib/profile");

test("the default profile is valid", () => {
  const p = defaultProfile();
  p.home = { label: "Königsallee 1, 40212 Düsseldorf", lat: 51.2254, lon: 6.7787 };
  assert.deepEqual(validateProfile(p).errors, []);
});

test("unknown keys, wrong types and bad ranges are rejected", () => {
  const p = defaultProfile();
  p.extra = 1;
  p.car.fuels = ["diesel", "steam"];
  p.money.maxPrice = -5;
  p.weights.km = "high";
  const errs = validateProfile(p).errors.join("\n");
  assert.match(errs, /extra: unknown field/);
  assert.match(errs, /car\.fuels\[1\]/);
  assert.match(errs, /money\.maxPrice/);
  assert.match(errs, /weights\.km/);
});

test("cross-field rules", () => {
  const p = defaultProfile();
  p.money.negotiableUpTo = p.money.maxPrice - 1;
  p.car.yearTo = p.car.yearFrom - 1;
  p.weights = { km: 0, docs: 0, gearbox: 0, seller: 0, price: 0, distance: 0, equip: 0 };
  const errs = validateProfile(p).errors.join("\n");
  assert.match(errs, /negotiableUpTo/);
  assert.match(errs, /yearTo/);
  assert.match(errs, /weights: at least one/);
});

test("custom avoid entries need a label and a valid pattern", () => {
  const p = defaultProfile();
  p.avoid = [{ id: "custom-1", on: true, label: "Rotary", match: "(" }];
  assert.match(validateProfile(p).errors.join("\n"), /avoid\[0\]\.match/);
  p.avoid = [{ id: "custom-1", on: true, label: "Rotary", match: "RX-8|Wankel" }];
  assert.deepEqual(validateProfile(p).errors, []);
});

test("a missing profile body is rejected", () => {
  assert.match(validateProfile(null).errors.join(), /profile must be an object/);
});
