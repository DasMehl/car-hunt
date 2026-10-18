// lib/profile.js — the search profile: defaults and strict validation.
const FUELS = ["diesel", "petrol", "hybrid", "plugin", "electric", "lpg"];
const BODIES = ["estate", "van", "hatchback", "saloon", "suv", "coupe", "convertible"];
const GEARBOXES = ["automatic", "manual", "any"];
const LANGS = ["en", "de", "pt"];
const EQUIP = ["carplay", "camera", "acc", "ahk", "led", "pano", "navi", "seatheat"];
const WEIGHT_KEYS = ["km", "docs", "gearbox", "seller", "price", "distance", "equip"];

function defaultProfile() {
  return {
    version: 1,
    name: "Car Hunt",
    owner: { name: "", hasCar: true },
    home: null,
    languages: ["en", "de", "pt"],
    car: {
      fuels: ["diesel", "petrol", "hybrid"], gearbox: "any",
      bodies: ["estate", "van", "hatchback", "saloon", "suv"], minSeats: 5,
      makes: { include: [], exclude: [] }, models: [], exceptions: [],
      yearFrom: 2015, yearTo: null, maxKm: 200000, minHp: 0
    },
    money: { maxPrice: 15000, negotiableUpTo: 15000, finance: { enabled: false, monthlyCap: 250, months: 60, downPayment: 0, apr: 7.5 } },
    distance: { maxDriveMin: 60, preferTransit: false },
    equipment: { must: [], nice: ["carplay", "camera", "acc", "navi", "seatheat"] },
    avoid: [],
    weights: { km: 2, docs: 2, gearbox: 1, seller: 1.5, price: 1, distance: 1.5, equip: 1 },
    outreach: { enabled: false, language: "de", senderName: "" }
  };
}

// Validators push "path: message" into errs.
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (min, max) => (v, p, e) => { if (typeof v !== "string" || v.length < min || v.length > max) e.push(`${p}: text of ${min}–${max} characters expected`); };
const bool = (v, p, e) => { if (typeof v !== "boolean") e.push(`${p}: true or false expected`); };
const num = (min, max) => (v, p, e) => { if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) e.push(`${p}: number ${min}–${max} expected`); };
const int = (min, max) => (v, p, e) => { if (!Number.isInteger(v) || v < min || v > max) e.push(`${p}: whole number ${min}–${max} expected`); };
const oneOf = list => (v, p, e) => { if (!list.includes(v)) e.push(`${p}: one of ${list.join(", ")} expected`); };
const nullable = f => (v, p, e) => { if (v !== null) f(v, p, e); };
const arr = (f, min, max, unique) => (v, p, e) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) return e.push(`${p}: list of ${min}–${max} items expected`);
  v.forEach((x, i) => f(x, `${p}[${i}]`, e));
  if (unique && new Set(v).size !== v.length) e.push(`${p}: duplicate items`);
};
const obj = shape => (v, p, e) => {
  if (!isObj(v)) return e.push(`${p}: object expected`);
  for (const k of Object.keys(v)) if (!Object.hasOwn(shape, k)) e.push(`${p ? p + "." : ""}${k}: unknown field`);
  for (const [k, f] of Object.entries(shape)) {
    const path = p ? `${p}.${k}` : k;
    if (!(k in v)) e.push(`${path}: missing`); else f(v[k], path, e);
  }
};
const avoidEntry = (v, p, e) => {
  if (!isObj(v)) return e.push(`${p}: object expected`);
  for (const k of Object.keys(v)) if (!["id", "on", "label", "match"].includes(k)) e.push(`${p}.${k}: unknown field`);
  if (typeof v.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(v.id)) e.push(`${p}.id: lowercase id expected`);
  bool(v.on, `${p}.on`, e);
  if (typeof v.id === "string" && v.id.startsWith("custom-")) {
    str(1, 80)(v.label, `${p}.label`, e);
    if (typeof v.match !== "string" || !v.match || v.match.length > 200) e.push(`${p}.match: pattern expected`);
    else { try { new RegExp(v.match, "i"); } catch (err) { e.push(`${p}.match: invalid pattern`); } }
  }
};

const SCHEMA = obj({
  version: (v, p, e) => { if (v !== 1) e.push(`${p}: 1 expected`); },
  name: str(1, 80),
  owner: obj({ name: str(0, 80), hasCar: bool }),
  home: nullable(obj({ label: str(1, 200), lat: num(-90, 90), lon: num(-180, 180) })),
  languages: arr(oneOf(LANGS), 1, 3, true),
  car: obj({
    fuels: arr(oneOf(FUELS), 1, FUELS.length, true), gearbox: oneOf(GEARBOXES),
    bodies: arr(oneOf(BODIES), 1, BODIES.length, true), minSeats: int(2, 9),
    makes: obj({ include: arr(str(1, 40), 0, 60, true), exclude: arr(str(1, 40), 0, 60, true) }),
    models: arr(str(1, 60), 0, 60, true), exceptions: arr(str(1, 80), 0, 100, true),
    yearFrom: int(1990, 2100), yearTo: nullable(int(1990, 2100)), maxKm: int(0, 1000000), minHp: int(0, 1000)
  }),
  money: obj({
    maxPrice: int(0, 1000000), negotiableUpTo: int(0, 1000000),
    finance: obj({ enabled: bool, monthlyCap: int(0, 100000), months: int(6, 120), downPayment: int(0, 1000000), apr: num(0, 30) })
  }),
  distance: obj({ maxDriveMin: int(5, 600), preferTransit: bool }),
  equipment: obj({ must: arr(oneOf(EQUIP), 0, EQUIP.length, true), nice: arr(oneOf(EQUIP), 0, EQUIP.length, true) }),
  avoid: arr(avoidEntry, 0, 100),
  weights: obj(Object.fromEntries(WEIGHT_KEYS.map(k => [k, num(0, 10)]))),
  outreach: obj({ enabled: bool, language: oneOf(LANGS), senderName: str(0, 80) })
});

function validateProfile(input) {
  if (!isObj(input)) return { errors: ["profile must be an object"], value: null };
  const errors = [];
  SCHEMA(input, "", errors);
  if (!errors.length) {
    if (input.money.negotiableUpTo < input.money.maxPrice) errors.push("money.negotiableUpTo: must be at least maxPrice");
    if (input.car.yearTo !== null && input.car.yearTo < input.car.yearFrom) errors.push("car.yearTo: must not be before yearFrom");
    if (!WEIGHT_KEYS.some(k => input.weights[k] > 0)) errors.push("weights: at least one weight must be above 0");
  }
  return { errors, value: errors.length ? null : input };
}

module.exports = { defaultProfile, validateProfile, FUELS, BODIES, GEARBOXES, LANGS, EQUIP, WEIGHT_KEYS };
