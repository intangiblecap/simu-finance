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
  ["indices", "Comparer : indices et inflation"],
  ["wayback", "Remonter le temps"],
  ["decouvrir", "Tendances et actions à connaître"],
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
    <p>Tu peux avoir <b>plusieurs portefeuilles</b> (menu en haut à gauche), chacun avec sa <b>date de démarrage</b> : aucun achat ne peut avoir lieu avant. Un portefeuille démarré dans le passé permet de tester « et si j'avais commencé en 2015 ? » avec l'écran <a href="#/methode/wayback">Remonter le temps</a>. Les comparaisons et le gain total sont toujours calculés pour le portefeuille sélectionné.</p>
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
    <h3>Gain total, sur toute la vie du portefeuille</h3>
    <p>Le chiffre principal du tableau de bord prend en compte <b>tous les achats et toutes les ventes</b> depuis la date de démarrage du portefeuille, y compris les positions déjà vendues :</p>
    <div class="formula">gain total = valeur actuelle des positions + montants récupérés par les ventes − total investi</div>
    <div class="formula">performance (%) = gain total ÷ total investi</div>
    <p>Le <b>total investi</b> est la somme de tous les achats, frais compris ; les montants récupérés sont nets des frais de vente. Les frais payés sont donc déjà déduits du gain.</p>
    <ul>
      <li><b>Latente</b> : gain sur les positions que tu détiens encore (il peut encore changer).</li>
      <li><b>Réalisée</b> : gain définitivement acquis sur les positions vendues.</li>
      <li><b>Gain total</b> = latente + réalisée (c'est le même chiffre que la formule ci-dessus).</li>
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

  <section class="card doc" id="indices">
    <h2>Comparer : indices et inflation</h2>
    <p>Un <b>indice</b> mesure l'évolution d'un panier d'actions représentatif d'un marché. Le comparer à ton portefeuille répond à la vraie question : <b>« mes choix d'actions ont-ils fait mieux que si j'avais simplement acheté tout le marché ? »</b> Aujourd'hui, on peut acheter un indice entier en une fois grâce aux <b>ETF</b> (fonds indiciels cotés), pour des frais très faibles. Si ton portefeuille fait moins bien que l'indice, un ETF aurait été plus rentable, avec moins d'efforts.</p>

    <h3>Les références proposées</h3>
    <table class="tbl">
      <tr><th>Référence</th><th>Ce qu'elle représente</th></tr>
      ${cfg.benchmarks.map((b) => `<tr><td><b>${b.name}</b>${b.id === cfg.defaultBenchmark ? "<br><span class=\"muted small\">par défaut</span>" : ""}</td><td>${b.description}</td></tr>`).join("")}
    </table>
    <ul>
      <li><b>Pourquoi le STOXX Europe 600 par défaut ?</b> Une référence doit ressembler à ce dans quoi tu investis. Tu achètes des actions européennes : l'indice le plus large du marché européen est la comparaison la plus juste. Le CAC 40 convient si tu n'achètes que des actions françaises.</li>
      <li><b>Le S&amp;P 500</b> est la référence mondiale des marchés actions. Il est coté en dollars : on le convertit en euros, donc la comparaison inclut l'effet de change (comme pour un Européen qui achèterait un ETF S&amp;P 500).</li>
      <li><b>L'inflation</b> n'est pas un placement : c'est la hausse générale des prix. On la traite comme un placement qui rapporterait exactement l'inflation. C'est le <b>minimum à battre</b> : en dessous, ton argent achète moins de choses qu'avant, même si ton gain affiché est positif. Le <b>gain réel</b> = ton gain − ce qu'aurait « rapporté » l'inflation.</li>
      <li><b>Pourquoi pas le PIB ?</b> Le PIB mesure la taille de l'économie d'un pays, pas le rendement d'un placement : on ne peut pas l'acheter, il n'est publié que tous les trimestres et il est souvent révisé. Les marchés boursiers anticipent d'ailleurs l'économie au lieu de la suivre. Les indices boursiers et l'inflation sont donc des références plus utiles.</li>
      <li><b>Les bons du Trésor américain</b> ne sont pas des actions : ce sont des prêts à très court terme à l'État américain, considérés comme le placement le plus sûr au monde. Leur taux est appelé <b>taux sans risque</b>. Si ton portefeuille fait moins bien, tu as pris le risque des actions… pour gagner moins qu'un placement sans risque. (Le « bond » à 10 ans dont on parle souvent est un taux long, qui sert plutôt à évaluer les actions qu'à s'y comparer.)</li>
    </ul>

    <h3>Le calcul : un portefeuille « fantôme »</h3>
    <p>Pour que la comparaison soit juste, on rejoue <b>exactement tes opérations</b>, mais dans l'indice :</p>
    <ul>
      <li>chaque fois que tu achètes une action, le <b>même montant</b> (frais compris) est investi dans l'indice, <b>le même jour</b> ;</li>
      <li>chaque fois que tu vends, la part correspondante de l'indice est vendue le même jour ;</li>
      <li>les <b>mêmes frais de courtage</b> (${T}) sont appliqués à l'indice, comme si tu achetais un ETF chez le même courtier. Pas de frais pour le placement sans risque.</li>
    </ul>
    <div class="formula">parts d'indice = montant investi ÷ (1&nbsp;+&nbsp;${T}) ÷ niveau de l'indice le jour de l'achat</div>
    <div class="formula">gain de l'indice = parts × niveau actuel − montant investi</div>
    <div class="formula">écart = gain de mon portefeuille − gain de l'indice</div>
    <p>Pour l'inflation, on utilise l'<b>indice des prix à la consommation harmonisé (IPCH) de la France</b>, publié chaque mois par Eurostat. Il est interpolé jour par jour, puis prolongé au rythme moyen des 12 derniers mois pour les mois pas encore publiés (environ un mois et demi de retard) :</p>
    <div class="formula">gain de l'inflation = montant investi × (indice aujourd'hui ÷ indice le jour de l'achat − 1)</div>
    <p>Pour le taux sans risque, l'argent est rémunéré chaque jour au taux des bons du Trésor à 3 mois :</p>
    <div class="formula">valeur(j) = valeur(j−1) × (1 + taux annuel × jours écoulés ÷ 360)</div>
    <p class="muted small">Les indices utilisés sont des indices « de prix », sans dividendes, comme ton portefeuille simulé : la comparaison est donc cohérente. Exception : l'ETF MSCI World réinvestit ses dividendes, ce qui l'avantage légèrement. Le taux sans risque est appliqué tel quel en euros, sans effet de change.</p>
  </section>

  <section class="card doc" id="wayback">
    <h2>Remonter le temps</h2>
    <p>Cet écran permet de <b>réécrire ton portefeuille à une date passée</b> : tu choisis un jour, puis le montant que tu aurais investi ce jour-là dans chaque action.</p>
    <ul>
      <li>La liste reprend les actions de ton portefeuille, avec leur cours ce jour-là et aujourd'hui. Le bouton <b>+</b> en ajoute d'autres.</li>
      <li>Le montant saisi est le <b>total investi ce jour-là, frais compris</b>, exactement comme un achat normal (même prix d'exécution, mêmes frais, fractions autorisées).</li>
      <li>Si tu avais déjà des achats ce jour-là pour cette action, ils sont <b>remplacés</b> par le nouveau montant. Mettre <b>0</b> les supprime. Les achats déjà vendus ne sont pas modifiés.</li>
      <li>L'aperçu montre, avant d'appliquer, ce que vaudrait chaque montant aujourd'hui. Rien n'est enregistré tant que tu n'as pas appuyé sur <b>Appliquer</b>.</li>
    </ul>
  </section>

  <section class="card doc" id="decouvrir">
    <h2>Tendances et actions à connaître</h2>
    <h3>Tendances du jour</h3>
    <dl class="params">
      <dt>Univers</dt><dd>${cfg.trendUniverseSize} grandes capitalisations européennes (France, Allemagne, Pays-Bas, Italie, Espagne, Suisse, Royaume-Uni, Danemark)</dd>
      <dt>Classement</dt><dd>Variation sur la dernière séance</dd>
      <dt>Affichage</dt><dd>Les ${cfg.trendTopN} plus fortes hausses et les ${cfg.trendTopN} plus fortes baisses</dd>
      <dt>Mise à jour</dt><dd>Cours mis en cache ${min(cfg.cacheSeconds.quotes)}</dd>
    </dl>
    <div class="formula">variation = (dernier cours − clôture de la séance précédente) ÷ clôture de la séance précédente</div>
    <ul>
      <li><b>Pourquoi un univers fixe ?</b> Yahoo Finance propose une liste « trending », mais elle ne contient quasiment que des actions américaines. On calcule donc nos propres tendances sur les plus grandes sociétés européennes, qui sont aussi les plus liquides.</li>
      <li><b>Pourquoi les grandes capitalisations ?</b> Les petites sociétés peuvent bouger de 20 % sur une simple rumeur ; sur les grandes, une forte variation signale en général une vraie nouvelle (résultats, annonce, secteur en mouvement).</li>
      <li>Le week-end et les jours fériés, ce sont les variations de la <b>dernière séance</b> qui sont affichées.</li>
      <li>Le mini-graphique montre la dernière séance (un point toutes les 15 min) ; la ligne pointillée est la clôture de la veille.</li>
    </ul>
    <h3>${cfg.featured.length} actions à connaître</h3>
    <p>Une sélection fixe de sociétés que tout investisseur en actions européennes croise tôt ou tard. Critères :</p>
    <ul>
      <li><b>Leader mondial ou européen</b> de son secteur ;</li>
      <li>parmi les <b>plus grosses capitalisations</b> d'Europe, donc très suivies et faciles à acheter ;</li>
      <li><b>diversité</b> des secteurs (luxe, énergie, tech, santé, banque, industrie, défense…) et des pays, pour comprendre comment chaque secteur réagit à l'actualité.</li>
    </ul>
    <p><b>Ce ne sont pas des recommandations d'achat.</b> Cette liste sert à découvrir le marché et à tester des simulations, pas à indiquer ce qui va monter.</p>
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
