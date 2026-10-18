// public/criteria.js — detection, score and criteria check. Loaded by the page (window.Criteria) and by the tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Criteria = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const WEIGHT_KEYS = ["km", "docs", "gearbox", "seller", "price", "distance", "equip"];
  const ALIASES = { volkswagen: "VW", vw: "VW", mercedes: "Mercedes-Benz", "mercedes-benz": "Mercedes-Benz", "škoda": "Skoda", skoda: "Skoda", "citroën": "Citroen", citroen: "Citroen", bmw: "BMW", ds: "DS", kia: "Kia", mini: "Mini", seat: "Seat", cupra: "Cupra", "land rover": "Land Rover", "alfa romeo": "Alfa Romeo", "aston martin": "Aston Martin", "rolls-royce": "Rolls-Royce", "rolls royce": "Rolls-Royce", "mercedes-amg": "Mercedes-Benz" };
  const MULTI = /^(land rover|alfa romeo|aston martin|rolls[- ]royce|mercedes-amg)\b/i;

  function normMake(s) {
    if (!s) return null;
    const k = String(s).trim().toLowerCase();
    if (!k) return null;
    return ALIASES[k] || k[0].toUpperCase() + k.slice(1);
  }
  function makeOf(car) {
    if (car.make) return normMake(car.make);
    const name = String(car.model || car.title || "").trim();
    const m = name.match(MULTI);
    if (m) return normMake(m[1].replace(/\s+/g, " "));
    if (/^mercedes/i.test(name)) return "Mercedes-Benz";
    return normMake(name.split(/\s+/)[0]);
  }
  function fuelOf(car) {
    if (car.fuel) { const f = String(car.fuel).toLowerCase(); return /plug/.test(f) ? "plugin" : f; }
    const t = [car.engine, car.title, car.displayTitle].filter(Boolean).join(" ").replace(/mild[- ]?hybrid|\b48 ?V\b/gi, " ");
    if (/e-?tron/i.test(t)) return /TFSI|Sportback|A3|Q7|Q5|A6|A7|A8/.test(t) ? "plugin" : "electric";
    if (/plug-?in|PHEV|\bGTE\b|\b\d{3}xe\b|\b\d{3}e\b/i.test(t)) return "plugin";
    if (/hybrid/i.test(t)) return "hybrid";
    if (/electric|Elektro|\bBEV\b|Tesla|\bEV\b|e-Golf|kWh/i.test(t)) return "electric";
    if (/\bLPG\b|Autogas/i.test(t)) return "lpg";
    if (/TDI|diesel|CDI|CDTI|dCi|HDi|CRDi|D-4D|\b\d{3} ?d\b/i.test(t)) return "diesel";
    if (/TSI|TFSI|petrol|benzin|gasoline|\b\d{3}i\b|MPI|Skyactiv-G/i.test(t)) return "petrol";
    return null;
  }
  function gearboxOf(car) {
    const t = [car.gearbox, car.dsgType].filter(Boolean).join(" ");
    if (/manual|manuell|schalt/i.test(t)) return "manual";
    if (/auto|DSG|DCT|tronic|CVT|steptronic|torque/i.test(t)) return "automatic";
    return null;
  }
  function scoreCar(car, weights) {
    const r = car.rating;
    if (!r) return car.score ?? null;
    let sum = 0, w = 0;
    for (const k of WEIGHT_KEYS) {
      const wk = Number((weights || {})[k] || 0);
      if (r[k] == null || !wk) continue;
      sum += Math.max(0, Math.min(10, r[k])) * wk; w += wk;
    }
    return w ? Math.round(sum / w * 10) : null;
  }
  function avoidHits(car, profile, catalogue) {
    const text = [car.engine, car.dsgType, car.gearbox, car.title, car.displayTitle, car.model, car.variant].filter(Boolean).join(" | ");
    const make = makeOf(car), fuel = fuelOf(car), ym = (car.regYear || 0) * 100 + (car.regMonth || 1);
    const hits = [];
    for (const a of profile.avoid || []) {
      if (!a.on) continue;
      const def = a.id.startsWith("custom-") ? { id: a.id, label: { en: a.label, de: a.label, pt: a.label }, reason: { en: "", de: "", pt: "" }, test: a.match } : (catalogue || []).find(d => d.id === a.id);
      if (!def) continue;
      if (def.makes && !def.makes.includes(make)) continue;
      if (def.fuel && fuel && def.fuel !== fuel) continue;
      if ((def.from || def.to) && !car.regYear) continue;
      if (def.from && ym < def.from) continue;
      if (def.to && ym > def.to) continue;
      if (def.unless && new RegExp(def.unless, "i").test(text)) continue;
      if (def.test && !new RegExp(def.test, "i").test(text)) continue;
      hits.push(def);
    }
    return hits;
  }
  function checkCriteria(car, profile, catalogue) {
    const p = profile, out = [];
    const fuel = fuelOf(car);
    if (fuel && !p.car.fuels.includes(fuel)) out.push({ key: "fuel", value: fuel });
    const gb = gearboxOf(car);
    if (p.car.gearbox !== "any" && gb && gb !== p.car.gearbox) out.push({ key: "gearbox", value: gb });
    const make = makeOf(car);
    if (make && !(p.car.exceptions || []).includes(car.id)) {
      const inc = (p.car.makes.include || []).map(normMake), exc = (p.car.makes.exclude || []).map(normMake);
      if (exc.includes(make) || (inc.length && !inc.includes(make))) out.push({ key: "make", value: make });
    }
    if (car.price != null && !(car.price <= p.money.maxPrice || (car.negotiable && car.price <= p.money.negotiableUpTo))) out.push({ key: "price", value: car.price });
    if (car.km != null && car.km > p.car.maxKm) out.push({ key: "km", value: car.km });
    if (car.regYear && (car.regYear < p.car.yearFrom || (p.car.yearTo && car.regYear > p.car.yearTo))) out.push({ key: "year", value: car.regYear });
    if (car.hp && p.car.minHp && car.hp < p.car.minHp) out.push({ key: "hp", value: car.hp });
    if (car.driveMin != null && car.driveMin > p.distance.maxDriveMin) out.push({ key: "drive", value: car.driveMin });
    for (const k of p.equipment.must || []) if (!(((car.equip || {})[k] || 0) >= 0.6)) out.push({ key: "equip", value: k });
    for (const d of avoidHits(car, p, catalogue)) out.push({ key: "avoid", value: d.id, def: d });
    return out;
  }
  return { WEIGHT_KEYS, normMake, makeOf, fuelOf, gearboxOf, scoreCar, avoidHits, checkCriteria };
});
