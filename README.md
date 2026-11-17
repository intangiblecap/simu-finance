# Simu Finance

Simulateur d'investissements en bourse : tu simules un achat d'actions (aujourd'hui ou à une date passée)
et l'app te montre, jour après jour, ce que tu aurais gagné ou perdu si tu avais réellement investi.

Web app installable sur iPhone (PWA), hébergée sur **Cloudflare Pages** avec une base **D1**.
Données de marché : **Yahoo Finance** (endpoints non officiels, sans clé).

## Fonctionnalités (V1)

- **Tableau de bord** : valeur du portefeuille, plus-value totale / latente / réalisée, variation du jour,
  graphique d'évolution (valeur vs montant investi, ou gain cumulé) sur 1 jour (pas de 5 min),
  1 semaine (pas de 30 min) ou 1 mois (journalier), répartition par action, positions ouvertes et vendues.
- **Historique** : frise des opérations (démarrage, achats, ventes avec plus-value), groupée par mois, filtrable ;
  les 3 dernières sont reprises sur le tableau de bord.
- **Plusieurs portefeuilles** (menu en haut à gauche), chacun avec une **date de démarrage** : aucun achat avant
  cette date ; un portefeuille démarré dans le passé s'ouvre sur « Remonter le temps » à cette date.
- **Gain total sur toute la vie du portefeuille** : valeur actuelle + montants récupérés par les ventes − total
  investi (tous les achats, frais compris).
- **Onglet « Comparer »** : ce qu'aurait rapporté le même argent, aux mêmes dates, dans chaque référence :
  STOXX Europe 600, CAC 40, Euro Stoxx 50, S&P 500 (converti en €), MSCI World, bons du Trésor US (taux sans risque)
  et **inflation France** (IPCH Eurostat), avec le **gain réel** après inflation. Méthode du « portefeuille fantôme »
  (`lib/benchmark.ts`, `lib/inflation.ts`).
- **Remonter le temps** : choisir une date passée, voir le cours de chaque action ce jour-là et aujourd'hui,
  fixer le montant investi ce jour-là (0 = retirer, + pour ajouter une action), aperçu puis application.
- **Fiche action** claire : en-tête (cours, variation du jour), graphique avec performance et plus haut / plus bas
  de la période, « Ma position » (synthèse + détail des achats et ventes), bouton « Simuler un achat » toujours
  visible qui ouvre un parcours guidé (Combien ? → Quand ? → récapitulatif).
- **Découvrir** : tendances du jour (5 plus fortes hausses / baisses parmi ~64 grandes capitalisations
  européennes, avec mini-graphique de la séance) et 20 actions à connaître, chacune avec une phrase d'explication
  (liste dans `lib/universe.ts`).
- **Recherche** d'actions sur les bourses européennes (Euronext Paris/Amsterdam/Bruxelles/Lisbonne/Milan,
  XETRA, Madrid, SIX, Londres, places nordiques…). Saisie directe d'un ticker Yahoo possible (ex : `ITX.MC`).
  Quand une société est cotée sur plusieurs bourses, la **cotation principale** (la plus échangée, en euros)
  est mise en avant et les cotations secondaires sont expliquées.
