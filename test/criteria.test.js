// test/criteria.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../public/criteria");
const catalogue = require("../public/drivetrains.json");
const { defaultProfile } = require("../lib/profile");

const profile = () => {
  const p = defaultProfile();
  p.car.fuels = ["diesel"]; p.car.gearbox = "automatic"; p.car.makes.exclude = ["Opel"];
  p.money.maxPrice = 10000; p.money.negotiableUpTo = 10500; p.car.maxKm = 200000; p.car.yearFrom = 2014;
  p.distance.maxDriveMin = 40; p.avoid = [{ id: "bmw-n47", on: true }, { id: "vw-dq200", on: true }];
  return p;
};
const golf = { id: "g", title: "VW Golf 7 Variant", model: "VW Golf 7 Variant", engine: "2.0 TDI 150 hp", gearbox: "DSG", dsgType: "6-speed DQ250", price: 9500, km: 160000, regYear: 2016, regMonth: 5, driveMin: 30, equip: { carplay: 1 } };

test("detection", () => {
  assert.equal(C.makeOf(golf), "VW");
  assert.equal(C.makeOf({ model: "Mercedes-Benz B 200" }), "Mercedes-Benz");
  assert.equal(C.makeOf({ make: "Volkswagen" }), "VW");
  assert.equal(C.fuelOf(golf), "diesel");
  assert.equal(C.fuelOf({ engine: "1.4 TSI petrol (EA211) 122 hp" }), "petrol");
  assert.equal(C.fuelOf({ title: "Toyota Prius Hybrid" }), "hybrid");
  assert.equal(C.fuelOf({ fuel: "Diesel" }), "diesel");
  assert.equal(C.gearboxOf(golf), "automatic");
  assert.equal(C.gearboxOf({ gearbox: "Manual" }), "manual");
});

test("score follows the weights", () => {
  const r = { km: 9, docs: 5, gearbox: 9, seller: 8, price: 8, distance: 10, equip: 7 };
  assert.equal(C.scoreCar({ rating: r }, { km: 2, docs: 2, gearbox: 1, seller: 1.5, price: 1, distance: 1.5, equip: 1 }), 79);
  assert.equal(C.scoreCar({ rating: r }, { km: 0, docs: 1, gearbox: 0, seller: 0, price: 0, distance: 0, equip: 0 }), 50);
  assert.equal(C.scoreCar({ score: 61 }, { km: 1 }), 61);
  const a = { rating: { ...r, docs: 2 } }, b = { rating: { ...r, km: 3 } };
  const w1 = { km: 3, docs: 0, gearbox: 0, seller: 0, price: 0, distance: 0, equip: 0 }, w2 = { km: 0, docs: 3, gearbox: 0, seller: 0, price: 0, distance: 0, equip: 0 };
  assert.ok(C.scoreCar(a, w1) > C.scoreCar(b, w1));
  assert.ok(C.scoreCar(a, w2) < C.scoreCar(b, w2));
});

test("a matching car has no reasons", () => {
  assert.deepEqual(C.checkCriteria(golf, profile(), catalogue), []);
});

test("each criterion produces its reason", () => {
  const keys = car => C.checkCriteria({ ...golf, ...car }, profile(), catalogue).map(r => r.key);
  assert.deepEqual(keys({ engine: "1.4 TSI petrol 122 hp" }), ["fuel"]);
  assert.deepEqual(keys({ gearbox: "Manual", dsgType: "" }), ["gearbox"]);
  assert.deepEqual(keys({ title: "Opel Astra", model: "Opel Astra Sports Tourer" }), ["make"]);
  assert.deepEqual(keys({ price: 10400 }), ["price"]);
  assert.deepEqual(keys({ price: 10400, negotiable: true }), []);
  assert.deepEqual(keys({ price: 10600, negotiable: true }), ["price"]);
  assert.deepEqual(keys({ km: 210000 }), ["km"]);
  assert.deepEqual(keys({ regYear: 2013 }), ["year"]);
  assert.deepEqual(keys({ driveMin: 55 }), ["drive"]);
  assert.deepEqual(keys({ driveMin: null }), []);
});

test("exceptions bypass the make rule only", () => {
  const p = profile(); p.car.exceptions = ["astra"];
  const astra = { ...golf, id: "astra", title: "Opel Astra", model: "Opel Astra Sports Tourer" };
  assert.deepEqual(C.checkCriteria(astra, p, catalogue), []);
  assert.deepEqual(C.checkCriteria({ ...astra, km: 250000 }, p, catalogue).map(r => r.key), ["km"]);
});

test("must-have equipment", () => {
  const p = profile(); p.equipment.must = ["carplay", "camera"];
  assert.deepEqual(C.checkCriteria(golf, p, catalogue).map(r => r.value), ["camera"]);
});

test("problem drivetrains", () => {
  const n47 = { ...golf, title: "BMW 318d Touring", model: "BMW 3 Series Touring", engine: "2.0 diesel 143 hp", dsgType: "8-speed ZF", regYear: 2014, regMonth: 6 };
  assert.deepEqual(C.checkCriteria(n47, profile(), catalogue).map(r => r.value), ["bmw-n47"]);
  assert.deepEqual(C.checkCriteria({ ...n47, regYear: 2015, regMonth: 9 }, profile(), catalogue), []);
  const dq200 = { ...golf, dsgType: "7-speed dry-clutch DSG (DQ200)" };
  assert.deepEqual(C.checkCriteria(dq200, profile(), catalogue).map(r => r.value), ["vw-dq200"]);
  const p = profile(); p.avoid = [{ id: "vw-dq200", on: false }];
  assert.deepEqual(C.checkCriteria(dq200, p, catalogue), []);
  p.avoid = [{ id: "custom-1", on: true, label: "No Golf", match: "Golf" }];
  assert.deepEqual(C.checkCriteria(golf, p, catalogue).map(r => r.value), ["custom-1"]);
});

