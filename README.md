# Megasoft Office — Site vitrine

Site web officiel de **Megasoft Office**, éditeur de logiciels de gestion
d'entreprise en Algérie depuis 1990. Présentation des trois pôles —
**Office**, **Digital** et **Services** — couvrant l'ERP, la gestion
commerciale, la finance, les RH, la GPAO, la GMAO, le TMS, le MES, le cloud,
l'intégration SAP et l'IA.

Application web monopage (single-page) construite avec React, Vite et Tailwind CSS.

---

## Stack technique

- **React 18** + **TypeScript**
- **Vite** — bundler et serveur de développement
- **Tailwind CSS** — design system (voir `src/index.css` et `tailwind.config.ts`)
- **Framer Motion** + **GSAP / ScrollTrigger** — animations et effets au défilement
- **React Router** — routage
- **shadcn/ui** (Radix UI) — composants d'interface

---

## Prérequis

- [Node.js](https://nodejs.org/) **18 ou supérieur**
- npm (fourni avec Node.js)

## Installation

```bash
npm install
```

## Développement

Lance le serveur de développement avec rechargement à chaud :

```bash
npm run dev
```

Le site est alors accessible sur **http://localhost:8080**.

## Build de production

Génère la version optimisée dans le dossier `dist/` :

```bash
npm run build
```

Pour prévisualiser localement le build de production :

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

---

## Structure du projet

```
public/                 Fichiers statiques servis tels quels (favicon, vidéos hero…)
src/
  assets/               Images du site
    clients/            Logos des clients / partenaires
    megasoft/           Visuels de marque (logos, intro, poster hero)
  components/           Composants de la page
    brand/              Identité de marque (logo vectoriel, emblème, révélation des pôles)
    ui/                 Composants d'interface (shadcn/ui)
  pages/                Pages routées (Index, NotFound)
  hooks/                Hooks React réutilisables
  lib/                  Utilitaires
  index.css             Design system (couleurs, typographie, tokens)
  App.tsx               Racine de l'application et routage
  main.tsx              Point d'entrée
index.html              Gabarit HTML + métadonnées SEO / Open Graph
```

La page d'accueil (`src/pages/Index.tsx`) assemble les sections du site :
Hero, Qui sommes-nous, Solutions, Pourquoi nous, Partenaires, Témoignages,
Références, Contact.

---

## Identité visuelle

La charte graphique de Megasoft — « Le Double Trait » — définit les couleurs,
la typographie (Poppins + Inter Tight) et les motifs. Les couleurs des pôles
ne se mélangent jamais : Bleu **Office**, Vert **Service**, Rose **Digital**.

---

© Megasoft — Tous droits réservés.
