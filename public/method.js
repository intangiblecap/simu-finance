// Onglet « Méthode » : une bibliothèque de fiches courtes, une par sujet.
// Les paramètres (taux de frais, minimum…) viennent de /api/config, donc des mêmes
// constantes que les calculs côté serveur.

const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const num = (n, d = 2) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
export const ratePct = (r) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(r * 100) + " %";
const round2 = (n) => Math.round(n * 100) / 100;
const split = (budget, rate) => {
  const fees = round2(budget - budget / (1 + rate));
  return { invested: round2(budget - fees), fees };
};

const params = (rows) => `<dl class="params">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
const formula = (...lines) => `<div class="formula">${lines.join("<br>")}</div>`;
const why = (...items) => `<h3>Pourquoi ?</h3><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

// Fiches : id (utilisé dans les liens #/methode/<id>), rubrique, icône, titre, résumé, contenu.
export const ARTICLES = [
  {
    id: "bref", group: "Les bases", icon: "💡", title: "Le principe",
    summary: "Ce que fait l'app.",
    body: () => `
      <p>Tu simules des achats d'actions, l'app calcule <b>ce que tu aurais gagné ou perdu</b> avec les vrais cours. Aucun argent réel n'est engagé.</p>
      <p>Chaque portefeuille a une <b>date de démarrage</b> : aucun achat n'est possible avant.</p>`,
  },
  {
    id: "donnees", group: "Les bases", icon: "📡", title: "Données de marché",
    summary: "D'où viennent les cours.",
    body: (c) => `
      ${params([
        ["Source", "Yahoo Finance"],
        ["Actions", "Bourses européennes"],
        ["Mise à jour", "À l'ouverture de l'app et avec ↻"],
        ["Délai possible", `jusqu'à ${c.cacheSeconds.quotes / 60} min`],
      ])}
      ${why("Gratuit, avec des décennies d'historique pour toutes les places européennes.", "Ce n'est pas une source officielle : elle peut parfois être indisponible.")}`,
  },
  {
    id: "limites", group: "Les bases", icon: "🚧", title: "Ce qui n'est pas simulé",
    summary: "Dividendes, impôts, taxes…",
    body: () => `
      <ul>
        <li><b>Dividendes</b> : non versés.</li>
        <li><b>Impôts</b> sur les plus-values : non déduits.</li>
        <li><b>Taxe sur les transactions</b> (0,4 % sur les grandes sociétés françaises) : non appliquée.</li>
        <li><b>Frais de change et droits de garde</b> : non appliqués.</li>
        <li><b>Divisions d'actions</b> : non ajustées.</li>
      </ul>`,
  },
  {
    id: "prix", group: "Calculs", icon: "🏷️", title: "Prix d'exécution",
    summary: "Le cours retenu pour un ordre.",
    body: () => `
      <table class="tbl">
        <tr><td>Aujourd'hui</td><td>Dernier cours connu</td></tr>
        <tr><td>Date passée</td><td>Clôture de ce jour</td></tr>
        <tr><td>Bourse fermée</td><td>Jour de bourse suivant</td></tr>
      </table>
      ${why("La clôture est le prix de référence d'une journée, disponible pour n'importe quelle date.", "Un ordre passé un samedi est exécuté le lundi chez un vrai courtier.")}`,
  },
  {
    id: "frais", group: "Calculs", icon: "💸", title: "Frais de courtage",
    summary: (c) => `${ratePct(c.feeRate)} par ordre.`,
    body: (c) => {
      const T = ratePct(c.feeRate);
      return `
      ${params([["Taux", `<b>${T}</b> du montant`], ["Quand", "À l'achat et à la vente"], ["Minimum", "Aucun"]])}
      ${formula(`frais = montant de l'ordre × ${T}`)}
      <p>En achat par montant, la somme saisie est le <b>total débité, frais compris</b>.</p>
      <table class="tbl num">
        <tr><th>Saisi</th><th>En actions</th><th>Frais</th></tr>
        ${[15, 100, 1000].map((b) => ({ b, ...split(b, c.feeRate) })).map((e) => `<tr><td>${eur(e.b)}</td><td>${eur(e.invested)}</td><td>${eur(e.fees)}</td></tr>`).join("")}
      </table>
      ${why(`Un pourcentage reste juste pour les petits montants (un forfait de 1 € coûterait ${num(100 / 15, 1)}&nbsp;% d'un achat de 15 €).`, `${T} est l'ordre de grandeur des courtiers en ligne des banques.`, `Un aller-retour coûte environ ${num(((1 + c.feeRate) / (1 - c.feeRate) - 1) * 100)}&nbsp;% : c'est pourquoi un achat récent affiche une petite perte.`)}`;
    },
  },
  {
    id: "fractions", group: "Calculs", icon: "🍰", title: "Fractions d'actions",
    summary: "Investir même 15 €.",
    body: (c) => `
      ${params([["Précision", `${c.qtyDecimals} décimales`], ["Arrondi", "À l'inférieur"], ["Minimum", eur(c.minOrderEur)]])}
      <p>L'arrondi à l'inférieur garantit de ne jamais dépenser plus que le montant saisi.</p>`,
  },
  {
    id: "devises", group: "Calculs", icon: "💱", title: "Devises",
    summary: "Tout est converti en euros.",
    body: () => `
      ${formula("valeur en € = quantité × cours × taux de change")}
      ${params([["À l'achat", "Taux du jour d'achat"], ["Aujourd'hui", "Taux actuel"], ["À la vente", "Taux du jour de vente"]])}
      <p>Ton gain inclut donc l'effet de change, comme dans la réalité. Londres cote en pence (1/100 de livre).</p>`,
  },
  {
    id: "gains", group: "Calculs", icon: "📈", title: "Calcul des gains",
    summary: "Le gain total, du début à aujourd'hui.",
    body: () => `
      ${formula("gain total = valeur actuelle + récupéré par les ventes − total investi")}
      ${formula("performance = gain total ÷ total investi")}
      ${params([["Total investi", "Tous les achats, frais compris"], ["Latent", "Sur ce que tu détiens encore"], ["Réalisé", "Sur ce que tu as vendu"]])}`,
  },
  {
    id: "graphique", group: "Fonctionnalités", icon: "📊", title: "Graphique d'évolution",
    summary: "Lire les courbes.",
    body: () => `
      <table class="tbl">
        <tr><td>1 jour</td><td>un point toutes les 5 min</td></tr>
        <tr><td>1 semaine</td><td>toutes les 30 min</td></tr>
        <tr><td>1 mois</td><td>un point par jour</td></tr>
      </table>
      <p><b>Valeur</b> : ce que valent tes positions. <b>Investi</b> (pointillés) : ce qu'elles t'ont coûté. L'écart est ton gain latent.</p>`,
  },
  {
    id: "indices", group: "Fonctionnalités", icon: "⚖️", title: "Comparer",
    summary: "Indices, sans risque, inflation.",
    body: (c) => `
      <p>On rejoue tes achats dans chaque référence : <b>mêmes montants, mêmes dates</b>, revente le jour où tu vends. L'<b>écart</b> est positif quand tu fais mieux.</p>
      <table class="tbl">${c.benchmarks.map((b) => `<tr><td><b>${b.short}</b></td><td>${b.description}</td></tr>`).join("")}</table>
      ${why("Si tu fais moins bien qu'un indice, un ETF (fonds qui achète tout l'indice) aurait été plus rentable.", "L'inflation est le minimum à battre pour ne pas perdre de pouvoir d'achat.", "Le PIB n'est pas utilisé : on ne peut pas l'acheter et il n'est publié que tous les trimestres.")}`,
  },
  {
    id: "wayback", group: "Fonctionnalités", icon: "⏪", title: "Remonter le temps",
    summary: "Réécrire ses achats passés.",
    body: () => `
      <ul>
        <li>Choisis une date, puis le montant investi ce jour-là dans chaque action. <b>+</b> ajoute une action.</li>
        <li>Les achats de ce jour sont remplacés ; <b>0</b> les supprime.</li>
        <li>Rien n'est enregistré avant <b>Appliquer</b>.</li>
      </ul>`,
  },
  {
    id: "decouvrir", group: "Fonctionnalités", icon: "🧭", title: "Découvrir",
    summary: "Tendances et actions à connaître.",
    body: (c) => `
      ${params([["Tendances", `${c.trendTopN} plus fortes hausses et baisses`], ["Parmi", `${c.trendUniverseSize} grandes actions européennes`], ["Sur", "La dernière séance"]])}
      <p>Les <b>${c.featured.length} actions à connaître</b> sont des leaders de secteurs et de pays variés. <b>Ce ne sont pas des recommandations.</b></p>`,
  },
];

const GROUPS = ["Les bases", "Calculs", "Fonctionnalités"];

export function libraryHtml(cfg) {
  return GROUPS.map(
    (g) => `<h3 class="sub-h lib-h">${g}</h3>
    <div class="lib">${ARTICLES.filter((a) => a.group === g)
      .map(
        (a) => `<a class="lib-card" href="#/methode/${a.id}">
          <span class="lib-ico">${a.icon}</span>
          <b>${a.title}</b>
          <span class="muted small">${typeof a.summary === "function" ? a.summary(cfg) : a.summary}</span>
        </a>`,
      )
      .join("")}</div>`,
  ).join("");
}

export function articleHtml(id, cfg) {
  const a = ARTICLES.find((x) => x.id === id);
  if (!a) return null;
  return { title: a.title, html: `<article class="card doc"><div class="art-ico">${a.icon}</div>${a.body(cfg)}</article>` };
}
