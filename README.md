# Simu Finance

Simulateur d'investissements en bourse : tu simules un achat d'actions (aujourd'hui ou à une date passée)
et l'app te montre, jour après jour, ce que tu aurais gagné ou perdu si tu avais réellement investi.

Web app installable sur iPhone (PWA), hébergée sur **Cloudflare Pages** avec une base **D1**.
Données de marché : **Yahoo Finance** (endpoints non officiels, sans clé).

## Fonctionnalités (V1)

- **Tableau de bord** : valeur du portefeuille, plus-value totale / latente / réalisée, variation du jour,
  graphique d'évolution (valeur vs montant investi, ou gain cumulé) sur 1M / 3M / 6M / 1A / Tout,
  répartition par action, liste des positions ouvertes et vendues.
- **Recherche** d'actions sur les bourses européennes (Euronext Paris/Amsterdam/Bruxelles/Lisbonne/Milan,
  XETRA, Madrid, SIX, Londres, places nordiques…). Saisie directe d'un ticker Yahoo possible (ex : `ITX.MC`).
- **Fiche action** : cours, variation, graphique (1M → Max), tes positions sur cette action.
- **Achat simulé** : par montant en € (nombre entier d'actions) ou par nombre d'actions, à la date de ton choix,
  avec frais de courtage optionnels. Aperçu du cours retenu et du total avant validation.
- **Vente simulée** (clôture d'une position, avec annulation possible) et suppression.
- **Devises** : les actions cotées hors euro (GBp, CHF, SEK, DKK…) sont converties en € avec le taux de change
  historique du jour d'achat / de vente et le taux actuel pour la valorisation.
- **Accès protégé** par mot de passe (cookie de session signé, valable 1 an), activé dès que le secret `APP_PASSWORD` est défini.
- **Actualisation** des cours à l'ouverture de l'app et au retour dans l'app (et bouton ↻).

### Règles de calcul

- Achat à une date passée : cours de **clôture** de ce jour, ou du premier jour de bourse suivant (week-end, férié).
- Achat aujourd'hui : **dernier cours connu**.
- Coût = quantité × cours × taux de change + frais. Plus-value = valeur actuelle (ou produit de la vente net de frais) − coût.
- Les dividendes ne sont pas pris en compte (V1).

## Architecture

```
public/              Interface (HTML/CSS/JS sans build) + manifest PWA + icônes
  app.js             Application (tableau de bord, recherche, fiche action, achat/vente)
  vendor/            Chart.js
functions/           API (Cloudflare Pages Functions)
  _middleware.ts     Authentification sur tout le site
  api/login.ts       POST  /api/login
  api/logout.ts      POST  /api/logout
  api/search.ts      GET   /api/search?q=
  api/quote/[symbol] GET   /api/quote/:symbol?range=1y
  api/portfolio.ts   GET   /api/portfolio            (calcul du portefeuille)
  api/positions/     POST  /api/positions[?dryRun=1] (achat)
                     PATCH /api/positions/:id[?dryRun=1] (vente / annulation)
                     DELETE /api/positions/:id
lib/                 Yahoo Finance, calculs de portefeuille, auth
migrations/          Schéma D1
```

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

Si le runtime local n'a pas d'accès direct à Internet (derrière un proxy), lance `node scripts/dev-relay.mjs`
et ajoute `YAHOO_RELAY=http://127.0.0.1:8790` dans `.dev.vars`.

## Limites connues

- Yahoo Finance n'a pas d'API officielle : les endpoints peuvent changer ou limiter le débit (erreur 429).
  Les réponses sont mises en cache 5 min (recherche : 1 h) quand le cache Cloudflare est disponible.
- La recherche Yahoo ne remonte pas toujours la cotation européenne principale : utiliser le ticker direct.
- Pas de dividendes, pas de fractions d'actions en mode montant, une seule personne (pas de multi-comptes).
