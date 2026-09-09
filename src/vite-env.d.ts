/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Accès au panel d'administration. Voir .env.example et src/admin/auth.ts.
   * Non défini = refus en production, mode atelier en développement local.
   */
  readonly VITE_ADMIN_AUTH?: "aucun" | "atelier" | "serveur";
  /** Code d'accès partagé du mode atelier. */
  readonly VITE_ADMIN_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * `fetchpriority` en minuscules sur les images.
 *
 * React 18 ne reconnaît pas la forme camelCase `fetchPriority` : il l'écarte du
 * DOM avec un avertissement, et la priorité de chargement qu'on croyait donner
 * à l'image du Hero n'était jamais appliquée. En minuscules, React laisse
 * passer l'attribut tel quel et le navigateur l'honore — mais les types JSX de
 * React 18 ne le déclarent pas. On l'ajoute ici.
 *
 * À supprimer lors du passage à React 19, qui gère `fetchPriority` nativement.
 */
declare namespace React {
  interface ImgHTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
