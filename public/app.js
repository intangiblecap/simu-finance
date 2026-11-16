// Simu Finance — interface (vanilla JS, sans build).

const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

// ---------- Formatage ----------

const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const numFmt = (d = 2) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

const eur = (n) => eurFmt.format(n ?? 0);
const signedEur = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + eurFmt.format(Math.abs(n ?? 0));
const pct = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + numFmt(2).format(Math.abs(n ?? 0)) + " %";
const tone = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");

function native(n, cur) {
  if (cur === "EUR") return eur(n);
  if (cur === "GBp" || cur === "GBX") return numFmt(2).format(n) + " p";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur }).format(n);
  } catch {
    return numFmt(2).format(n) + " " + cur;
  }
}
const qty = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(n);

function date(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
const shortDate = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const tickDate = (d, long) => {
  if (!long) return shortDate(d);
  const [y, m] = d.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const initials = (name) =>
  esc(
    String(name)
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase(),
  );

// ---------- API ----------

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("Non connecté");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ---------- État ----------

const state = {
  portfolio: null,
  loading: null,
  lastLoad: 0,
  dashRange: "all",
  dashMetric: "value",
  stockRange: "1y",
};

async function loadPortfolio(force = false) {
  if (state.loading) return state.loading;
  if (!force && state.portfolio && Date.now() - state.lastLoad < 60_000) return state.portfolio;
  setRefreshing(true);
  state.loading = api("/api/portfolio")
    .then((p) => {
      state.portfolio = p;
      state.lastLoad = Date.now();
      updatedLabel();
      return p;
    })
    .finally(() => {
      state.loading = null;
      setRefreshing(false);
    });
  return state.loading;
}

function setRefreshing(on) {
  $("#refresh").classList.toggle("spin", on);
}
function updatedLabel() {
  if (!state.portfolio) return;
  const t = new Date(state.portfolio.updatedAt);
  $("#updated").textContent = t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ---------- Graphiques ----------

const charts = new Set();
function destroyCharts() {
  for (const c of charts) c.destroy();
  charts.clear();
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
const PALETTE = ["#1f6feb", "#12a37f", "#e3a008", "#d946ef", "#ef4444", "#0ea5e9", "#f97316", "#8b5cf6", "#14b8a6", "#64748b"];

function lineChart(canvas, labels, datasets, { formatY = eur } = {}) {
  const grid = cssVar("--border");
  const muted = cssVar("--muted");
  const longSpan = labels.length > 1 && Date.parse(labels[labels.length - 1]) - Date.parse(labels[0]) > 300 * 86_400_000;
  const c = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: muted, boxWidth: 12, boxHeight: 2, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            title: (items) => date(items[0].label),
            label: (item) => ` ${item.dataset.label} : ${formatY(item.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: muted, maxTicksLimit: 5, maxRotation: 0, callback: (v, i) => tickDate(labels[i], longSpan) },
        },
        y: {
          position: "right",
          grid: { color: grid },
          border: { display: false },
          ticks: { color: muted, maxTicksLimit: 5, callback: (v) => compact(v, formatY) },
        },
      },
      elements: { point: { radius: 0, hoverRadius: 4 }, line: { borderWidth: 2, tension: 0.15 } },
    },
  });
  charts.add(c);
  return c;
}

function compact(v, formatY) {
  if (formatY !== eur) return formatY(v);
  const a = Math.abs(v);
  if (a >= 1e6) return numFmt(1).format(v / 1e6) + " M€";
  if (a >= 1e4) return numFmt(0).format(v / 1e3) + " k€";
  return numFmt(0).format(v) + " €";
}

function doughnut(canvas, labels, values) {
  const c = new Chart(canvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: PALETTE, borderColor: cssVar("--surface"), borderWidth: 2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (i) => ` ${eur(i.parsed)}` } } },
    },
  });
  charts.add(c);
}

const RANGE_DAYS = { "1m": 31, "3m": 92, "6m": 183, "1y": 366, all: Infinity };
function sliceRange(points, key) {
  const days = RANGE_DAYS[key];
  if (!Number.isFinite(days) || !points.length) return points;
  const last = points[points.length - 1].date;
  const from = new Date(Date.parse(last) - days * 86_400_000).toISOString().slice(0, 10);
  return points.filter((p) => p.date >= from);
}

function seg(name, options, current) {
  return `<div class="seg" data-seg="${name}">${options
    .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === current ? "on" : ""}">${l}</button>`)
    .join("")}</div>`;
}

// ---------- Navigation ----------

function setHeader(title, { back = false } = {}) {
  $("#title").textContent = title;
  $("#back").hidden = !back;
  document.title = title === "Portefeuille" ? "Simu Finance" : `${title} · Simu Finance`;
}
function setTab(tab) {
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
}

let renderToken = 0;
async function route() {
  const token = ++renderToken;
  destroyCharts();
  closeSheet();
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = hash.split("/");
  window.scrollTo(0, 0);
  try {
    if (page === "search") await renderSearch(token);
    else if (page === "stock" && arg) await renderStock(decodeURIComponent(arg), token);
    else await renderDashboard(token);
  } catch (e) {
    if (token !== renderToken) return;
    view.innerHTML = `<div class="card"><div class="error">${esc(e.message)}</div>
      <button class="btn secondary" onclick="location.reload()">Réessayer</button></div>`;
  }
}
const stale = (token) => token !== renderToken;

$("#back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/")));
$("#refresh").addEventListener("click", async () => {
  await loadPortfolio(true).catch(() => {});
  route();
});
$("#logout").addEventListener("click", async () => {
  if (!confirm("Se déconnecter ?")) return;
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login";
});
window.addEventListener("hashchange", route);

// Actualisation à l'ouverture / au retour dans l'app.
let hiddenAt = 0;
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) {
    hiddenAt = Date.now();
  } else if (Date.now() - hiddenAt > 60_000) {
    await loadPortfolio(true).catch(() => {});
    route();
  }
});

// ---------- Tableau de bord ----------

function skeleton() {
  return `<div class="card"><div class="skeleton" style="height:22px;width:40%"></div>
    <div class="skeleton" style="height:40px;width:70%;margin-top:10px"></div>
    <div class="skeleton" style="height:180px;margin-top:16px"></div></div>`;
}

async function renderDashboard(token) {
  setHeader("Portefeuille");
  setTab("home");
  if (!state.portfolio) view.innerHTML = skeleton();
  const p = await loadPortfolio();
  if (stale(token)) return;

  if (!p.positions.length) {
    view.innerHTML = `<div class="card empty">
      <h2>Aucun investissement simulé</h2>
      <p>Cherche une action européenne, choisis une date et un montant : l'app calcule ce que tu aurais gagné ou perdu.</p>
      <a class="btn" href="#/search">Rechercher une action</a></div>`;
    return;
  }

  const s = p.summary;
  const open = p.positions.filter((x) => x.status === "open");
  const closed = p.positions.filter((x) => x.status === "closed");

  view.innerHTML = `
    ${p.errors.length ? `<div class="banner">Données indisponibles pour : ${p.errors.map((e) => esc(e.symbol)).join(", ")}. Les valeurs affichées peuvent être incomplètes.</div>` : ""}
    <section class="card hero">
      <div class="label">Valeur du portefeuille</div>
      <div class="big">${eur(s.value)}</div>
      <div><span class="pill ${tone(s.totalPnl)}">${signedEur(s.totalPnl)} · ${pct(s.totalPnlPct)}</span>
        <span class="muted small">&nbsp;depuis le début</span></div>
      <div class="stats">
        <div class="stat"><div class="k">Aujourd'hui</div><div class="v ${tone(s.dayChange)}">${signedEur(s.dayChange)} <span class="small">${pct(s.dayChangePct)}</span></div></div>
        <div class="stat"><div class="k">Investi (positions ouvertes)</div><div class="v">${eur(s.invested)}</div></div>
        <div class="stat"><div class="k">Plus-value latente</div><div class="v ${tone(s.unrealizedPnl)}">${signedEur(s.unrealizedPnl)}</div></div>
        <div class="stat"><div class="k">Plus-value réalisée</div><div class="v ${tone(s.realizedPnl)}">${signedEur(s.realizedPnl)}</div></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Évolution</h2>
        ${seg("metric", [["value", "Valeur"], ["pnl", "Gain"]], state.dashMetric)}
      </div>
      <div class="chart-box"><canvas id="evo"></canvas></div>
      <div style="margin-top:10px">${seg("range", [["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["1y", "1A"], ["all", "Tout"]], state.dashRange)}</div>
    </section>

    ${open.length ? `<section class="card">
      <h2>Répartition</h2>
      <div class="alloc">
        <div class="chart-box"><canvas id="alloc"></canvas></div>
        <ul class="list">${p.allocation
          .map(
            (a, i) => `<li><div class="row" style="padding:7px 0">
              <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
              <div class="main"><div class="sub" style="color:var(--text)">${esc(a.name)}</div></div>
              <div class="right small"><b>${numFmt(1).format(a.weight)} %</b></div></div></li>`,
          )
          .join("")}</ul>
      </div>
    </section>` : ""}

    ${open.length ? `<section class="card"><h2>Positions ouvertes (${open.length})</h2>
      <ul class="list">${open.map(positionRow).join("")}</ul></section>` : ""}

    ${closed.length ? `<section class="card"><h2>Positions vendues (${closed.length})</h2>
      <ul class="list">${closed.map(positionRow).join("")}</ul></section>` : ""}
  `;

  drawEvolution(p);
  if (open.length) doughnut($("#alloc"), p.allocation.map((a) => a.name), p.allocation.map((a) => a.value));

  view.querySelectorAll("[data-seg]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (el.dataset.seg === "range") state.dashRange = b.dataset.v;
      else state.dashMetric = b.dataset.v;
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      drawEvolution(p);
    }),
  );
}

let evoChart = null;
function drawEvolution(p) {
  if (evoChart) {
    evoChart.destroy();
    charts.delete(evoChart);
  }
  const pts = sliceRange(p.timeline, state.dashRange);
  const labels = pts.map((x) => x.date);
  const accent = cssVar("--accent");
  const muted = cssVar("--muted");
  let datasets;
  if (state.dashMetric === "value") {
    datasets = [
      { label: "Valeur", data: pts.map((x) => x.value), borderColor: accent, backgroundColor: accent + "22", fill: true },
      { label: "Investi", data: pts.map((x) => x.invested), borderColor: muted, borderDash: [5, 4], borderWidth: 1.5, stepped: true },
    ];
  } else {
    const last = pts.length ? pts[pts.length - 1].pnl : 0;
    const col = last >= 0 ? cssVar("--up") : cssVar("--down");
    datasets = [{ label: "Gain cumulé", data: pts.map((x) => x.pnl), borderColor: col, backgroundColor: col + "22", fill: "origin" }];
  }
  evoChart = lineChart($("#evo"), labels, datasets);
}

function positionRow(x) {
  const closed = x.status === "closed";
  const sub = closed
    ? `${qty(x.quantity)} × ${native(x.sellPrice, x.currency)} · vendu le ${date(x.sellDate)}`
    : `${qty(x.quantity)} × ${native(x.price, x.currency)} · depuis le ${date(x.buyDate)}`;
  return `<li><a class="row" href="#/stock/${encodeURIComponent(x.symbol)}">
    <div class="avatar">${initials(x.name)}</div>
    <div class="main"><div class="title">${esc(x.name)}</div><div class="sub">${sub}</div></div>
    <div class="right"><div class="title">${eur(x.value)}</div>
      <div class="small ${tone(x.pnl)}">${signedEur(x.pnl)} · ${pct(x.pnlPct)}</div></div>
  </a></li>`;
}

// ---------- Recherche ----------

let lastQuery = "";
async function renderSearch(token) {
  setHeader("Rechercher");
  setTab("search");
  view.innerHTML = `
    <div class="card">
      <input class="input search-input" id="q" type="search" placeholder="Nom ou ticker (ex : TotalEnergies, MC.PA)"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(lastQuery)}">
      <p class="muted small" style="margin:10px 2px 0">Actions des bourses européennes (Euronext, XETRA, Madrid, Milan, Londres, Suisse, nordiques…).
      Si une action n'apparaît pas, tape directement son ticker Yahoo, par ex. <b>ITX.MC</b>.</p>
    </div>
    <div class="card" id="results" hidden><ul class="list"></ul></div>`;
  const input = $("#q");
  const box = $("#results");
  let timer;
  let seq = 0;
  const run = async () => {
    const q = input.value.trim();
    lastQuery = q;
    if (q.length < 2) {
      box.hidden = true;
      return;
    }
    const my = ++seq;
    box.hidden = false;
    box.querySelector("ul").innerHTML = `<li class="muted small" style="padding:12px 0">Recherche…</li>`;
    try {
      const { results } = await api(`/api/search?q=${encodeURIComponent(q)}`);
      if (my !== seq || stale(token)) return;
      box.querySelector("ul").innerHTML = results.length
        ? results
            .map(
              (r) => `<li><a class="row" href="#/stock/${encodeURIComponent(r.symbol)}">
              <div class="avatar">${initials(r.name)}</div>
              <div class="main"><div class="title">${esc(r.name)}</div><div class="sub">${esc(r.symbol)} · ${esc(r.exchange)}</div></div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--muted)"><path d="M9 18l6-6-6-6"/></svg>
            </a></li>`,
            )
            .join("")
        : `<li class="muted small" style="padding:12px 0">Aucune action européenne trouvée.</li>`;
    } catch (e) {
      if (my === seq) box.querySelector("ul").innerHTML = `<li class="error">${esc(e.message)}</li>`;
    }
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 300);
  });
  if (lastQuery) run();
  // Sur iOS le focus n'ouvre le clavier que suite à un geste ; on essaie quand même.
  setTimeout(() => input.focus(), 50);
}

// ---------- Fiche action ----------

async function renderStock(symbol, token) {
  setHeader(symbol, { back: true });
  setTab("");
  view.innerHTML = skeleton();
  const [q, p] = await Promise.all([
    api(`/api/quote/${encodeURIComponent(symbol)}?range=${state.stockRange}`),
    loadPortfolio().catch(() => null),
  ]);
  if (stale(token)) return;
  setHeader(q.name, { back: true });

  const lots = (p?.positions || []).filter((x) => x.symbol === q.symbol);
  const isEur = q.currency === "EUR";

  view.innerHTML = `
    <section class="card price-head">
      <div class="muted small">${esc(q.symbol)} · ${esc(q.exchange)} · ${esc(q.currency)}</div>
      <div class="big">${native(q.price, q.currency)}</div>
      <span class="pill ${tone(q.change)}">${pct(q.changePct)}</span>
      <span class="muted small">&nbsp;séance${q.marketTime ? " · " + new Date(q.marketTime * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
      ${!isEur ? `<div class="muted small" style="margin-top:6px">≈ ${eur(q.price * q.fx)} au taux actuel</div>` : ""}
      <div class="chart-box small" style="margin-top:14px"><canvas id="pc"></canvas></div>
      <div style="margin-top:10px">${seg("srange", [["1mo", "1M"], ["6mo", "6M"], ["1y", "1A"], ["5y", "5A"], ["max", "Max"]], state.stockRange)}</div>
    </section>

    ${lots.length ? `<section class="card"><h2>Mes positions</h2>${lots.map(lotBlock).join("")}</section>` : ""}

    <section class="card">
      <h2>Simuler un achat</h2>
      <form id="buy" autocomplete="off">
        <div class="grid2">
          <label class="field"><span>Date d'achat</span>
            <input class="input" type="date" name="date" value="${today()}" max="${today()}" required></label>
          <label class="field"><span>Frais de courtage (€)</span>
            <input class="input" type="number" name="fees" inputmode="decimal" min="0" step="0.01" value="0"></label>
        </div>
        <div class="field">${seg("mode", [["amount", "Montant en €"], ["quantity", "Nombre d'actions"]], "amount")}</div>
        <label class="field"><span id="amt-label">Montant à investir (€)</span>
          <input class="input" type="number" name="val" inputmode="decimal" min="0" step="any" placeholder="1000" required></label>
        <div class="estimate" id="est" hidden></div>
        <div class="error" id="buy-err" hidden></div>
        <button class="btn" type="submit" id="buy-btn" disabled>Simuler l'achat</button>
      </form>
      <p class="muted small" style="margin:10px 2px 0">Date passée : cours de clôture de ce jour (ou du jour de bourse suivant). Aujourd'hui : dernier cours connu.
      En mode montant, on achète un nombre entier d'actions.</p>
    </section>`;

  drawPrice(q);
  view.querySelector('[data-seg="srange"]').addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.stockRange = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    try {
      const q2 = await api(`/api/quote/${encodeURIComponent(symbol)}?range=${state.stockRange}`);
      if (!stale(token)) drawPrice(q2, lots);
    } catch (err) {
      toast(err.message);
    }
  });

  bindLots(view, lots, token);
  bindBuyForm(q, token);
}

let priceChart = null;
function drawPrice(q) {
  if (priceChart) {
    priceChart.destroy();
    charts.delete(priceChart);
  }
  const pts = q.points;
  const up = pts.length < 2 || pts[pts.length - 1].close >= pts[0].close;
  const col = cssVar(up ? "--up" : "--down");
  priceChart = lineChart(
    $("#pc"),
    pts.map((x) => x.date),
    [{ label: "Cours", data: pts.map((x) => x.close), borderColor: col, backgroundColor: col + "1f", fill: true }],
    { formatY: (v) => native(v, q.currency) },
  );
}

function lotBlock(x) {
  const closed = x.status === "closed";
  return `<div class="lot" data-id="${x.id}">
    <div class="top">
      <div>
        <div><b>${qty(x.quantity)} action${x.quantity > 1 ? "s" : ""}</b> achetée${x.quantity > 1 ? "s" : ""} le ${date(x.buyDate)}</div>
        <div class="muted small">à ${native(x.buyPrice, x.currency)} · coût ${eur(x.cost)}${x.buyFees ? ` (dont ${eur(x.buyFees)} de frais)` : ""}</div>
        ${closed ? `<div class="muted small">vendue le ${date(x.sellDate)} à ${native(x.sellPrice, x.currency)}${x.sellFees ? ` · frais ${eur(x.sellFees)}` : ""}</div>` : ""}
      </div>
      <div class="right" style="text-align:right">
        <div><b>${eur(x.value)}</b></div>
        <div class="small ${tone(x.pnl)}">${signedEur(x.pnl)}</div>
        <div class="small ${tone(x.pnl)}">${pct(x.pnlPct)}</div>
      </div>
    </div>
    <div class="actions">
      ${closed ? `<button class="btn sm secondary" data-act="reopen">Annuler la vente</button>` : `<button class="btn sm secondary" data-act="sell">Vendre</button>`}
      <button class="btn sm danger" data-act="delete">Supprimer</button>
    </div>
  </div>`;
}

function bindLots(root, lots) {
  root.querySelectorAll(".lot").forEach((el) => {
    const lot = lots.find((l) => String(l.id) === el.dataset.id);
    el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act;
      try {
        if (act === "delete") {
          if (!confirm("Supprimer définitivement cette position simulée ?")) return;
          await api(`/api/positions/${lot.id}`, { method: "DELETE" });
          toast("Position supprimée");
        } else if (act === "reopen") {
          await api(`/api/positions/${lot.id}`, { method: "PATCH", body: { action: "reopen" } });
          toast("Vente annulée");
        } else if (act === "sell") {
          openSellSheet(lot);
          return;
        }
        await loadPortfolio(true);
        route();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function bindBuyForm(q) {
  const form = $("#buy");
  const est = $("#est");
  const err = $("#buy-err");
  const btn = $("#buy-btn");
  let mode = "amount";
  let timer;
  let seq = 0;

  const payload = () => {
    const v = parseFloat(String(form.val.value).replace(",", "."));
    return {
      symbol: q.symbol,
      date: form.date.value || today(),
      fees: parseFloat(String(form.fees.value).replace(",", ".")) || 0,
      mode,
      amount: mode === "amount" ? v : undefined,
      quantity: mode === "quantity" ? v : undefined,
    };
  };

  const preview = async () => {
    const body = payload();
    const v = mode === "amount" ? body.amount : body.quantity;
    err.hidden = true;
    if (!v || v <= 0) {
      est.hidden = true;
      btn.disabled = true;
      return;
    }
    const my = ++seq;
    try {
      const { estimate: e } = await api("/api/positions?dryRun=1", { method: "POST", body });
      if (my !== seq) return;
      est.hidden = false;
      est.innerHTML = `
        <div class="line"><span class="muted">Cours retenu (${date(e.date)})</span><span>${native(e.price, e.currency)}</span></div>
        ${e.currency !== "EUR" ? `<div class="line"><span class="muted">Taux de change</span><span>1 ${esc(e.currency)} = ${numFmt(4).format(e.fx)} €</span></div>` : ""}
        <div class="line"><span class="muted">Quantité</span><span>${qty(e.quantity)}</span></div>
        ${e.fees ? `<div class="line"><span class="muted">Frais</span><span>${eur(e.fees)}</span></div>` : ""}
        <div class="line total"><span>Total investi</span><span>${eur(e.total)}</span></div>`;
      btn.disabled = false;
    } catch (ex) {
      if (my !== seq) return;
      est.hidden = true;
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = true;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    btn.disabled = true;
    timer = setTimeout(preview, 350);
  };

  form.addEventListener("input", schedule);
  form.querySelector('[data-seg="mode"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("#amt-label").textContent = mode === "amount" ? "Montant à investir (€)" : "Nombre d'actions";
    form.val.placeholder = mode === "amount" ? "1000" : "10";
    form.val.step = mode === "amount" ? "any" : "1";
    schedule();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const { estimate: r } = await api("/api/positions", { method: "POST", body: payload() });
      toast(`Achat simulé : ${qty(r.quantity)} × ${q.name}`);
      await loadPortfolio(true);
      location.hash = "#/";
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });
}

// ---------- Vente (feuille modale) ----------

const sheet = $("#sheet");
function closeSheet() {
  if (sheet.open) sheet.close();
}
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) closeSheet();
});

function openSellSheet(lot) {
  $("#sheet-body").innerHTML = `
    <h3>Vendre ${qty(lot.quantity)} × ${esc(lot.name)}</h3>
    <form id="sell" autocomplete="off">
      <div class="grid2">
        <label class="field"><span>Date de vente</span>
          <input class="input" type="date" name="date" value="${today()}" min="${lot.buyDate}" max="${today()}" required></label>
        <label class="field"><span>Frais (€)</span>
          <input class="input" type="number" name="fees" inputmode="decimal" min="0" step="0.01" value="0"></label>
      </div>
      <div class="estimate" id="sell-est"><span class="muted">Calcul…</span></div>
      <div class="error" id="sell-err" hidden></div>
      <div class="grid2">
        <button class="btn secondary" type="button" id="sell-cancel">Annuler</button>
        <button class="btn" type="submit" id="sell-btn" disabled>Vendre</button>
      </div>
    </form>`;
  sheet.showModal();
  const form = $("#sell");
  const est = $("#sell-est");
  const err = $("#sell-err");
  const btn = $("#sell-btn");
  $("#sell-cancel").onclick = closeSheet;
  let seq = 0;
  let timer;
  const body = () => ({ action: "sell", date: form.date.value, fees: parseFloat(String(form.fees.value).replace(",", ".")) || 0 });
  const preview = async () => {
    const my = ++seq;
    err.hidden = true;
    try {
      const { estimate: e } = await api(`/api/positions/${lot.id}?dryRun=1`, { method: "PATCH", body: body() });
      if (my !== seq) return;
      est.innerHTML = `
        <div class="line"><span class="muted">Cours retenu (${date(e.date)})</span><span>${native(e.price, lot.currency)}</span></div>
        <div class="line"><span class="muted">Produit de la vente</span><span>${eur(e.proceeds)}</span></div>
        <div class="line total"><span>Plus-value</span><span class="${tone(e.pnl)}">${signedEur(e.pnl)}</span></div>`;
      btn.disabled = false;
    } catch (ex) {
      if (my !== seq) return;
      est.innerHTML = "";
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = true;
    }
  };
  form.addEventListener("input", () => {
    clearTimeout(timer);
    btn.disabled = true;
    timer = setTimeout(preview, 300);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      await api(`/api/positions/${lot.id}`, { method: "PATCH", body: body() });
      closeSheet();
      toast("Vente simulée enregistrée");
      await loadPortfolio(true);
      route();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });
  preview();
}

// ---------- Divers ----------

let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

route();
