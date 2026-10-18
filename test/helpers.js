const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../server");

async function start(options = {}) {
  const dir = options.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), "car-hunt-test-"));
  const app = createApp({ dataDir: dir, password: "pw", syncKey: "key", ...options });
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: "Basic " + Buffer.from("u:pw").toString("base64") };
  const sync = { ...auth, "x-sync-key": "key", "Content-Type": "application/json" };
  return { base, auth, sync, dir, close: () => new Promise(r => server.close(r)) };
}

module.exports = { start };
