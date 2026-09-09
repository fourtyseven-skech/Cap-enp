import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { BALISES_COMMUNES } from "./scripts/tete-commune.mjs";
import { greffonContenu } from "./src/contenu/greffon";
import { serveurContenuDev } from "./src/contenu/serveurDev";
import { serveurMediasDev } from "./src/contenu/mediasDev";

/**
 * Aperçu du blog en développement.
 *
 * En production, les pages du blog sont des fichiers HTML générés par
 * `scripts/build-blog.mjs`. Le serveur de développement, lui, ne sert que
 * l'application : sans cet intergiciel, /blog/ renverrait la page d'accueil et
 * un rédacteur ne pourrait pas relire son article avant publication.
 *
 * On réutilise exactement le même module de rendu que le build : ce qui
 * s'affiche ici est ce qui sera publié, et modifier un fichier Markdown suffit
 * à rafraîchir la page.
 */
function blogDevServer(): Plugin {
  return {
    name: "megasoft-blog-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith("/blog")) return next();

        try {
          const mod = await server.ssrLoadModule("/src/entry-blog.tsx");
          const routes = mod.renderAll() as { path: string; html: string; title: string }[];
          const route = routes.find((r) => r.path === (url.endsWith("/") ? url : `${url}/`));
          if (!route) return next();

          const html = `<!doctype html>
<html lang="fr">
  <head>
    ${BALISES_COMMUNES}
    <title>${route.title}</title>
    <!--
      La feuille de style est demandée en LIEN, pas seulement importée depuis un
      module. Importée par JavaScript, elle n'arrive qu'après l'analyse du
      document : la page se peignait donc une première fois sans aucun style —
      en-tête pleine largeur, liens bleus par défaut — avant de se corriger. En
      production le problème n'existe pas (vraie balise <link>), mais la
      transition de page capture précisément cette première peinture : c'est
      elle que l'on voyait figée à l'arrivée sur le blog.

      Le suffixe ?direct demande à Vite le CSS brut plutôt que son module. Le
      module reste chargé juste après, pour le rechargement à chaud.
    -->
    <link rel="stylesheet" href="/src/index.css?direct" />
    <script type="module">import "/src/index.css";</script>
  </head>
  <body>
    ${route.html}
    <!--
      Même drapeau qu'en production (voir scripts/build-blog.mjs) : le visiteur
      qui lit un article a déjà découvert le site, le rideau d'introduction n'a
      plus lieu d'être s'il rejoint ensuite l'accueil. Il manquait ici, et
      l'intro se rejouait à chaque retour pendant les relectures.
    -->
    <script>try{sessionStorage.setItem("hasSeenIntro","true");sessionStorage.setItem("msIntroSkip","1")}catch(e){}</script>
    <script type="module" src="/src/entry-blog-client.tsx"></script>
  </body>
</html>`;

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(await server.transformIndexHtml(url, html));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Refuse de construire le site si le contenu de la page d'accueil ne
    // respecte pas son schéma. Voir src/contenu/greffon.ts.
    greffonContenu(),
    // Routes de développement qui laissent le panel écrire dans
    // `content/accueil/` : l'éditeur local. Absentes du site construit.
    serveurContenuDev(),
    // Envoi et service des images en mode local. Absent du site construit.
    serveurMediasDev(),
    blogDevServer(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Le script de génération du blog a besoin de connaître les noms de
    // fichiers hachés (feuille de style, îlots du blog).
    manifest: true,
    // Découpage du bundle par domaine : les libs tierces (React, animations,
    // UI) partent dans des chunks séparés et stables. Ainsi, une modification
    // du code applicatif n'invalide pas le cache navigateur du vendor, qui
    // représente l'essentiel du poids et change rarement.
    rollupOptions: {
      // Deuxième point d'entrée : les îlots interactifs des pages du blog
      // (en-tête et pied de page du site). Il ne contient ni GSAP ni les
      // sections de la page d'accueil.
      input: {
        main: path.resolve(__dirname, "index.html"),
        "blog-client": path.resolve(__dirname, "src/entry-blog-client.tsx"),
      },
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Framer et GSAP séparés : l'en-tête et le pied de page n'utilisent
          // que Framer. Les regrouper obligeait les pages du blog à télécharger
          // GSAP — ~130 Ko dont elles n'ont aucun usage.
          motion: ["framer-motion"],
          gsap: ["gsap", "@gsap/react"],
        },
      },
    },
  },
}));
