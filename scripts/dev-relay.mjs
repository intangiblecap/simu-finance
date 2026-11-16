// Relais HTTP local vers Yahoo Finance et Eurostat, pour le développement dans un environnement
// où le runtime Workers local n'a pas d'accès direct à Internet (ex : derrière un proxy).
// Usage : node scripts/dev-relay.mjs  puis YAHOO_RELAY=http://127.0.0.1:8790 dans .dev.vars
import http from "node:http";
import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

if (process.env.HTTPS_PROXY) setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
const HOSTS = { q1: "https://query1.finance.yahoo.com", q2: "https://query2.finance.yahoo.com", eu: "https://ec.europa.eu" };
const PORT = Number(process.env.PORT || 8790);

http
  .createServer(async (req, res) => {
    const m = req.url.match(/^\/(q1|q2|eu)(\/.*)$/);
    if (!m) return res.writeHead(404).end();
    try {
      const r = await fetch(HOSTS[m[1]] + m[2], { headers: { "User-Agent": req.headers["user-agent"] || "Mozilla/5.0" } });
      res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json" });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(502).end(String(e));
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Relais Yahoo sur http://127.0.0.1:${PORT}`));
