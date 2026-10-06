// Minimal Supabase-compatible gateway for local E2E: proxies REST and Auth,
// and implements the handful of Storage endpoints the app uses on disk.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const ROOT = process.env.STORAGE_DIR ?? "/tmp/fmd-storage";
const SIGN = "local-sign-secret";
const proxy = (req, res, port, strip) => {
  const p = http.request({ host: "127.0.0.1", port, path: req.url.replace(strip, "") || "/", method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
};
const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
const tok = (p) => crypto.createHmac("sha256", SIGN).update(p).digest("hex");
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/rest/v1")) return proxy(req, res, 54322, "/rest/v1");
  if (url.pathname.startsWith("/auth/v1")) return proxy(req, res, 9999, "/auth/v1");
  const m = url.pathname.match(/^\/storage\/v1\/object\/(sign|public|list)?\/?(.*)$/);
  if (!m) return json(res, 404, { error: "not found" });
  const [, kind, rest] = m;
  if (kind === "list" && req.method === "POST") {
    const { prefix = "" } = JSON.parse((await body(req)).toString() || "{}");
    const dir = path.join(ROOT, rest, prefix);
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile()) : [];
    return json(res, 200, names.map((name) => ({ name, id: name })));
  }
  if (kind === "sign" && req.method === "POST") {
    const exp = Date.now() + 60000;
    return json(res, 200, { signedURL: `/object/sign/${rest}?token=${exp}.${tok(rest + exp)}` });
  }
  if ((kind === "sign" && req.method === "GET") || kind === "public") {
    if (kind === "sign") {
      const [exp, sig] = (url.searchParams.get("token") ?? "").split(".");
      if (sig !== tok(decodeURIComponent(rest) + exp) || Number(exp) < Date.now()) return json(res, 403, { error: "bad token" });
    }
    const file = path.join(ROOT, decodeURIComponent(rest));
    if (!fs.existsSync(file)) return json(res, 404, { error: "missing" });
    const meta = fs.existsSync(file + ".meta") ? fs.readFileSync(file + ".meta", "utf8") : "application/octet-stream";
    res.writeHead(200, { "content-type": meta });
    return fs.createReadStream(file).pipe(res);
  }
  if (!kind && req.method === "POST") {
    const file = path.join(ROOT, decodeURIComponent(rest));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await body(req));
    fs.writeFileSync(file + ".meta", req.headers["content-type"] ?? "application/octet-stream");
    return json(res, 200, { Key: rest, path: rest.split("/").slice(1).join("/") });
  }
  if (!kind && req.method === "DELETE") {
    const { prefixes = [] } = JSON.parse((await body(req)).toString() || "{}");
    for (const p of prefixes) fs.rmSync(path.join(ROOT, rest, p), { force: true });
    return json(res, 200, prefixes.map((name) => ({ name })));
  }
  json(res, 400, { error: "unsupported" });
}).listen(54321, "127.0.0.1", () => console.log("gateway on 54321"));
