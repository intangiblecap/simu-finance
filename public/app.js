// Simu Finance — interface (vanilla JS, sans build).
import { articleHtml, libraryHtml, ratePct } from "./method.js";

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
const qty = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: n < 1 ? 6 : 4 }).format(n);

function date(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
// Formatage d'un instant (timestamp en secondes) selon l'échelle du graphique.
const TZ = { timeZone: "Europe/Paris" };
function fmtT(t, kind, tooltip = false) {
  const d = new Date(t * 1000);
  if (kind === "time" || (tooltip && kind === "weekday"))
    return d.toLocaleString("fr-FR", { ...TZ, ...(kind === "weekday" ? { weekday: "short", day: "numeric", month: "short" } : {}), hour: "2-digit", minute: "2-digit" });
  if (kind === "weekday") return d.toLocaleDateString("fr-FR", { ...TZ, weekday: "short", day: "numeric" });
  if (tooltip) return d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  if (kind === "month") return d.toLocaleDateString("fr-FR", { timeZone: "UTC", month: "short", year: "2-digit" });
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
}
const dayKey = (t) => new Date(t * 1000).toLocaleDateString("fr-FR", TZ);
function axisKind(ts, intraday) {
  const span = ts.length > 1 ? ts[ts.length - 1] - ts[0] : 0;
  if (intraday) return span <= 30 * 3600 ? "time" : "weekday";
  return span > 300 * 86400 ? "month" : "day";
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const initials = (name) => {
  const words = String(name)
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter((w) => w && !/^(SE|SA|AG|PLC|NV|AS|SPA|INC|CORP|LTD|GROUP)$/i.test(w));
  const txt = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map((w) => w[0]).join("");
  return esc(txt.toUpperCase());
};

// ---------- API ----------

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(state.portfolioId ? { "X-Portfolio-Id": String(state.portfolioId) } : {}),
      ...(opts.headers || {}),
    },
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
  dashPeriod: "1m",
  benchId: (() => {
    try {
      return localStorage.getItem("benchId");
    } catch {
      return null;
    }
  })(),
  dashMetric: "value",
  stockRange: "1y",
  protected: true,
  config: null,
  gen: 0, // incrémenté à chaque changement de portefeuille
  portfolioId: (() => {
    try {
      return Number(localStorage.getItem("portfolioId")) || null;
    } catch {
      return null;
    }
  })(),
};

// Paramètres de simulation (taux de frais…), servis par /api/config.
let configPromise = null;
function getConfig() {
  configPromise ??= api("/api/config").catch((e) => {
    configPromise = null;
    throw e;
  });
  return configPromise;
}
const feeLabel = () => (state.config ? ratePct(state.config.feeRate) : "");
const feeLink = () =>
  `<a href="#/methode/frais" class="muted">Frais de courtage${state.config ? ` (${feeLabel()})` : ""} ⓘ</a>`;

async function loadPortfolio(force = false) {
  const gen = state.gen;
  if (state.loading && state.loadingGen === gen) return state.loading;
  if (!force && state.portfolio && Date.now() - state.lastLoad < 60_000) return state.portfolio;
  setRefreshing(true);
  const req = api("/api/portfolio")
    .then((p) => {
      // Réponse d'un chargement lancé avant un changement de portefeuille : on l'ignore.
      if (gen !== state.gen) return loadPortfolio();
      state.portfolio = p;
      state.lastLoad = Date.now();
      updatedLabel();
      return p;
    })
    .finally(() => {
      if (state.loading === req) {
        state.loading = null;
        setRefreshing(false);
      }
    });
  state.loading = req;
  state.loadingGen = gen;
  return req;
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

// labels : timestamps (s). intraday : points horodatés à la minute (sinon un point par jour).
function lineChart(canvas, labels, datasets, { formatY = eur, intraday = false } = {}) {
  const grid = cssVar("--border");
  const muted = cssVar("--muted");
  const kind = axisKind(labels, intraday);
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
            title: (items) => fmtT(labels[items[0].dataIndex], kind, true),
            label: (item) => ` ${item.dataset.label} : ${formatY(item.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks:
            kind === "weekday"
              ? // Vue semaine : une étiquette au début de chaque journée.
                { color: muted, autoSkip: false, maxRotation: 0, callback: (v, i) => (i === 0 || dayKey(labels[i]) !== dayKey(labels[i - 1]) ? fmtT(labels[i], kind) : null) }
              : { color: muted, maxTicksLimit: 5, maxRotation: 0, callback: (v, i) => fmtT(labels[i], kind) },
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

function seg(name, options, current) {
  return `<div class="seg" data-seg="${name}">${options
    .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === current ? "on" : ""}">${l}</button>`)
    .join("")}</div>`;
}

// ---------- Navigation ----------

function setHeader(title, { back = false, switcher = false } = {}) {
  const h = $("#title");
  if (switcher) {
    const name = state.portfolio?.portfolio?.name ?? "Portefeuille";
    const btn = $("#pf-switch");
    if (btn) btn.querySelector(".pf-name").textContent = name; // on garde le même bouton (pas de tap perdu)
    else
      h.innerHTML = `<button type="button" class="pf-switch" id="pf-switch" aria-label="Changer de portefeuille">
        <span class="pf-name">${esc(name)}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
    document.title = `${title} · Simu Finance`;
  } else {
    h.textContent = title;
    document.title = `${title} · Simu Finance`;
  }
  $("#back").hidden = !back;
}

// ---------- Portefeuilles ----------

// Un seul écouteur sur la zone de titre : fonctionne même si le bouton vient d'être redessiné.
$("#title").addEventListener("click", (e) => {
  if (e.target.closest("#pf-switch")) openPortfolioSheet();
});
function openSheet() {
  if (!sheet.open) sheet.showModal();
}

function resetPortfolioCaches() {
  state.gen++;
  state.loading = null;
  state.portfolio = null;
  state.lastLoad = 0;
  state.compare = null;
  state.wbDate = null;
  for (const k of Object.keys(timelines)) delete timelines[k];
}

function switchPortfolio(id) {
  state.portfolioId = id;
  try {
    localStorage.setItem("portfolioId", String(id));
  } catch {}
  resetPortfolioCaches();
}

const yearsAgo = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return new Intl.DateTimeFormat("en-CA", TZ).format(d);
};

