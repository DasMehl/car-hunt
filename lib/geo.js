// lib/geo.js — Nominatim geocoding and OSRM driving time, with timeouts.
const UA = "car-hunt/0.1 (+https://github.com/DasMehl/car-hunt)";

async function getJson(fetchImpl, url, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetchImpl(url, { signal: ac.signal, headers: { "User-Agent": UA, "Accept-Language": "de,en" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function geocode(query, fetchImpl = globalThis.fetch, ms = 5000) {
  const j = await getJson(fetchImpl, "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(query), ms);
  if (!Array.isArray(j) || !j.length) return null;
  return { label: j[0].display_name, lat: +(+j[0].lat).toFixed(5), lon: +(+j[0].lon).toFixed(5) };
}

async function drive(from, to, fetchImpl = globalThis.fetch, ms = 5000) {
  const j = await getJson(fetchImpl, `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`, ms);
  const r = j && j.routes && j.routes[0];
  if (!r) return null;
  return { roadKm: Math.round(r.distance / 1000), driveMin: Math.round(r.duration / 60) };
}

module.exports = { geocode, drive };
