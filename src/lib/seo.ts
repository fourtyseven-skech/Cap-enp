import { useEffect } from "react";

/**
 * Socle SEO — lot 1 du cadrage MEGA-WEB-003.
 *
 * Chaque page déclare ici ses métadonnées. Avant ce module, TOUTES les URL du
 * site partageaient le titre, la description et l'image de partage figés dans
 * index.html : /erp s'annonçait aux moteurs comme la page d'accueil, et un
 * partage LinkedIn affichait le même aperçu quelle que soit la page.
 *
 * ⚠️ Portée réelle : ce hook agit dans le navigateur. Il corrige donc ce que
 * voient Google (passe de rendu différée) et les visiteurs, mais PAS les robots
 * des moteurs génératifs, qui n'exécutent pas JavaScript. C'est précisément
 * l'objet du lot 2 (pré-génération). Ce fichier est conçu pour être la source
 * unique que le lot 2 lira au moment de la construction, afin qu'aucune
 * métadonnée ne soit à ressaisir.
 */

export const SITE_URL = "https://megasoft-office.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/megasoft-favicon.png`;

export type SeoMeta = {
  title: string;
  description: string;
  /** Chemin absolu depuis la racine, ex. "/blog/". */
  path: string;
  ogImage?: string;
};

/** Métadonnées par route. Le lot 2 y ajoutera les articles du blog. */
export const seoByPath: Record<string, SeoMeta> = {
  "/": {
    title: "Megasoft — Éditeur de logiciels de gestion en Algérie depuis 1990",
    description:
      "Megasoft, éditeur de logiciels de gestion d'entreprise en Algérie depuis 1990. Office, Digital et Services : ERP, gestion commerciale, finance, RH, GPAO, GMAO, TMS, WMS, MES, cloud et IA pour TPE, PME et entreprises étatiques.",
    path: "/",
  },
  "/faq": {
    title: "Questions fréquentes — Megasoft",
    description:
      "Conformité SCF et IAS/IFRS, desktop ou cloud, ERP, MES, TMS, WMS, intégration SAP, My Exobrain : les réponses aux questions que posent les entreprises algériennes avant de choisir leur logiciel de gestion.",
    path: "/faq",
  },
};

/** Crée la balise si elle n'existe pas, puis met son contenu à jour. */
const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
};

const setCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
};

/** Applique les métadonnées d'une page. À appeler dans chaque composant de page. */
export const useSeo = (meta: SeoMeta) => {
  useEffect(() => {
    const url = `${SITE_URL}${meta.path}`;
    const image = meta.ogImage ?? DEFAULT_OG_IMAGE;

    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setCanonical(url);

    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("property", "og:type", meta.path === "/" ? "website" : "article");

    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:image", image);
  }, [meta]);
};