async function openPortfolioSheet() {
  $("#sheet-body").innerHTML = `<h3>Mes portefeuilles</h3><div class="skeleton" style="height:120px"></div>`;
  openSheet();
  let list;
  try {
    ({ portfolios: list } = await api("/api/portfolios"));
  } catch (e) {
    $("#sheet-body").innerHTML = `<h3>Mes portefeuilles</h3><div class="error">${esc(e.message)}</div>`;
    return;
  }
  const currentId = state.portfolio?.portfolio?.id ?? state.portfolioId ?? list[0]?.id;
  $("#sheet-body").innerHTML = `
    <h3>Mes portefeuilles</h3>
    <ul class="list pf-list">${list
      .map(
        (p) => `<li><button class="row" data-id="${p.id}">
          <span class="radio ${p.id === currentId ? "on" : ""}"></span>
          <div class="main"><div class="title">${esc(p.name)}</div>
            <div class="sub">Depuis le ${date(p.startDate)} · ${p.positions} position${p.positions > 1 ? "s" : ""}</div></div>
        </button></li>`,
      )
      .join("")}</ul>
    <div class="pf-actions">
      <button class="btn sm secondary" id="pf-rename">Renommer</button>
      ${list.length > 1 ? `<button class="btn sm ghost" id="pf-delete">Supprimer</button>` : ""}
    </div>
    <button class="btn" id="pf-new" style="margin-top:14px">+ Nouveau portefeuille</button>`;
  const current = list.find((p) => p.id === currentId);
  $("#sheet-body").querySelectorAll(".pf-list [data-id]").forEach((b) =>
    b.addEventListener("click", () => {
      closeSheet();
      if (Number(b.dataset.id) !== currentId) {
        switchPortfolio(Number(b.dataset.id));
        const h = location.hash;
        if (h.startsWith("#/wayback") || h.startsWith("#/history")) location.hash = "#/";
        else route();
      }
    }),
  );
  $("#pf-rename").onclick = async () => {
    const name = prompt("Nouveau nom du portefeuille", current?.name ?? "");
    if (!name) return;
    try {
      await api(`/api/portfolios/${currentId}`, { method: "PATCH", body: { name } });
      closeSheet();
      resetPortfolioCaches();
      route();
    } catch (e) {
      toast(e.message);
    }
  };
  const del = $("#pf-delete");
  if (del)
    del.onclick = async () => {
      if (!confirm(`Supprimer le portefeuille « ${current?.name} » et toutes ses positions ? Cette action est définitive.`)) return;
      try {
        await api(`/api/portfolios/${currentId}`, { method: "DELETE" });
        closeSheet();
        switchPortfolio(list.find((p) => p.id !== currentId).id);
        toast("Portefeuille supprimé");
        location.hash = "#/";
        route();
      } catch (e) {
        toast(e.message);
      }
    };
  $("#pf-new").onclick = openNewPortfolioForm;
}

function openNewPortfolioForm() {
  const quick = [
    ["Aujourd'hui", today()],
    ["Il y a 1 an", yearsAgo(1)],
    ["Il y a 5 ans", yearsAgo(5)],
    ["Il y a 10 ans", yearsAgo(10)],
  ];
  $("#sheet-body").innerHTML = `
    <h3>Nouveau portefeuille</h3>
    <form id="pf-form" autocomplete="off">
      <label class="field"><span>Nom</span>
        <input class="input" name="name" maxlength="40" placeholder="Ex : Mon PEA, Test luxe, Si j'avais commencé en 2015…" required></label>
      <div class="field"><span class="muted small" style="display:block;margin-bottom:4px">Date de démarrage</span>
        <div class="chips quick" id="pf-quick">${quick.map(([l, d]) => `<button type="button" class="chip ${d === today() ? "on" : ""}" data-d="${d}">${l}</button>`).join("")}</div>
        <input class="input" type="date" name="start" value="${today()}" max="${today()}" min="1990-01-01" style="margin-top:8px" required>
        <p class="muted small" style="margin:6px 0 0">Aucun achat ne pourra être fait avant cette date. Avec une date passée, tu pourras ensuite indiquer ce que tu aurais investi ce jour-là.</p>
      </div>
      <div class="error" id="pf-err" hidden></div>
      <div class="grid2">
        <button class="btn secondary" type="button" id="pf-cancel">Annuler</button>
        <button class="btn" type="submit">Créer</button>
      </div>
    </form>`;
  const form = $("#pf-form");
  $("#pf-cancel").onclick = closeSheet;
  $("#pf-quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-d]");
    if (!b) return;
    form.start.value = b.dataset.d;
    $("#pf-quick").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
  });
  form.start.addEventListener("input", () => $("#pf-quick").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.d === form.start.value)));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const p = await api("/api/portfolios", { method: "POST", body: { name: form.name.value, startDate: form.start.value } });
      closeSheet();
      switchPortfolio(p.id);
      toast(`Portefeuille « ${p.name} » créé`);
      if (p.startDate < today()) {
        // Démarrage dans le passé : on ouvre directement « Remonter le temps » à cette date.
        state.wbDate = p.startDate;
        location.hash = "#/wayback";
      } else {
        location.hash = "#/";
      }
      route();
    } catch (ex) {
      $("#pf-err").textContent = ex.message;
      $("#pf-err").hidden = false;
    }
  });
  setTimeout(() => form.name.focus(), 50);
}
function setTab(tab) {
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
}

let renderToken = 0;
async function route() {
  const token = ++renderToken;
  destroyCharts();
  closeSheet();
  view.classList.remove("has-action");
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = hash.split("/");
  window.scrollTo(0, 0);
  try {
    if (page === "search") await renderSearch(token);
    else if (page === "methode") await renderMethod(arg, token);
    else if (page === "compare") await renderCompare(token);
    else if (page === "wayback") await renderWayback(token);
    else if (page === "history") await renderHistory(token);
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
  setHeader("Portefeuille", { switcher: true });
  setTab("home");
  if (!state.portfolio) view.innerHTML = skeleton();
  const p = await loadPortfolio();
  if (stale(token)) return;
  setHeader("Portefeuille", { switcher: true });
  if (p.portfolio && p.portfolio.id !== state.portfolioId) state.portfolioId = p.portfolio.id;

  if (!p.positions.length) {
    view.innerHTML = `<div class="card empty">
      <h2>Aucun investissement simulé</h2>
      <p>Cherche une action européenne, choisis une date et un montant : l'app calcule ce que tu aurais gagné ou perdu.</p>
      <a class="btn" href="#/search">Découvrir des actions</a>
      <a class="btn secondary" href="#/wayback" style="margin-top:8px">⟲ Remonter le temps</a></div>`;
    return;
  }

  const s = p.summary;
  const open = p.positions.filter((x) => x.status === "open");
  const closed = p.positions.filter((x) => x.status === "closed");

  view.innerHTML = `
    ${state.protected ? "" : `<div class="banner">Accès non protégé : n'importe qui avec l'URL peut voir et modifier ce portefeuille. Ajoute le secret <b>APP_PASSWORD</b> dans Cloudflare pour activer le mot de passe.</div>`}
    ${p.errors.length ? `<div class="banner">Données indisponibles pour : ${p.errors.map((e) => esc(e.symbol)).join(", ")}. Les valeurs affichées peuvent être incomplètes.</div>` : ""}
    <section class="card hero">
      <div class="label">Gain total depuis le ${date(p.portfolio?.startDate)}</div>
      <div class="big ${tone(s.totalPnl)}">${signedEur(s.totalPnl)}</div>
      <div><span class="pill ${tone(s.totalPnlPct)}">${pct(s.totalPnlPct)}</span>
        <span class="muted small">&nbsp;de tout l'argent investi</span></div>
      <div class="muted small" style="margin-top:6px">Aujourd'hui : <span class="${tone(s.dayChange)}">${signedEur(s.dayChange)} (${pct(s.dayChangePct)})</span></div>
      <div class="ledger">
        <div class="line"><span>Valeur actuelle des positions</span><span>${eur(s.value)}</span></div>
        <div class="line"><span>+ Récupéré par les ventes</span><span>${eur(s.proceeds)}</span></div>
        <div class="line"><span>− Total investi <span class="muted small">(tous les achats, frais compris)</span></span><span>${eur(s.totalInvested)}</span></div>
        <div class="line total"><span>= Gain total</span><span class="${tone(s.totalPnl)}">${signedEur(s.totalPnl)}</span></div>
        <div class="muted small" style="margin-top:6px">dont latent ${signedEur(s.unrealizedPnl)} · réalisé ${signedEur(s.realizedPnl)} · frais payés ${eur(s.feesPaid)} ·
          <a href="#/methode/gains">détail du calcul</a></div>
      </div>
    </section>

    <div class="shortcuts">
      <a class="shortcut" href="#/wayback"><span class="ico">⟲</span><span><b>Remonter le temps</b><br><span class="muted small">Modifier mes achats à une date</span></span></a>
      <a class="shortcut" href="#/compare"><span class="ico">⚖</span><span><b>Comparer</b><br><span class="muted small">Indices, inflation</span></span></a>
    </div>

    <section class="card">
      <div class="card-head">
        <h2>Évolution</h2>
        ${seg("metric", [["value", "Valeur"], ["pnl", "Gain"]], state.dashMetric)}
      </div>
      <div class="chart-box"><canvas id="evo"></canvas><div class="chart-msg muted small" id="evo-msg" hidden></div></div>
      <div style="margin-top:10px">${seg("period", [["1d", "1 jour"], ["1w", "1 semaine"], ["1m", "1 mois"]], state.dashPeriod)}</div>
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

    <section class="card">
      <div class="card-head"><h2>Dernières opérations</h2><a href="#/history" class="small">Tout l'historique ›</a></div>
      ${timelineHtml(portfolioEvents(p).slice(0, 3))}
    </section>

    ${open.length ? `<section class="card"><h2>Positions ouvertes (${open.length})</h2>
      <ul class="list">${open.map(positionRow).join("")}</ul></section>` : ""}

    ${closed.length ? `<section class="card"><h2>Positions vendues (${closed.length})</h2>
      <ul class="list">${closed.map(positionRow).join("")}</ul></section>` : ""}
  `;

  drawEvolution(token);
  if (open.length) doughnut($("#alloc"), p.allocation.map((a) => a.name), p.allocation.map((a) => a.value));

  view.querySelectorAll("[data-seg]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (el.dataset.seg === "period") state.dashPeriod = b.dataset.v;
      else state.dashMetric = b.dataset.v;
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      drawEvolution(token);
    }),
  );
}

