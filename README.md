# La Savane des Bananiers 🐒🍌

Un jeu pédagogique pour apprendre les bases de la bourse, sans jargon, dans un univers de savane.

Le joueur incarne un singe avec un capital de départ de 20 bananes. Il investit dans des
bananiers (chacun représentant une entreprise avec un profil de risque différent),
fait avancer les saisons pour voir les prix évoluer et les dividendes tomber, et peut
acheter ou revendre des branches à tout moment.

## Profils de bananiers

- **Bananeraie centenaire** — stable, peu volatile, verse des dividendes réguliers.
- **Jeune pousse ambitieuse** — très volatile, aucun dividende, fort potentiel de gain ou de perte.
- **Bananeraie industrielle** — rendement moyen, cyclique.
- **Labo de greffage** — volatile, coups de génie ou échecs.
- **Petite bananeraie familiale** — peu d'échanges, prix qui bouge à peine.

## Lancer le projet

```bash
npm install
npm run dev
```

Tout tourne en state React local : pas de backend, pas de sauvegarde persistante pour l'instant.

## Stack

React + TypeScript + Vite.