- **Fiche action** : cours, variation, graphique (1J, 1S, 1M, 1A, 5A, Max), tes positions sur cette action.
- **Achat simulé** : par montant en € ou par nombre d'actions, **fractions d'actions autorisées**
  (ex : 15 € d'Apple), à la date de ton choix. Aperçu du cours, de la quantité, des frais et du total avant validation.
- **Frais de courtage simulés automatiquement** : 0,5 % de chaque ordre (achat et vente), voir `lib/fees.ts`.
- **Vente simulée** (clôture d'une position, avec annulation possible) et suppression.
- **Devises** : les actions cotées hors euro (GBp, CHF, SEK, DKK…) sont converties en € avec le taux de change
  historique du jour d'achat / de vente et le taux actuel pour la valorisation.
- **Onglet « Méthode »** : bibliothèque de fiches courtes (une par sujet) qui explique chaque choix (source des données, prix d'exécution, frais avec formules
  et exemples, fractions, devises, calcul des gains, graphique, limites). Les paramètres affichés viennent de
  `/api/config`, donc des mêmes constantes que les calculs (`lib/fees.ts`).
- **Accès protégé** par mot de passe (cookie de session signé, valable 1 an), activé dès que le secret `APP_PASSWORD` est défini.
- **Actualisation** des cours à l'ouverture de l'app et au retour dans l'app (et bouton ↻).

### Règles de calcul

- Achat à une date passée : cours de **clôture** de ce jour, ou du premier jour de bourse suivant (week-end, férié).
- Achat aujourd'hui : **dernier cours connu**.
- Achat par montant : le montant saisi est le total débité, frais inclus (15 € → 14,93 € d'actions + 0,07 € de frais).
  Quantité arrondie à 6 décimales.
- Coût = quantité × cours × taux de change + frais. Plus-value = valeur actuelle (ou produit de la vente net de frais) − coût.
- Les dividendes ne sont pas pris en compte (V1).

## Architecture

```
public/              Interface (HTML/CSS/JS sans build) + manifest PWA + icônes
  app.js             Application (tableau de bord, recherche, fiche action, achat/vente)
  method.js          Onglet « Méthode » (explication des calculs)
  vendor/            Chart.js
functions/           API (Cloudflare Pages Functions)
  _middleware.ts     Authentification sur tout le site
  api/login.ts       POST  /api/login
  api/logout.ts      POST  /api/logout
  api/search.ts      GET   /api/search?q=
  api/quote/[symbol] GET   /api/quote/:symbol?range=1y
  api/portfolio.ts   GET   /api/portfolio            (calcul du portefeuille)
  api/timeline.ts    GET   /api/timeline?period=1d|1w|1m (évolution)
  api/session.ts     GET   /api/session              (accès protégé ou non)
  api/config.ts      GET   /api/config               (paramètres de simulation)
  api/discover.ts    GET   /api/discover             (tendances + actions à connaître)
  api/portfolios/    GET/POST /api/portfolios, PATCH/DELETE /api/portfolios/:id
  api/benchmark.ts   GET   /api/benchmark?ids=       (comparaison avec les références)
  api/wayback.ts     GET   /api/wayback?date=        (remonter le temps : état à une date)
                     POST  /api/wayback[?dryRun=1]   (fixer les montants investis à une date)
  api/positions/     POST  /api/positions[?dryRun=1] (achat)
                     PATCH /api/positions/:id[?dryRun=1] (vente / annulation)
                     DELETE /api/positions/:id
lib/                 Yahoo Finance, calculs de portefeuille, auth
migrations/          Schéma D1
```

Le portefeuille courant est transmis par l'interface dans l'en-tête `X-Portfolio-Id`.
Le schéma de la base est mis à jour **automatiquement** au premier appel de l'API (`lib/schema.ts`) :
aucune requête SQL à exécuter à la main lors des évolutions (les fichiers de `migrations/` servent de référence).

La table `positions` a une colonne `instrument_type` (`stock` pour l'instant) pour accueillir
plus tard ETF, crypto, obligations, etc.

## Déploiement sur Cloudflare

1. **Base D1** : dans le tableau de bord Cloudflare → *Storage & Databases* → *D1* → *Create database*,
   nom `simu-finance`. Son ID est renseigné dans `wrangler.toml`.
2. **Tables** : dans la console de la base D1 (*Console*), colle et exécute le contenu de
   `migrations/0001_init.sql`.
   (Ou en ligne de commande : `npx wrangler d1 migrations apply simu-finance --remote`.)
3. **Projet Pages** : *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → dépôt `simu-finance`.
   - Framework preset : *None*
   - Build command : *(vide)*
   - Build output directory : `public`
4. **Mot de passe** (recommandé) : dans le projet Pages → *Settings* → *Variables and Secrets*, ajoute
   le secret `APP_PASSWORD`, puis relance un déploiement (*Deployments* → *Retry deployment*).
   Sans ce secret, l'app est accessible sans connexion et affiche un avertissement.
   `SESSION_SECRET` (optionnel) permet de déconnecter toutes les sessions en le changeant.
5. Ouvre l'URL `https://<projet>.pages.dev`.

Le binding D1 (`DB`) est lu depuis `wrangler.toml`. Chaque push sur la branche de production redéploie le site.

## Installer sur iPhone

Ouvre le site dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
L'app s'ouvre ensuite en plein écran avec sa propre icône. Il faut se connecter une fois dans l'app
(elle a ses propres cookies, distincts de Safari).

## Développement local

```bash
npm install
cp .dev.vars.example .dev.vars        # mot de passe de dev
npm run db:migrate:local
npm run dev                           # http://localhost:8788
```

Si le runtime local n'a pas d'accès direct à Internet (derrière un proxy), lance `node scripts/dev-relay.mjs` (relais Yahoo + Eurostat)
et ajoute `YAHOO_RELAY=http://127.0.0.1:8790` dans `.dev.vars`.

## Limites connues

- Yahoo Finance n'a pas d'API officielle : les endpoints peuvent changer ou limiter le débit (erreur 429).
  Les réponses sont mises en cache 5 min (recherche : 1 h) quand le cache Cloudflare est disponible.
- La recherche Yahoo ne remonte pas toujours la cotation européenne principale : utiliser le ticker direct.
- Pas de dividendes, une seule personne (pas de multi-comptes).
- Graphique 1 jour / 1 semaine : taux de change et cours intrajournaliers ; un achat daté du jour démarre
  à l'heure de saisie, un achat à une date passée à la clôture de ce jour.