let evoChart = null;
const timelines = {}; // cache par période : { at, data }
async function drawEvolution(token) {
  const period = state.dashPeriod;
  const metric = state.dashMetric;
  const msg = $("#evo-msg");
  const key = `${state.gen}:${period}`;
  let cached = timelines[key];
  if (!cached || cached.at < state.lastLoad || Date.now() - cached.at > 120_000) {
    msg.hidden = false;
    msg.textContent = "Chargement…";
    try {
      cached = timelines[key] = { at: Date.now(), data: await api(`/api/timeline?period=${period}`) };
    } catch (e) {
      if (!stale(token)) msg.textContent = e.message;
      return;
    }
  }
  // L'utilisateur a pu changer de vue ou de période pendant le chargement.
  if (stale(token) || period !== state.dashPeriod || metric !== state.dashMetric || !$("#evo")) return;
  if (evoChart) {
    evoChart.destroy();
    charts.delete(evoChart);
    evoChart = null;
  }
  const pts = cached.data.points;
  if (pts.length < 2) {
    msg.hidden = false;
    msg.textContent = "Pas encore assez de données sur cette période.";
    return;
  }
  msg.hidden = true;
  const labels = pts.map((x) => x.t);
  const accent = cssVar("--accent");
  const muted = cssVar("--muted");
  let datasets;
  if (metric === "value") {
    datasets = [
      { label: "Valeur", data: pts.map((x) => x.value), borderColor: accent, backgroundColor: accent + "22", fill: true },
      { label: "Investi", data: pts.map((x) => x.invested), borderColor: muted, borderDash: [5, 4], borderWidth: 1.5, stepped: true },
    ];
  } else {
    const last = pts[pts.length - 1].pnl;
    const col = last >= 0 ? cssVar("--up") : cssVar("--down");
    datasets = [{ label: "Gain cumulé", data: pts.map((x) => x.pnl), borderColor: col, backgroundColor: col + "22", fill: "origin" }];
  }
  evoChart = lineChart($("#evo"), labels, datasets, { intraday: period !== "1m" });
}

// ---------- Comparer : le portefeuille face aux références ----------

