// Onglet « Méthode » : explique chaque choix de la simulation.
// Les paramètres (taux de frais, minimum, précision…) viennent de /api/config,
// c'est-à-dire des mêmes constantes que celles utilisées par les calculs côté serveur.

const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const num = (n, d = 2) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
export const ratePct = (r) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(r * 100) + "\u00a0%";
const round2 = (n) => Math.round(n * 100) / 100;

// Mêmes formules que lib/fees.ts.
function splitBudget(budget, rate) {
  const fees = round2(budget - budget / (1 + rate));
  return { invested: round2(budget - fees), fees };
}

export const SECTIONS = [
  ["bref", "En bref"],
  ["donnees", "Données de marché"],
  ["prix", "Prix d'exécution"],
  ["frais", "Frais de courtage"],
  ["fractions", "Fractions d'actions"],
  ["devises", "Devises"],
  ["gains", "Calcul des gains"],
  ["graphique", "Graphique d'évolution"],
  ["limites", "Ce qui n'est pas simulé"],
];

export function methodHtml(cfg) {
  const t = cfg.feeRate;
  const T = ratePct(t);
  const ex = [15, 100, 1000, 10000].map((b) => ({ b, ...splitBudget(b, t) }));
  const roundTrip = (1 + t) / (1 - t) - 1;
  const min = (s) => (s >= 3600 ? `${s / 3600} h` : s >= 60 ? `${s / 60} min` : `${s} s`);
  const fx = 0.0118; // exemple de taux GBP pence → EUR pour l'illustration

  return `
  <nav class="card toc">${SECTIONS.map(([id, label]) => `<a href="#/methode/${id}">${label}</a>`).join("")}</nav>

  <section class="card doc" id="bref">
    <h2>En bref</h2>
    <p>Simu Finance répond à une question : <b>« combien aurais-je gagné ou perdu si j'avais vraiment acheté cette action ? »</b>
    Aucun argent réel n'est engagé. Chaque achat simulé est enregistré avec son prix, sa date et ses frais, puis revalorisé avec les cours du marché à chaque ouverture de l'app.</p>
    <p>L'objectif est d'être <b>simple et proche de la réalité</b> : on applique les mêmes règles qu'un courtier en ligne (prix de marché, frais, conversion de devises), sans entrer dans tous les détails fiscaux ou techniques (voir <a href="#/methode/limites">ce qui n'est pas simulé</a>).</p>
  </section>

  <section class="card doc" id="donnees">
    <h2>Données de marché</h2>
    <dl class="params">
      <dt>Source</dt><dd>Yahoo Finance (gratuit, sans clé d'API)</dd>
      <dt>Instruments</dt><dd>Actions cotées sur les bourses européennes</dd>
      <dt>Mise à jour</dt><dd>À l'ouverture de l'app, au retour dans l'app après plus d'1 min, et avec le bouton ↻</dd>
      <dt>Mise en cache</dt><dd>Cours : ${min(cfg.cacheSeconds.quotes)} · intrajournalier : ${min(cfg.cacheSeconds.intraday)} · recherche : ${min(cfg.cacheSeconds.search)}</dd>
    </dl>
    <p><b>Pourquoi Yahoo Finance ?</b> C'est la source gratuite la plus complète pour les places européennes, avec l'historique sur plusieurs dizaines d'années. Contrepartie : ce n'est pas une API officielle, elle peut changer ou limiter le nombre de requêtes. Les cours peuvent avoir un léger différé (jusqu'à 15 min selon la place).</p>
    <p><b>Pourquoi un cache ?</b> Pour éviter d'interroger Yahoo à chaque écran (et d'être bloqué). Un cours peut donc avoir jusqu'à ${min(cfg.cacheSeconds.quotes)} de retard supplémentaire.</p>
    <p><b>Places acceptées</b> (suffixe du ticker Yahoo) :</p>
    <div class="chips">${cfg.exchanges.map((e) => `<span class="chip"><b>.${e.suffix}</b> ${e.name}</span>`).join("")}</div>
    <p class="muted small">Les actions américaines sont accessibles via leur cotation européenne, en euros : par exemple Apple = <b>APC.F</b> (Francfort).</p>
  </section>

  <section class="card doc" id="prix">
    <h2>Prix d'exécution</h2>
    <p>C'est le prix auquel l'ordre simulé est considéré exécuté.</p>
    <table class="tbl">
      <tr><th>Ordre</th><th>Prix retenu</th></tr>
      <tr><td>Achat ou vente <b>aujourd'hui</b></td><td>Dernier cours connu</td></tr>
      <tr><td>Achat ou vente à une <b>date passée</b></td><td>Cours de clôture de ce jour</td></tr>
      <tr><td>Date passée sans cotation (week-end, jour férié)</td><td>Clôture du jour de bourse suivant</td></tr>
    </table>
    <p><b>Pourquoi la clôture ?</b> C'est le seul prix disponible de façon fiable pour n'importe quelle date passée, et c'est le prix de référence de la journée. La date réellement retenue est affichée dans l'aperçu avant de valider.</p>
    <p><b>Pourquoi le jour suivant ?</b> Un ordre passé un samedi chez un vrai courtier est exécuté à la réouverture du marché, le lundi.</p>
  </section>

  <section class="card doc" id="frais">
    <h2>Frais de courtage</h2>
    <p>Les frais sont <b>calculés automatiquement</b> à chaque ordre (achat et vente) : tu n'as rien à saisir. Ils apparaissent dans le récapitulatif avant validation.</p>
    <dl class="params">
      <dt>Modèle</dt><dd>Pourcentage du montant de l'ordre</dd>
      <dt>Taux</dt><dd><b>${T}</b></dd>
      <dt>Arrondi</dt><dd>Au centime le plus proche</dd>
      <dt>Minimum / maximum</dt><dd>Aucun</dd>
    </dl>

    <h3>Formules</h3>
    <div class="formula">frais = montant de l'ordre × ${T}</div>
    <p><b>Achat par montant</b> : le montant saisi est le <b>total débité, frais inclus</b> (comme un virement de 15 € qui ne te coûte jamais plus de 15 €).</p>
    <div class="formula">investi = montant saisi ÷ (1&nbsp;+&nbsp;${T})<br>frais = montant saisi − investi<br>quantité = investi ÷ cours</div>
    <p><b>Achat par nombre d'actions</b> : les frais s'ajoutent au prix des actions.</p>
    <div class="formula">frais = quantité × cours × ${T}<br>total débité = quantité × cours + frais</div>
    <p><b>Vente</b> : les frais sont déduits de ce que tu récupères.</p>
    <div class="formula">montant de la vente = quantité × cours<br>tu récupères = montant de la vente − montant de la vente × ${T}</div>

    <h3>Exemples (achat par montant)</h3>
    <table class="tbl num">
      <tr><th>Montant saisi</th><th>Investi en actions</th><th>Frais</th></tr>
      ${ex.map((e) => `<tr><td>${eur(e.b)}</td><td>${eur(e.invested)}</td><td>${eur(e.fees)}</td></tr>`).join("")}
    </table>

    <h3>Pourquoi ces choix ?</h3>
    <ul>
      <li><b>Un pourcentage plutôt qu'un forfait</b> : un forfait de 1 € par ordre représenterait ${num(100 / 15, 1)}&nbsp;% d'un investissement de 15 €, ce qui fausserait complètement la simulation des petits montants. Un pourcentage reste juste quel que soit le montant.</li>
      <li><b>${T}</b> : c'est l'ordre de grandeur des frais des courtiers en ligne des banques françaises pour des ordres de quelques centaines d'euros (les néo-courtiers sont moins chers, les agences bancaires plus chères). C'est volontairement prudent : mieux vaut sous-estimer légèrement ses gains.</li>
      <li><b>Frais à l'achat et à la vente</b> : comme chez un vrai courtier. Un aller-retour coûte donc environ <b>${num(roundTrip * 100)}&nbsp;%</b> : l'action doit monter d'autant pour que tu sois à l'équilibre. C'est pour cela qu'une position achetée à l'instant affiche déjà une petite perte.</li>
    </ul>
    <p class="muted small">Le taux est défini à un seul endroit du code (<code>lib/fees.ts</code>). S'il change, cette page et les calculs changent ensemble ; les positions déjà enregistrées gardent les frais calculés au moment de l'ordre.</p>
  </section>

  <section class="card doc" id="fractions">
    <h2>Fractions d'actions</h2>
    <dl class="params">
      <dt>Fractions</dt><dd>Autorisées</dd>
      <dt>Précision</dt><dd>${cfg.qtyDecimals} décimales, arrondi à l'inférieur</dd>
      <dt>Montant minimum</dt><dd>${eur(cfg.minOrderEur)} par achat</dd>
    </dl>
    <p><b>Pourquoi ?</b> Pour pouvoir investir n'importe quel montant (15 € dans une action à 320 € = ${num(splitBudget(15, t).invested / 320, cfg.qtyDecimals)} action). De plus en plus de courtiers le proposent. L'arrondi à l'inférieur garantit qu'on ne dépense jamais plus que le montant saisi ; le reliquat (moins d'un centime) est ignoré.</p>
  </section>

  <section class="card doc" id="devises">
    <h2>Devises</h2>
    <p>Tout est exprimé en <b>euros</b>. Pour une action cotée dans une autre devise (livre sterling, franc suisse, couronnes…), on convertit avec le taux de change Yahoo :</p>
    <div class="formula">valeur en € = quantité × cours × taux de change</div>
    <ul>
      <li><b>À l'achat</b> : taux du jour de l'achat, enregistré avec la position.</li>
      <li><b>Valorisation</b> : taux actuel.</li>
      <li><b>À la vente</b> : taux du jour de la vente.</li>
    </ul>
    <p>Ton gain inclut donc l'<b>effet de change</b>, comme dans la réalité : une action londonienne stable peut te faire gagner ou perdre si la livre varie face à l'euro.</p>
    <p class="muted small">Cas particulier : Londres cote en <b>pence</b> (GBp), soit 1/100 de livre. Exemple : 3 700 p × ${num(fx, 4)} €/p = ${eur(3700 * fx)}.</p>
  </section>

  <section class="card doc" id="gains">
    <h2>Calcul des gains</h2>
    <div class="formula">coût = quantité × prix d'achat × taux d'achat + frais d'achat</div>
    <div class="formula">valeur actuelle = quantité × dernier cours × taux actuel</div>
    <div class="formula">plus-value latente = valeur actuelle − coût</div>
    <div class="formula">plus-value réalisée = (montant de la vente − frais de vente) − coût</div>
    <div class="formula">performance (%) = plus-value ÷ coût</div>
    <ul>
      <li><b>Latente</b> : gain sur les positions que tu détiens encore (il peut encore changer).</li>
      <li><b>Réalisée</b> : gain définitivement acquis sur les positions vendues.</li>
      <li><b>Depuis le début</b> : latente + réalisée, rapportée au coût total de tous tes achats.</li>
      <li><b>Aujourd'hui</b> : quantité × (dernier cours − clôture de la veille). Pour un achat fait aujourd'hui, on part du prix d'achat.</li>
    </ul>
  </section>

  <section class="card doc" id="graphique">
    <h2>Graphique d'évolution</h2>
    <table class="tbl">
      <tr><th>Période</th><th>Un point toutes les</th></tr>
      <tr><td>1 jour</td><td>5 minutes (dernière séance)</td></tr>
      <tr><td>1 semaine</td><td>30 minutes (5 dernières séances)</td></tr>
      <tr><td>1 mois</td><td>jour (clôtures)</td></tr>
    </table>
    <ul>
      <li><b>Valeur</b> : valeur des positions détenues à chaque instant. <b>Investi</b> (pointillés) : leur coût. L'écart entre les deux est ta plus-value latente.</li>
      <li><b>Gain</b> : plus-value latente + plus-values réalisées, à chaque instant.</li>
      <li>Une position entre dans le graphique à l'<b>heure de saisie</b> pour un achat du jour, ou à la <b>clôture</b> du jour d'achat pour une date passée. Elle en sort à la clôture du jour de vente.</li>
      <li>Le graphique est limité à 1 mois pour rester lisible ; la fiche de chaque action montre l'historique jusqu'à plusieurs décennies.</li>
    </ul>
  </section>

  <section class="card doc" id="limites">
    <h2>Ce qui n'est pas simulé</h2>
    <ul>
      <li><b>Dividendes</b> : non versés. Pour les actions qui en distribuent beaucoup (énergie, banques…), le gain réel serait plus élevé.</li>
      <li><b>Taxe sur les transactions financières</b> (France, 0,4 % à l'achat des grandes sociétés françaises) : non appliquée.</li>
      <li><b>Impôts</b> sur les plus-values (flat tax de 30 % sur un compte-titres, régime PEA…) : non déduits. Les gains affichés sont avant impôts.</li>
      <li><b>Frais de change</b> facturés par certains courtiers sur les actions hors euro, et <b>droits de garde</b> : non appliqués.</li>
      <li><b>Écart achat/vente</b> (spread) et glissement de prix : on achète et vend exactement au cours affiché.</li>
      <li><b>Divisions d'actions</b> (splits) postérieures à un achat : la quantité n'est pas ajustée automatiquement.</li>
    </ul>
  </section>`;
}
