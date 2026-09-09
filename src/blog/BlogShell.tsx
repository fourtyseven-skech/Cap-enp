import { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Fond from "./Fond";
import type { Accent, Motif } from "./covers";

/**
 * Habillage des pages du blog.
 *
 * L'en-tête et le pied de page sont LES composants du site, pas une
 * reproduction : toute évolution de l'un se répercute automatiquement sur le
 * blog, sans double maintenance ni risque de divergence.
 *
 * Ils sont rendus en HTML au build puis réactivés côté client par
 * src/entry-blog-client.tsx — c'est la seule raison pour laquelle les pages du
 * blog embarquent du JavaScript. Le texte des articles, lui, reste entièrement
 * dans le HTML et n'en dépend pas.
 *
 * Le fond n'est pas uni : <Fond> compose une ambiance dérivée de l'article
 * affiché (motif du sujet, couleur du pôle, mot en filigrane).
 *
 * Contrainte : ce composant et tous ses enfants sont rendus côté serveur (Node)
 * — donc aucun accès à `window`, `document` ou `sessionStorage`.
 */

const BlogShell = ({
  children,
  motif,
  accent,
  mot,
}: {
  children: ReactNode;
  motif?: Motif;
  accent?: Accent;
  mot?: string;
}) => (
  <div className="relative min-h-screen flex flex-col bg-background font-sans text-foreground">
    <Fond motif={motif} accent={accent} mot={mot} />

    {/* ---------- En-tête du site ----------
        Ce sont les composants réels de la page d'accueil, pas une reproduction :
        toute évolution du header ou du footer se répercute ici sans double
        maintenance. Ils sont rendus ici en HTML puis réactivés côté client par
        src/entry-blog-client.tsx. */}
    <div id="ms-header">
      <Header staticNav />
    </div>

    {/* Le header est en `fixed` : on réserve sa hauteur, comme le fait Layout
        pour les pages du site autres que l'accueil. */}
    <main className="relative z-10 flex-grow w-full pt-24">{children}</main>

    <div id="ms-footer" className="relative z-10">
      <Footer />
    </div>
  </div>
);

export default BlogShell;