test("every catalogue entry is well formed", () => {
  for (const d of catalogue) {
    assert.match(d.id, /^[a-z0-9-]+$/);
    assert.equal(typeof d.default, "boolean");
    for (const l of ["en", "de", "pt"]) { assert.ok(d.label[l], d.id + " label " + l); assert.ok(d.reason[l], d.id + " reason " + l); }
    assert.doesNotThrow(() => new RegExp(d.test, "i"));
    if (d.unless) assert.doesNotThrow(() => new RegExp(d.unless, "i"));
  }
});

test("fix round 1: makes, fuels, gearbox", () => {
  assert.equal(C.makeOf({ model: "Land Rover Discovery Sport" }), "Land Rover");
  assert.equal(C.makeOf({ model: "Alfa Romeo Giulia" }), "Alfa Romeo");
  assert.equal(C.normMake("land rover"), "Land Rover");
  assert.equal(C.fuelOf({ title: "BMW 320d xDrive Mild-Hybrid" }), "diesel");
  assert.equal(C.fuelOf({ title: "Mercedes C 220 d 48V Mild Hybrid" }), "diesel");
  assert.equal(C.fuelOf({ title: "Mercedes-Benz C 220 d T-Modell" }), "diesel");
  assert.equal(C.gearboxOf({ gearbox: "Manuell" }), "manual");
  assert.equal(C.fuelOf({ title: "Audi e-tron 55 quattro" }), "electric");
  assert.equal(C.fuelOf({ title: "Audi A3 Sportback e-tron" }), "plugin");
  assert.equal(C.fuelOf({ title: "Tesla Model 3" }), "electric");
});

test("fix round 1: drivetrain matching", () => {
  const p = { avoid: [{ id: "vw-ea111", on: true }, { id: "bmw-n47", on: true }] };
  const ids = c => C.avoidHits(c, p, catalogue).map(d => d.id);
  assert.deepEqual(ids({ title: "VW Golf VII 1.4 TSI", model: "VW Golf VII", engine: "1.4 TSI 122 hp", regYear: 2013, regMonth: 6 }), []);
  assert.deepEqual(ids({ model: "VW Touran", engine: "1.4 TSI 140 hp", regYear: 2013 }), ["vw-ea111"]);
  const n47 = { title: "BMW 318d Touring", model: "BMW 3 Series Touring", engine: "2.0 diesel 143 hp", regYear: 2014, regMonth: 6 };
  assert.deepEqual(ids(n47), ["bmw-n47"]);
  assert.deepEqual(ids({ ...n47, engine: "2.0 diesel B47" }), []);
  assert.deepEqual(ids({ title: "BMW 320d Touring", model: "BMW 320d Touring", engine: "2.0 diesel" }), []);
});

test("estimateRating: mileage bands", () => {
  const p = profile(); // maxKm 200000
  const km = v => C.estimateRating({ km: v }, p).km;
  assert.equal(km(140000), 9); assert.equal(km(170000), 7); assert.equal(km(200000), 5); assert.equal(km(200001), 3);
});

test("estimateRating: price bands", () => {
  const p = profile(); // maxPrice 10000, negotiableUpTo 10500
  const price = v => C.estimateRating({ price: v }, p).price;
  assert.equal(price(8500), 9); assert.equal(price(10000), 7); assert.equal(price(10500), 5); assert.equal(price(10501), 2);
});

test("estimateRating: distance bands, by car and by transit", () => {
  const p = profile(); // maxDriveMin 40
  const dist = (c, q = p) => C.estimateRating(c, q).distance;
  assert.equal(dist({ driveMin: 20 }), 10); assert.equal(dist({ driveMin: 40 }), 8); assert.equal(dist({ driveMin: 60 }), 5); assert.equal(dist({ driveMin: 61 }), 2);
  const t = profile(); t.distance.preferTransit = true;
  assert.equal(dist({ driveMin: 20, transitMin: 61 }, t), 2);
});

test("estimateRating: distance is omitted when the trip time is unknown", () => {
  const p = profile();
  assert.ok(!("distance" in C.estimateRating({ price: 9000, driveMin: null }, p)));
  const t = profile(); t.distance.preferTransit = true;
  assert.ok(!("distance" in C.estimateRating({ price: 9000, driveMin: 20 }, t)));
});

test("estimateRating: equipment share and omitted parts", () => {
  const p = profile(); p.equipment.nice = ["carplay", "camera", "acc", "navi", "seatheat"];
  const eq = e => C.estimateRating({ equip: e }, p).equip;
  assert.equal(eq({}), 4);
  assert.equal(eq({ carplay: 1, camera: 0.6, acc: 0.5 }), 6); // 2 of 5 count
  assert.equal(eq({ carplay: 1, camera: 1, acc: 1, navi: 1, seatheat: 1 }), 10);
  const r = C.estimateRating({ ...golf, equip: {} }, p);
  assert.deepEqual(Object.keys(r).sort(), ["distance", "equip", "km", "price"]);
  assert.equal(C.scoreCar({ rating: r }, p.weights), Math.round((7 * 2 + 7 * 1 + 8 * 1.5 + 4 * 1) / 5.5 * 10)); // km 0.8 → 7, price ≤ max → 7, 30 of 40 min → 8
  p.equipment.nice = [];
  assert.equal(C.estimateRating({}, p), null);
});
