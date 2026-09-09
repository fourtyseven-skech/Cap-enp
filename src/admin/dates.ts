/**
 * Dates du panel.
 *
 * Ces fonctions vivent à part des composants : un module qui exporte à la fois
 * des composants et des utilitaires perd le rechargement à chaud de React, et
 * `ui.tsx` est justement le fichier qu'on retouche le plus souvent.
 */

/** Format ISO local (`AAAA-MM-JJ`), sans passage par UTC. */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Analyse une date ISO à la main plutôt qu'avec `new Date("2025-03-12")`, que
 * la spécification impose d'interpréter en UTC : à Alger comme partout à l'est
 * de Greenwich, la date affichée reculait d'un jour en fin de soirée.
 */
export const depuisIso = (s?: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** « il y a 3 jours », « dans 2 mois » — la distance, pas la date. */
export const relatif = (valeur?: string): string => {
  const d = depuisIso(valeur);
  if (!d) return "";
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jours = Math.round((d.getTime() - aujourdhui.getTime()) / 86400000);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours === -1) return "hier";
  const n = Math.abs(jours);
  if (n < 31) return jours < 0 ? `il y a ${n} jours` : `dans ${n} jours`;
  const mois = Math.round(n / 30.44);
  if (mois < 12) return jours < 0 ? `il y a ${mois} mois` : `dans ${mois} mois`;
  const ans = Math.floor(mois / 12);
  return jours < 0 ? `il y a ${ans} an${ans > 1 ? "s" : ""}` : `dans ${ans} an${ans > 1 ? "s" : ""}`;
};
