// lib/store.js — JSON files in DATA_DIR, written atomically.
const fs = require("fs");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJsonAtomic(file, value) {
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  return fs.promises.writeFile(tmp, JSON.stringify(value)).then(() => fs.promises.rename(tmp, file));
}

module.exports = { readJson, writeJsonAtomic };