let benchChart = null;
async function renderCompare(token) {
  setHeader("Comparer", { switcher: true });
  setTab("compare");
  loadPortfolio()
    .then(() => !stale(token) && setHeader("Comparer", { switcher: true }))
    .catch(() => {});
  view.innerHTML = skeleton();
  if (!state.compare || state.compare.gen !== state.gen || state.compare.at < state.lastLoad || Date.now() - state.compare.at > 300_000) {
    const gen = state.gen;
    const data = await api("/api/benchmark");
    if (gen !== state.gen) return; // portefeuille changé entre-temps : un nouveau rendu est en cours
    state.compare = { at: Date.now(), gen, data };
  }
  if (stale(token)) return;
  const d = state.compare.data;
  if (!d.portfolio) {
    view.innerHTML = `<div class="card empty"><h2>Rien à comparer pour l'instant</h2>
      <p>Simule un premier achat : tu pourras ensuite comparer tes gains à ceux des grands indices et de l'inflation.</p>
      <a class="btn" href="#/search">Découvrir des actions</a></div>`;
    return;
  }
  const refs = d.references.filter((r) => r.summary);
  const sel = refs.find((r) => r.id === state.benchId) ?? refs.find((r) => r.id === state.config?.defaultBenchmark) ?? refs[0];
  const infl = refs.find((r) => r.kind === "inflation");
  const real = infl ? d.portfolio.pnl - infl.summary.pnl : null;
  const groups = [...new Set(refs.map((r) => r.group))];
  // Écart = mon gain − gain de la référence (positif : je fais mieux).
  const diffBadge = (x) => `<div class="muted small">écart</div><div class="${tone(x)}"><b>${signedEur(x)}</b></div>`;

  view.innerHTML = `
    <section class="card">
      <p style="margin:0 0 12px">Et si tu avais placé <b>le même argent, aux mêmes dates</b>, ailleurs que dans tes actions ?
        <span class="muted small">Depuis ton premier achat (${date(d.since)}), ${eur(d.totalCost)} investis au total.</span></p>
      <div class="bench-stats">
        <div class="stat"><div class="k">Mon portefeuille</div>
          <div class="v ${tone(d.portfolio.pnl)}">${signedEur(d.portfolio.pnl)}</div><div class="small ${tone(d.portfolio.pct)}">${pct(d.portfolio.pct)}</div></div>
        ${real != null ? `<div class="stat"><div class="k">Gain réel, après inflation</div>
          <div class="v ${tone(real)}">${signedEur(real)}</div><div class="small muted">ce que tu gagnes en pouvoir d'achat</div></div>` : ""}
      </div>
    </section>

    <section class="card">
      <h2>Toutes les références</h2>
      <p class="muted small" style="margin:-6px 0 4px">Gain qu'aurait rapporté chaque placement. L'<b>écart</b> est positif quand tu fais mieux. Touche une ligne pour l'afficher sur le graphique.</p>
      ${groups
        .map(
          (g) => `<h3 class="sub-h">${esc(g)}</h3><ul class="list ref-list">${refs
            .filter((r) => r.group === g)
            .map(
              (r) => `<li><button class="row ref ${r.id === sel.id ? "on" : ""}" data-id="${r.id}">
                <div class="main"><div class="title">${esc(r.name)}</div>
                  <div class="sub ${tone(r.summary.pnl)}">${signedEur(r.summary.pnl)} · ${pct(r.summary.pct)}</div></div>
                <div class="right">${diffBadge(r.summary.difference)}</div></button></li>`,
            )
            .join("")}</ul>`,
        )
        .join("")}
      ${d.references.filter((r) => r.error).map((r) => `<p class="error small">${esc(r.name)} indisponible : ${esc(r.error)}</p>`).join("")}
    </section>

    <section class="card" id="bench-detail"></section>
    <p class="muted small" style="text-align:center"><a href="#/methode/indices">Comment est fait ce calcul ? Pourquoi pas le PIB ?</a></p>`;

  const showDetail = (r) => {
    state.benchId = r.id;
    try {
      localStorage.setItem("benchId", r.id);
    } catch {}
    view.querySelectorAll(".ref").forEach((b) => b.classList.toggle("on", b.dataset.id === r.id));
    const name = esc(r.short);
    const diff = r.summary.difference;
    let verdict;
    if (r.kind === "inflation") {
      verdict = diff >= 0
        ? `Ton portefeuille <b class="up">bat l'inflation</b> : ton pouvoir d'achat a augmenté de <b class="up">${eur(diff)}</b>.`
        : `Ton portefeuille <b class="down">ne suit pas l'inflation</b> : tu as perdu <b class="down">${eur(-diff)}</b> de pouvoir d'achat.`;
    } else if (Math.abs(diff) < 0.5) verdict = `Tu fais <b>jeu égal</b> avec ${name}.`;
    else if (diff > 0) verdict = `Tu fais <b class="up">mieux</b> que ${name} : <b class="up">${eur(diff)}</b> de plus.`;
    else verdict = `${name} aurait rapporté <b class="down">${eur(-diff)} de plus</b> que tes choix d'actions.`;
    const note =
      r.kind === "inflation" && r.meta
        ? `<p class="muted small" style="margin:8px 0 0">Indice des prix Eurostat publié jusqu'à ${esc(r.meta.lastPublished)}, prolongé ensuite au rythme récent (${numFmt(1).format(r.meta.extrapolatedAnnualRate)} % par an).</p>`
        : "";
    $("#bench-detail").innerHTML = `
      <h2>${esc(r.name)}</h2>
      <p class="muted small" style="margin:-6px 0 10px">${esc(r.description)}</p>
      <p class="verdict">${verdict}</p>
      <div class="chart-box"><canvas id="bench-chart"></canvas></div>${note}`;
    if (benchChart) {
      benchChart.destroy();
      charts.delete(benchChart);
    }
    benchChart = lineChart(
      $("#bench-chart"),
      r.points.map((x) => x.t),
      [
        { label: "Mon portefeuille", data: r.points.map((x) => x.portfolio), borderColor: cssVar("--accent") },
        { label: r.short, data: r.points.map((x) => x.benchmark), borderColor: cssVar("--bench"), borderWidth: 1.8 },
      ],
    );
  };
  view.querySelectorAll(".ref").forEach((b) =>
    b.addEventListener("click", () => {
      showDetail(refs.find((r) => r.id === b.dataset.id));
      $("#bench-detail").scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
  showDetail(sel);
}

// ---------- Historique : frise des opérations du portefeuille ----------

// Événements (démarrage, achats, ventes) du plus récent au plus ancien.
function portfolioEvents(p) {
  const ev = [];
  for (const x of p.positions) {
    ev.push({ type: "buy", date: x.buyDate, x });
    if (x.status === "closed") ev.push({ type: "sell", date: x.sellDate, x });
  }
  if (p.portfolio?.startDate) ev.push({ type: "start", date: p.portfolio.startDate });
  const order = { sell: 0, buy: 1, start: 2 };
  return ev.sort((a, b) => (a.date === b.date ? order[a.type] - order[b.type] : a.date < b.date ? 1 : -1));
}

function eventHtml(e) {
  if (e.type === "start") {
    return `<li class="ev ev-start"><span class="ev-dot"></span>
      <div class="ev-body"><div class="ev-head"><b>Démarrage du portefeuille</b><span class="muted small">${date(e.date)}</span></div></div></li>`;
  }
  const x = e.x;
  const n = `${qty(x.quantity)} action${x.quantity >= 2 ? "s" : ""}`;
  if (e.type === "buy") {
    return `<li class="ev ev-buy"><span class="ev-dot"></span>
      <a class="ev-body" href="#/stock/${encodeURIComponent(x.symbol)}">
        <div class="ev-head"><span><span class="ev-tag">Achat</span> <b>${esc(x.name)}</b></span><span class="muted small">${date(e.date)}</span></div>
        <div class="small">${n} à ${native(x.buyPrice, x.currency)}</div>
        <div class="small muted">Investi ${eur(x.cost)}${x.buyFees ? ` · dont ${eur(x.buyFees)} de frais` : ""}</div>
      </a></li>`;
  }
  return `<li class="ev ev-sell ${tone(x.pnl)}"><span class="ev-dot"></span>
    <a class="ev-body" href="#/stock/${encodeURIComponent(x.symbol)}">
      <div class="ev-head"><span><span class="ev-tag">Vente</span> <b>${esc(x.name)}</b></span><span class="muted small">${date(e.date)}</span></div>
      <div class="small">${n} à ${native(x.sellPrice, x.currency)}</div>
      <div class="small muted">Récupéré ${eur(x.value)}${x.sellFees ? ` · frais ${eur(x.sellFees)}` : ""} ·
        <span class="${tone(x.pnl)}">${x.pnl >= 0 ? "plus" : "moins"}-value ${signedEur(x.pnl)} (${pct(x.pnlPct)})</span></div>
    </a></li>`;
}

// Frise groupée par mois.
function timelineHtml(events) {
  const fmtMonth = (d) => {
    const [y, m] = d.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };
  let html = "";
  let month = null;
  for (const e of events) {
    const m = e.date.slice(0, 7);
    if (m !== month) {
      if (month) html += "</ul>";
      html += `<h3 class="sub-h ev-month">${fmtMonth(e.date)}</h3><ul class="frise">`;
      month = m;
    }
    html += eventHtml(e);
  }
  return html + (month ? "</ul>" : "");
}

async function renderHistory(token) {
  setHeader("Historique", { back: true });
  setTab("");
  view.innerHTML = skeleton();
  const p = await loadPortfolio();
  if (stale(token)) return;
  const all = portfolioEvents(p);
  const buys = all.filter((e) => e.type === "buy");
  const sells = all.filter((e) => e.type === "sell");
  const filter = state.histFilter ?? "all";
  const draw = (f) => {
    const list = f === "all" ? all : all.filter((e) => e.type === f);
    $("#frise").innerHTML = list.length ? timelineHtml(list) : `<p class="muted small">Aucune opération.</p>`;
  };
  view.innerHTML = `
    <section class="card">
      <div class="muted small">Portefeuille « ${esc(p.portfolio?.name ?? "")} », depuis le ${date(p.portfolio?.startDate)}</div>
      <div class="bench-stats" style="margin-top:10px">
        <div class="stat"><div class="k">${buys.length} achat${buys.length > 1 ? "s" : ""}</div><div class="v">${eur(p.summary.totalInvested)}</div></div>
        <div class="stat"><div class="k">${sells.length} vente${sells.length > 1 ? "s" : ""}</div><div class="v">${eur(p.summary.proceeds)}</div></div>
      </div>
    </section>
    <section class="card">
      <div style="margin-bottom:6px">${seg("hist", [["all", "Tout"], ["buy", "Achats"], ["sell", "Ventes"]], filter)}</div>
      <div id="frise"></div>
    </section>`;
  draw(filter);
  view.querySelector('[data-seg="hist"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.histFilter = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    draw(state.histFilter);
  });
}

// ---------- Remonter le temps ----------

const WAYBACK_QUICK = [
  ["1 mois", 1],
  ["6 mois", 6],
  ["1 an", 12],
  ["3 ans", 36],
  ["5 ans", 60],
];
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return new Intl.DateTimeFormat("en-CA", TZ).format(d);
}

async function renderWayback(token) {
  setHeader("Remonter le temps", { back: true });
  setTab("");
  const pfInfo = (await loadPortfolio().catch(() => null))?.portfolio;
  if (stale(token)) return;
  const startDate = pfInfo?.startDate ?? "1990-01-01";
  state.wbDate ??= monthsAgo(12) < startDate ? startDate : monthsAgo(12);
  view.classList.add("has-action");
  view.innerHTML = `
    <section class="card">
      <p style="margin:0 0 12px">Choisis une date dans le passé, puis indique <b>combien tu aurais investi ce jour-là</b> dans chaque action.
        L'app calcule ce que ça vaudrait aujourd'hui.</p>
      <div class="chips quick" id="wb-quick">
        <button type="button" class="chip" data-start="1">Démarrage (${date(startDate)})</button>
        ${WAYBACK_QUICK.filter(([, n]) => monthsAgo(n) >= startDate).map(([l, n]) => `<button type="button" class="chip" data-n="${n}">Il y a ${l}</button>`).join("")}</div>
      <label class="field" style="margin:10px 0 0"><span>Date (portefeuille « ${esc(pfInfo?.name ?? "")} »)</span>
        <input class="input" type="date" id="wb-date" value="${state.wbDate}" min="${startDate}" max="${today()}"></label>
    </section>
    <section class="card" id="wb-lines"><div class="skeleton" style="height:140px"></div></section>
    <div class="action-bar"><button class="btn" id="wb-apply" disabled>Appliquer au portefeuille</button></div>`;

  let lines = [];
  const dirty = new Map(); // symbole -> montant saisi
  let seq = 0;
  let timer;

  const load = async () => {
    const my = ++seq;
    dirty.clear();
    $("#wb-apply").disabled = true;
    $("#wb-lines").innerHTML = `<div class="skeleton" style="height:140px"></div>`;
    try {
      const d = await api(`/api/wayback?date=${state.wbDate}`);
      if (my !== seq || stale(token)) return;
      lines = d.lines;
      draw();
    } catch (e) {
      if (my === seq) $("#wb-lines").innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  };

  const lineHtml = (l) => {
    if (l.error) {
      return `<div class="wb-line"><div class="title">${esc(l.name)}</div><div class="muted small">${esc(l.error)}</div></div>`;
    }
    const val = dirty.has(l.symbol) ? dirty.get(l.symbol) : l.amount || "";
    return `<div class="wb-line" data-symbol="${esc(l.symbol)}">
      <div class="wb-top">
        <div class="main"><div class="title">${esc(l.name)}</div>
          <div class="muted small">${native(l.priceThen, l.currency)} le ${date(l.execDate)} → ${native(l.priceNow, l.currency)} aujourd'hui
            <span class="${tone(l.changePct)}">(${pct(l.changePct)})</span></div></div>
        <label class="wb-amount"><input class="input" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="${val}" aria-label="Montant investi le ${date(l.execDate)}"><span>€</span></label>
      </div>
      <div class="wb-preview small muted" data-preview></div>
      ${l.soldCount ? `<div class="muted small">${l.soldCount} achat(s) de ce jour déjà vendu(s) : non modifiés ici.</div>` : ""}
    </div>`;
  };

  const draw = () => {
    const ok = lines.filter((l) => !l.error);
    $("#wb-lines").innerHTML = `
      <h2>Le ${date(state.wbDate)}, j'investis…</h2>
      ${lines.length ? "" : `<p class="muted small">Ton portefeuille est vide : ajoute une action.</p>`}
      ${lines.map(lineHtml).join("")}
      <button class="btn secondary" id="wb-add" type="button" style="margin-top:12px">+ Ajouter une action</button>
      <div class="estimate" id="wb-total" style="margin-top:14px" ${ok.length ? "" : "hidden"}></div>
      <p class="muted small" style="margin:8px 0 0">Le montant est le total débité ce jour-là, frais compris (${feeLabel() || "frais simulés"}). Mettre 0 retire l'achat de ce jour.
        Si la bourse était fermée, l'achat se fait au jour de bourse suivant.</p>`;
    $("#wb-lines").querySelectorAll(".wb-line input").forEach((inp) =>
      inp.addEventListener("input", () => {
        const sym = inp.closest(".wb-line").dataset.symbol;
        const v = parseFloat(String(inp.value).replace(",", ".")) || 0;
        const orig = lines.find((l) => l.symbol === sym).amount || 0;
        if (Math.abs(v - orig) < 0.005) dirty.delete(sym);
        else dirty.set(sym, v);
        $("#wb-apply").disabled = true;
        clearTimeout(timer);
        timer = setTimeout(preview, 350);
      }),
    );
    $("#wb-add").addEventListener("click", () => openAddSheet());
    preview();
  };

  const preview = async () => {
    const items = lines
      .filter((l) => !l.error)
      .map((l) => ({ symbol: l.symbol, amount: dirty.has(l.symbol) ? dirty.get(l.symbol) : l.amount || 0 }));
    if (!items.length) return;
    const my = ++seq;
    try {
      const d = await api("/api/wayback?dryRun=1", { method: "POST", body: { date: state.wbDate, items } });
      if (my !== seq || stale(token)) return;
      for (const p of d.lines) {
        const el = $(`.wb-line[data-symbol="${CSS.escape(p.symbol)}"] [data-preview]`);
        if (!el) continue;
        el.innerHTML = p.newAmount
          ? `→ vaudrait <b>${eur(p.valueNow)}</b> aujourd'hui · <span class="${tone(p.pnl)}">${signedEur(p.pnl)} (${pct(p.pnlPct)})</span>`
          : "";
      }
      const t = d.totals;
      const box = $("#wb-total");
      box.hidden = false;
      box.innerHTML = `
        <div class="line"><span class="muted">Investi le ${date(state.wbDate)}</span><span>${eur(t.invested)}</span></div>
        <div class="line"><span class="muted">Valeur aujourd'hui</span><span>${eur(t.valueNow)}</span></div>
        <div class="line total"><span>Gain</span><span class="${tone(t.pnl)}">${signedEur(t.pnl)} (${pct(t.pnlPct)})</span></div>`;
      $("#wb-apply").disabled = dirty.size === 0;
      $("#wb-apply").textContent = dirty.size ? `Appliquer ${dirty.size} modification${dirty.size > 1 ? "s" : ""}` : "Appliquer au portefeuille";
    } catch (e) {
      if (my === seq) toast(e.message);
    }
  };

  const openAddSheet = () => {
    $("#sheet-body").innerHTML = `
      <h3>Ajouter une action</h3>
      <input class="input search-input" id="wb-q" type="search" placeholder="Rechercher une action" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <ul class="list" id="wb-results" style="margin-top:8px"></ul>
      <button class="btn secondary" type="button" id="wb-cancel" style="margin-top:12px">Fermer</button>`;
    openSheet();
    $("#wb-cancel").onclick = closeSheet;
    let t2;
    let s2 = 0;
    $("#wb-q").addEventListener("input", (e) => {
      clearTimeout(t2);
      t2 = setTimeout(async () => {
        const q = e.target.value.trim();
        const my = ++s2;
        if (q.length < 2) return ($("#wb-results").innerHTML = "");
        try {
          const { results } = await api(`/api/search?q=${encodeURIComponent(q)}`);
          if (my !== s2) return;
          $("#wb-results").innerHTML = results.length
            ? results.map((r) => `<li><button class="row" data-symbol="${esc(r.symbol)}"><div class="avatar">${initials(r.name)}</div>
                <div class="main"><div class="title">${esc(r.name)}</div><div class="sub">${esc(r.symbol)} · ${esc(r.exchange)}</div></div></button></li>`).join("")
            : `<li class="muted small" style="padding:10px 0">Aucune action trouvée.</li>`;
        } catch (err) {
          $("#wb-results").innerHTML = `<li class="error">${esc(err.message)}</li>`;
        }
      }, 300);
    });
    $("#wb-results").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-symbol]");
      if (!b) return;
      const symbol = b.dataset.symbol;
      closeSheet();
      if (lines.some((l) => l.symbol === symbol)) return toast("Cette action est déjà dans la liste");
      try {
        const d = await api("/api/wayback?dryRun=1", { method: "POST", body: { date: state.wbDate, items: [{ symbol, amount: 0 }] } });
        lines.push(d.lines[0]);
        draw();
        $(`.wb-line[data-symbol="${CSS.escape(symbol)}"] input`)?.focus();
      } catch (err) {
        toast(err.message);
      }
    });
    setTimeout(() => $("#wb-q").focus(), 50);
  };

  $("#wb-quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-n],[data-start]");
    if (!b) return;
    state.wbDate = b.dataset.start ? startDate : monthsAgo(Number(b.dataset.n));
    $("#wb-date").value = state.wbDate;
    load();
  });
  $("#wb-date").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.wbDate = e.target.value;
    load();
  });
  $("#wb-apply").addEventListener("click", async () => {
    if (!dirty.size) return;
    const items = [...dirty].map(([symbol, amount]) => ({ symbol, amount }));
    $("#wb-apply").disabled = true;
    try {
      await api("/api/wayback", { method: "POST", body: { date: state.wbDate, items } });
      toast(`Portefeuille modifié au ${date(state.wbDate)}`);
      state.compare = null;
      await loadPortfolio(true);
      location.hash = "#/";
    } catch (e) {
      toast(e.message);
      $("#wb-apply").disabled = false;
    }
  });
  load();
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
  setHeader("Découvrir", { switcher: true });
  setTab("search");
  if (!state.portfolio) loadPortfolio().then(() => !stale(token) && setHeader("Découvrir", { switcher: true })).catch(() => {});
  view.innerHTML = `
    <div class="card">
      <input class="input search-input" id="q" type="search" placeholder="Rechercher une action"
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(lastQuery)}">
      <p class="muted small" style="margin:10px 2px 0">Actions des bourses européennes (Euronext, XETRA, Madrid, Milan, Londres, Suisse, nordiques…).
      Si une action n'apparaît pas, tape directement son ticker Yahoo, par ex. <b>ITX.MC</b>.</p>
    </div>
    <div class="card" id="results" hidden><ul class="list"></ul></div>
    <div id="discover"></div>`;
  const input = $("#q");
  const box = $("#results");
  const disc = $("#discover");
  let timer;
  let seq = 0;
  const run = async () => {
    const q = input.value.trim();
    lastQuery = q;
    if (q.length < 2) {
      box.hidden = true;
      disc.hidden = false;
      return;
    }
    const my = ++seq;
    box.hidden = false;
    disc.hidden = true;
    box.querySelector("ul").innerHTML = `<li class="muted small" style="padding:12px 0">Recherche…</li>`;
    try {
      const { results } = await api(`/api/search?q=${encodeURIComponent(q)}`);
      if (my !== seq || stale(token)) return;
      box.querySelector("ul").innerHTML = results.length
        ? results
            .map(
              (r, i) => `${groupNote(r, results[i - 1])}<li><a class="row ${r.listing ? "listing-" + r.listing.role : ""}" href="#/stock/${encodeURIComponent(r.symbol)}">
              <div class="avatar">${initials(r.name)}</div>
              <div class="main"><div class="title">${esc(r.name)}</div><div class="sub">${esc(r.symbol)} · ${esc(r.exchange)}</div>
                ${listingLine(r)}</div>
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
  renderDiscover(disc, token);
}

// Doublons (même société sur plusieurs bourses) : note avant le groupe + sous-titre par cotation.
const currencyName = (c) =>
  ({ EUR: "en euros", GBp: "en pence (livre sterling)", GBP: "en livres sterling", CHF: "en francs suisses", DKK: "en couronnes danoises", SEK: "en couronnes suédoises", NOK: "en couronnes norvégiennes", PLN: "en zlotys", CZK: "en couronnes tchèques" })[c] ??
  (c ? `en ${c}` : "");

function groupNote(r, prev) {
  if (!r.listing || prev?.listing?.group === r.listing.group) return "";
  return `<li class="group-note">${esc(shortNameJs(r.name))} est cotée sur ${r.listing.count} bourses : c'est la même entreprise.
    Préfère la <b>cotation principale</b>, la plus échangée ; en euros, le résultat est quasiment le même.</li>`;
}
function listingLine(r) {
  if (!r.listing) return "";
  const cur = currencyName(r.listing.currency);
  return r.listing.role === "primary"
    ? `<div class="listing-line"><span class="tag-primary">Cotation principale</span> la plus échangée${cur ? " · " + cur : ""}</div>`
    : `<div class="listing-line muted">Cotation secondaire${cur ? " · " + cur : ""} · moins d'échanges, cours parfois légèrement décalé</div>`;
}
const shortNameJs = (n) => String(n).replace(/\s+-\s+.*$/, "").replace(/,?\s+(S\.?A\.?|SE|AG|plc|N\.?V\.?|A\/S|S\.p\.A\.?)\.?$/i, "");

// ---------- Découvrir : tendances et actions à connaître ----------

// Mini-graphique de la dernière séance (SVG), avec la clôture de la veille en pointillés.
function sparkline(closes, prev) {
  if (!closes || closes.length < 2) return "";
  const w = 44;
  const h = 24;
  const vals = [...closes, prev];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const y = (v) => (max === min ? h / 2 : h - 2 - ((v - min) / (max - min)) * (h - 4));
  const pts = closes.map((c, i) => `${((i / (closes.length - 1)) * w).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const col = closes[closes.length - 1] >= prev ? "var(--up)" : "var(--down)";
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <line x1="0" x2="${w}" y1="${y(prev).toFixed(1)}" y2="${y(prev).toFixed(1)}" stroke="var(--border)" stroke-dasharray="2 2"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function quoteRight(q) {
  if (!q) return `<div class="right muted small">—</div>`;
  return `<div class="right"><div class="title">${native(q.price, q.currency)}</div>
    <div class="small ${tone(q.changePct)}">${pct(q.changePct)}</div></div>`;
}

function trendRow(q) {
  return `<li><a class="row" href="#/stock/${encodeURIComponent(q.symbol)}">
    <div class="avatar">${initials(q.name)}</div>
    <div class="main"><div class="title">${esc(q.name)}</div><div class="sub">${esc(q.symbol)} · ${esc(q.exchange)}</div></div>
    ${sparkline(q.closes, q.prevClose)}
    ${quoteRight(q)}
  </a></li>`;
}

function featuredRow(f) {
  return `<li><a class="row top" href="#/stock/${encodeURIComponent(f.symbol)}">
    <div class="avatar">${initials(f.name)}</div>
    <div class="main"><div class="title">${esc(f.name)}</div>
      <div class="sub">${esc(f.sector)} · ${esc(f.country)}</div>
      <div class="why">${esc(f.why)}</div></div>
    <div class="right">${f.quote ? sparkline(f.quote.closes, f.quote.prevClose) : ""}${quoteRight(f.quote)}</div>
  </a></li>`;
}

async function renderDiscover(el, token) {
  if (!state.discover || Date.now() - state.discover.at > 120_000) {
    el.innerHTML = skeleton();
    try {
      state.discover = { at: Date.now(), data: await api("/api/discover") };
    } catch (e) {
      if (!stale(token)) el.innerHTML = `<div class="card"><div class="error">${esc(e.message)}</div></div>`;
      return;
    }
  }
  if (stale(token)) return;
  const d = state.discover.data;
  const session = d.asOf
    ? new Date(d.asOf * 1000).toLocaleDateString("fr-FR", { ...TZ, weekday: "long", day: "numeric", month: "long" })
    : "";
  const list = (key) => {
    const items = d[key];
    return items.length
      ? items.map(trendRow).join("")
      : `<li class="muted small" style="padding:12px 0">Aucune action en ${key === "gainers" ? "hausse" : "baisse"} sur cette séance.</li>`;
  };
  el.innerHTML = `
    <section class="card">
      <div class="card-head">
        <h2>Tendances du jour</h2>
        ${seg("trend", [["gainers", "Hausses"], ["losers", "Baisses"]], state.trendTab || "gainers")}
      </div>
      <p class="muted small" style="margin:-4px 0 4px">Plus fortes variations parmi ${d.universeSize} grandes actions européennes${session ? `, séance du ${session}` : ""}.
        <a href="#/methode/decouvrir">Comment c'est choisi ?</a></p>
      <ul class="list" id="trend-list">${list(state.trendTab || "gainers")}</ul>
    </section>
    <section class="card">
      <h2>${d.featured.length} actions à connaître</h2>
      <p class="muted small" style="margin:-4px 0 4px">Des leaders européens de secteurs variés, très suivis par les investisseurs. Ce ne sont pas des recommandations.</p>
      <ul class="list">${d.featured.map(featuredRow).join("")}</ul>
    </section>`;
  el.querySelector('[data-seg="trend"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.trendTab = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("#trend-list").innerHTML = list(state.trendTab);
  });
}

// ---------- Méthode ----------

async function renderMethod(section, token) {
  setTab("methode");
  const cfg = state.config ?? (state.config = await getConfig());
  if (stale(token)) return;
  const art = section ? articleHtml(section, cfg) : null;
  if (art) {
    // Une fiche ouverte depuis la bibliothèque.
    setHeader(art.title, { back: true });
    view.innerHTML = art.html + `<a class="btn secondary" href="#/methode">Toutes les fiches</a>`;
  } else {
    setHeader("Méthode", { switcher: true });
    view.innerHTML = `<p class="muted small" style="margin:0 2px 4px">Comment l'app calcule tout, en fiches courtes.</p>${libraryHtml(cfg)}`;
  }
  window.scrollTo(0, 0);
}

// ---------- Fiche action ----------

const RANGE_LABELS = {
  "1d": ["1 jour", "aujourd'hui"],
  "1w": ["1 sem.", "sur 1 semaine"],
  "1mo": ["1 mois", "sur 1 mois"],
  "1y": ["1 an", "sur 1 an"],
  "5y": ["5 ans", "sur 5 ans"],
  max: ["Max", "depuis l'introduction en bourse"],
};

function currencyNote(q) {
  if (q.currency === "EUR") return "cotée en euros";
  const unit = q.currency === "GBp" ? "pence (1/100 de livre)" : q.currency;
  return `cotée en ${esc(unit)} · ≈ ${eur(q.price * q.fx)}`;
}

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
  const last = q.marketTime
    ? new Date(q.marketTime * 1000).toLocaleString("fr-FR", { ...TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  view.classList.add("has-action");
  view.innerHTML = `
    <section class="card stock-head">
      <div class="stock-id">
        <div class="avatar lg">${initials(q.name)}</div>
        <div class="main"><h2>${esc(q.name)}</h2>
          <div class="muted small">${esc(q.symbol)} · ${esc(q.exchange)}</div></div>
      </div>
      <div class="big">${native(q.price, q.currency)}</div>
      <div class="change-line">
        <span class="pill ${tone(q.change)}">${q.change >= 0 ? "+" : "−"}${native(Math.abs(q.change), q.currency)} (${pct(q.changePct)})</span>
        <span class="muted small">aujourd'hui</span>
      </div>
      <div class="muted small" style="margin-top:8px">Dernier cours${last ? ` : ${last}` : ""} · ${currencyNote(q)}</div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Évolution du cours</h2><span id="range-perf"></span></div>
      <div class="chart-box small"><canvas id="pc"></canvas></div>
      <div style="margin-top:10px" class="seg-full">${seg("srange", Object.entries(RANGE_LABELS).map(([v, [l]]) => [v, l]), state.stockRange)}</div>
      <div class="minmax muted small" id="minmax"></div>
    </section>

    ${holdingCard(lots, q)}

    ${featuredCard(q.symbol)}

    <div class="action-bar"><button class="btn" id="open-buy">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Simuler un achat</button></div>`;

  drawPrice(q);
  view.querySelector('[data-seg="srange"]').addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.stockRange = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    try {
      const q2 = await api(`/api/quote/${encodeURIComponent(symbol)}?range=${state.stockRange}`);
      if (!stale(token)) drawPrice(q2);
    } catch (err) {
      toast(err.message);
    }
  });
  $("#open-buy").addEventListener("click", () => openBuySheet(q));
  bindLots(view, lots);
}

let priceChart = null;
function drawPrice(q) {
  if (priceChart) {
    priceChart.destroy();
    charts.delete(priceChart);
  }
  const pts = q.points;
  const closes = pts.map((x) => x.close);
  const perf = q.range === "1d" ? q.changePct : pts.length > 1 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : 0;
  const col = cssVar(perf >= 0 ? "--up" : "--down");
  const label = RANGE_LABELS[q.range]?.[1] ?? "";
  $("#range-perf").innerHTML = `<span class="pill ${tone(perf)}">${pct(perf)}</span> <span class="muted small">${label}</span>`;
  $("#minmax").innerHTML = closes.length
    ? `Plus bas : <b>${native(Math.min(...closes), q.currency)}</b> · Plus haut : <b>${native(Math.max(...closes), q.currency)}</b>`
    : "";
  priceChart = lineChart(
    $("#pc"),
    pts.map((x) => x.t),
    [{ label: "Cours", data: closes, borderColor: col, backgroundColor: col + "1f", fill: true }],
    { formatY: (v) => native(v, q.currency), intraday: q.intraday },
  );
}

function featuredCard(symbol) {
  const f = state.config?.featured?.find((x) => x.symbol === symbol);
  if (!f) return "";
  return `<section class="card"><h2>Pourquoi la connaître</h2>
    <div class="muted small">${esc(f.sector)} · ${esc(f.country)}</div>
    <p style="margin:6px 0 0">${esc(f.why)}</p></section>`;
}

// Synthèse de ce que je détiens sur cette action + détail de chaque achat.
function holdingCard(lots, q) {
  if (!lots.length) {
    return `<section class="card"><h2>Ma position</h2>
      <p class="muted small" style="margin:0">Tu ne détiens pas encore cette action. Utilise le bouton <b>Simuler un achat</b> pour voir ce que tu aurais gagné.</p></section>`;
  }
  const open = lots.filter((l) => l.status === "open");
  const closed = lots.filter((l) => l.status === "closed");
  const sum = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
  const value = sum(open, "value");
  const cost = sum(open, "cost");
  const gain = value - cost;
  const summary = open.length
    ? `<div class="bench-stats">
        <div class="stat"><div class="k">Je détiens</div><div class="v">${qty(sum(open, "quantity"))} action${sum(open, "quantity") >= 2 ? "s" : ""}</div></div>
        <div class="stat"><div class="k">Valeur actuelle</div><div class="v">${eur(value)}</div></div>
        <div class="stat"><div class="k">Investi</div><div class="v">${eur(cost)}</div></div>
        <div class="stat"><div class="k">Gain / perte</div><div class="v ${tone(gain)}">${signedEur(gain)}</div>
          <div class="small ${tone(gain)}">${pct(cost ? (gain / cost) * 100 : 0)}</div></div>
      </div>`
    : "";
  return `<section class="card">
    <h2>Ma position</h2>
    ${summary}
    ${open.length ? `<h3 class="sub-h">Mes achats</h3>${open.map(lotBlock).join("")}` : ""}
    ${closed.length ? `<h3 class="sub-h">Mes ventes</h3>${closed.map(lotBlock).join("")}` : ""}
  </section>`;
}

function lotBlock(x) {
  const closed = x.status === "closed";
  const line = closed
    ? `Acheté le ${date(x.buyDate)} à ${native(x.buyPrice, x.currency)}, vendu le ${date(x.sellDate)} à ${native(x.sellPrice, x.currency)}`
    : `Acheté le ${date(x.buyDate)} à ${native(x.buyPrice, x.currency)}`;
  return `<div class="lot" data-id="${x.id}">
    <div class="top">
      <div>
        <div><b>${qty(x.quantity)} action${x.quantity >= 2 ? "s" : ""}</b> · ${eur(x.cost)} investis</div>
        <div class="muted small">${line}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="${tone(x.pnl)}"><b>${signedEur(x.pnl)}</b></div>
        <div class="small ${tone(x.pnl)}">${pct(x.pnlPct)}</div>
      </div>
    </div>
    <div class="actions">
      ${closed ? `<button class="btn sm secondary" data-act="reopen">Annuler la vente</button>` : `<button class="btn sm secondary" data-act="sell">Vendre</button>`}
      <button class="btn sm ghost" data-act="delete">Supprimer</button>
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
          if (!confirm("Supprimer définitivement cet achat simulé ? (Pour garder une trace du gain, utilise plutôt « Vendre ».)")) return;
          await api(`/api/positions/${lot.id}`, { method: "DELETE" });
          toast("Achat supprimé");
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

// ---------- Achat (feuille modale guidée) ----------

function openBuySheet(q) {
  const quick = [15, 50, 100, 500, 1000];
  $("#sheet-body").innerHTML = `
    <h3>Simuler un achat</h3>
    <div class="muted small" style="margin:-8px 0 14px">${esc(q.name)} · cours actuel ${native(q.price, q.currency)}<br>
      Dans le portefeuille <b>${esc(state.portfolio?.portfolio?.name ?? "")}</b></div>
    <form id="buy" autocomplete="off">
      <div class="step"><div class="step-title"><span class="step-n">1</span> Combien ?</div>
        ${seg("mode", [["amount", "En euros"], ["quantity", "En nombre d'actions"]], "amount")}
        <input class="input big-input" type="number" name="val" inputmode="decimal" min="0" step="any" placeholder="Montant en €" required>
        <div class="chips quick" id="quick">${quick.map((v) => `<button type="button" class="chip" data-v="${v}">${eur(v).replace(",00", "")}</button>`).join("")}</div>
      </div>
      <div class="step"><div class="step-title"><span class="step-n">2</span> Quand ?</div>
        ${seg("when", [["today", "Aujourd'hui"], ["past", "À une date passée"]], "today")}
        <input class="input" type="date" name="date" value="${today()}" min="${state.portfolio?.portfolio?.startDate ?? ""}" max="${today()}" hidden>
        <div class="muted small" id="when-help" style="margin-top:6px">Au dernier cours connu.</div>
      </div>
      <div class="estimate" id="est" hidden></div>
      <div class="error" id="buy-err" hidden></div>
      <div class="grid2">
        <button class="btn secondary" type="button" id="buy-cancel">Annuler</button>
        <button class="btn" type="submit" id="buy-btn" disabled>Confirmer</button>
      </div>
      <p class="muted small" style="margin:10px 2px 0">Fractions d'actions autorisées. Frais de courtage (${feeLabel() || "simulés"}) inclus dans le montant.
        <a href="#/methode/prix">Comment c'est calculé ?</a></p>
    </form>`;
  openSheet();
  const form = $("#buy");
  const est = $("#est");
  const err = $("#buy-err");
  const btn = $("#buy-btn");
  $("#buy-cancel").onclick = closeSheet;
  let mode = "amount";
  let when = "today";
  let timer;
  let seq = 0;

  const payload = () => {
    const v = parseFloat(String(form.val.value).replace(",", "."));
    return {
      symbol: q.symbol,
      date: when === "past" && form.date.value ? form.date.value : today(),
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
        <div class="line"><span class="muted">${when === "past" ? `Clôture du ${date(e.date)}` : "Dernier cours"}</span><span>${native(e.price, e.currency)}</span></div>
        ${e.currency !== "EUR" ? `<div class="line"><span class="muted">Taux de change</span><span>1 ${esc(e.currency)} = ${numFmt(4).format(e.fx)} €</span></div>` : ""}
        <div class="line"><span class="muted">Tu obtiens</span><span><b>${qty(e.quantity)} action${e.quantity >= 2 ? "s" : ""}</b></span></div>
        <div class="line"><span class="muted">Montant en actions</span><span>${eur(e.invested)}</span></div>
        <div class="line"><span>${feeLink()}</span><span>${eur(e.fees)}</span></div>
        <div class="line total"><span>Total débité</span><span>${eur(e.total)}</span></div>`;
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
    timer = setTimeout(preview, 300);
  };

  form.addEventListener("input", schedule);
  form.querySelector('[data-seg="mode"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    form.val.placeholder = mode === "amount" ? "Montant en €" : "Nombre d'actions (ex : 0,5)";
    $("#quick").hidden = mode !== "amount";
    schedule();
  });
  form.querySelector('[data-seg="when"]').addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    when = b.dataset.v;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    form.date.hidden = when !== "past";
    $("#when-help").textContent =
      when === "past"
        ? "Au cours de clôture de ce jour (ou du jour de bourse suivant si la bourse était fermée)."
        : "Au dernier cours connu.";
    schedule();
  });
  $("#quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    form.val.value = b.dataset.v;
    schedule();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const { estimate: r } = await api("/api/positions", { method: "POST", body: payload() });
      closeSheet();
      toast(`Achat simulé : ${qty(r.quantity)} action${r.quantity >= 2 ? "s" : ""} ${q.name}`);
      await loadPortfolio(true);
      route();
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
      <label class="field"><span>Date de vente</span>
        <input class="input" type="date" name="date" value="${today()}" min="${lot.buyDate}" max="${today()}" required></label>
      <div class="estimate" id="sell-est"><span class="muted">Calcul…</span></div>
      <div class="error" id="sell-err" hidden></div>
      <div class="grid2">
        <button class="btn secondary" type="button" id="sell-cancel">Annuler</button>
        <button class="btn" type="submit" id="sell-btn" disabled>Vendre</button>
      </div>
    </form>`;
  openSheet();
  const form = $("#sell");
  const est = $("#sell-est");
  const err = $("#sell-err");
  const btn = $("#sell-btn");
  $("#sell-cancel").onclick = closeSheet;
  let seq = 0;
  let timer;
  const body = () => ({ action: "sell", date: form.date.value });
  const preview = async () => {
    const my = ++seq;
    err.hidden = true;
    try {
      const { estimate: e } = await api(`/api/positions/${lot.id}?dryRun=1`, { method: "PATCH", body: body() });
      if (my !== seq) return;
      est.innerHTML = `
        <div class="line"><span class="muted">Cours retenu (${date(e.date)})</span><span>${native(e.price, lot.currency)}</span></div>
        <div class="line"><span class="muted">Montant de la vente</span><span>${eur(e.gross)}</span></div>
        <div class="line"><span>${feeLink()}</span><span>−${eur(e.fees)}</span></div>
        <div class="line"><span class="muted">Tu récupères</span><span>${eur(e.proceeds)}</span></div>
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

getConfig()
  .then((c) => (state.config = c))
  .catch(() => {});

// Accès non protégé : avertissement et bouton de déconnexion masqué.
api("/api/session")
  .then((s) => {
    state.protected = s.protected;
    $("#logout").hidden = !s.protected;
    if (!s.protected) route();
  })
  .catch(() => {});

route();
