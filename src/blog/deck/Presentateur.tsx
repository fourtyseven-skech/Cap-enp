import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FORMATS, nombreEtapes, type Document } from "./modele";
import { RenduDiapositive, STYLES_RENDU, type RenduGraphique } from "./Rendu";

/**
 * ---------------------------------------------------------------------------
 * PRÉSENTATEUR
 * ---------------------------------------------------------------------------
 *
 * Le dessin des diapositives n'est pas ici : il est dans `Rendu.tsx`, que
 * l'éditeur et l'export consomment aussi. Ce fichier ne s'occupe que de la
 * CONDUITE — avancer, reculer, projeter.
 *
 * MORPHING. Deux diapositives qui contiennent un élément de MÊME IDENTIFIANT le
 * font glisser de l'une à l'autre au lieu de le faire disparaître puis
 * réapparaître ailleurs. C'est le mécanisme de bento, et il ne demande aucune
 * déclaration : dupliquer une diapositive conserve les identifiants, il suffit
 * ensuite de déplacer ou d'agrandir un bloc pour que l'animation existe.
 *
 * Technique FLIP : on mesure avant, on mesure après, on rejoue le trajet à
 * l'envers. L'élément est déjà à sa place définitive — seule sa peinture est
 * ramenée en arrière puis relâchée. Le compositeur ne manipule qu'une
 * transformation, aucune mise en page n'est recalculée : c'est ce qui tient les
 * 60 images par seconde sur la machine du client, qui n'est jamais celle du
 * développeur.
 */

const useMorphage = <T extends HTMLElement>(actif: boolean) => {
  const conteneur = useRef<T>(null);
  const positions = useRef(new Map<string, DOMRect>());

  // Sans tableau de dépendances : la mesure doit suivre CHAQUE rendu, sinon la
  // position de référence date d'un état déjà périmé.
  useLayoutEffect(() => {
    const racine = conteneur.current;
    if (!racine) return;

    const vue = racine.ownerDocument.defaultView;
    const reduit = vue?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const vus = new Set<string>();

    racine.querySelectorAll<HTMLElement>("[data-morph]").forEach((n) => {
      const cle = n.dataset.morph;
      if (!cle) return;
      vus.add(cle);

      const apres = n.getBoundingClientRect();
      const avant = positions.current.get(cle);
      positions.current.set(cle, apres);
      if (!avant || reduit || !actif) return;

      const dx = avant.left - apres.left;
      const dy = avant.top - apres.top;
      const kx = apres.width > 1 ? avant.width / apres.width : 1;
      const ky = apres.height > 1 ? avant.height / apres.height : 1;

      // Sous le pixel et sous le pour-cent, c'est un arrondi, pas un mouvement.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(kx - 1) < 0.01 && Math.abs(ky - 1) < 0.01) return;

      n.animate(
        [
          { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${kx}, ${ky})` },
          { transformOrigin: "top left", transform: "none" },
        ],
        { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    });

    positions.current.forEach((_, cle) => {
      if (!vus.has(cle)) positions.current.delete(cle);
    });
  });

  return conteneur;
};

type Vue = "scene" | "ensemble";

export const Presentateur = ({
  doc,
  onFermer,
  depart = 0,
  ancrage = true,
  graphique,
}: {
  doc: Document;
  onFermer: () => void;
  depart?: number;
  /**
   * Synchronise l'adresse de la page avec la diapositive affichée. Vrai sur le
   * blog, où l'article est derrière et où une diapositive doit être partageable.
   * Faux dans le panel : la présentation y est un aperçu, il n'y a pas d'article
   * à rejoindre, et écrire dans l'historique casserait le bouton Précédent.
   */
  ancrage?: boolean;
  graphique?: RenduGraphique;
}) => {
  const diapos = useMemo(() => doc.diapositives.filter((d) => !d.masque), [doc.diapositives]);
  const [indice, setIndice] = useState(() => Math.min(Math.max(depart, 0), diapos.length - 1));
  const [etape, setEtape] = useState(0);
  const [vue, setVue] = useState<Vue>("scene");
  const [notes, setNotes] = useState(false);
  const [aide, setAide] = useState(false);
  const [echelle, setEchelle] = useState(1);
  const [secondes, setSecondes] = useState(0);

  const hote = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const morphage = useMorphage<HTMLDivElement>(vue === "scene");

  const d = diapos[indice];
  const etapes = d ? nombreEtapes(d) : 0;
  const { largeur, hauteur } = FORMATS[doc.format];

  const allerA = useCallback(
    (i: number, tout = false) => {
      const cible = Math.min(Math.max(i, 0), diapos.length - 1);
      setIndice(cible);
      // Tout dévoilé quand on recule : revenir sur une diapositive doit la
      // retrouver dans l'état où on l'a quittée, pas la faire rejouer.
      setEtape(tout ? nombreEtapes(diapos[cible]) : 0);
    },
    [diapos]
  );

  const suivant = useCallback(() => {
    if (etape < etapes) {
      setEtape((e) => e + 1);
      return;
    }
    if (indice < diapos.length - 1) allerA(indice + 1);
  }, [etape, etapes, indice, diapos.length, allerA]);

  const precedent = useCallback(() => {
    if (etape > 0) {
      setEtape((e) => e - 1);
      return;
    }
    if (indice > 0) allerA(indice - 1, true);
  }, [etape, indice, allerA]);

  /* Sortie. On ne remonte pas en haut de l'article : on rejoint l'intertitre de
     la diapositive regardée, le lecteur reprend là où il en était.
     Déclaré AVANT les effets qui l'utilisent — un `useCallback` référencé plus
     haut serait lu avant son initialisation. */
  const fermer = useCallback(() => {
    if (ancrage && typeof window !== "undefined") {
      const ancre = d?.ancre;
      window.history.replaceState(null, "", ancre ? `#${ancre}` : window.location.pathname);
      if (ancre) document.getElementById(ancre)?.scrollIntoView({ block: "start" });
    }
    onFermer();
  }, [d?.ancre, onFermer, ancrage]);

  useEffect(() => {
    if (!ancrage || typeof window === "undefined" || !d) return;
    const cible = `#diapo-${indice + 1}`;
    if (window.location.hash !== cible) window.history.replaceState(null, "", cible);
  }, [indice, ancrage, d]);

  /* Les raccourcis du métier, pas une gestuelle inventée. */
  useEffect(() => {
    const hoteDoc = cadre.current?.ownerDocument ?? document;
    const au = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Escape") {
        if (aide) return setAide(false);
        if (vue === "ensemble") return setVue("scene");
        return fermer();
      }
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Enter") {
        e.preventDefault();
        return vue === "ensemble" ? setVue("scene") : suivant();
      }
      if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") {
        e.preventDefault();
        return precedent();
      }
      if (k === "Home") return allerA(0);
      if (k === "End") return allerA(diapos.length - 1, true);
      if (k === "o" || k === "O") return setVue((v) => (v === "scene" ? "ensemble" : "scene"));
      if (k === "s" || k === "S") return setNotes((n) => !n);
      if (k === "?") return setAide((a) => !a);
      if (k === "f" || k === "F") {
        if (hoteDoc.fullscreenElement) hoteDoc.exitFullscreen?.();
        else hoteDoc.documentElement.requestFullscreen?.();
      }
    };
    hoteDoc.addEventListener("keydown", au);
    return () => hoteDoc.removeEventListener("keydown", au);
  }, [suivant, precedent, allerA, fermer, vue, aide, diapos.length]);

  /* Le canevas est de taille fixe : on le ramène à la place disponible. Un
     ResizeObserver plutôt que l'événement `resize` — le panneau des notes
     s'ouvre sans que la fenêtre bouge, et la scène doit s'y adapter. */
  useEffect(() => {
    const n = hote.current;
    if (!n || typeof ResizeObserver === "undefined") return;
    const mesurer = () => {
      const r = n.getBoundingClientRect();
      setEchelle(Math.min(r.width / largeur, r.height / hauteur));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(n);
    return () => obs.disconnect();
  }, [vue, largeur, hauteur, notes]);

  useEffect(() => {
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* Balayage tactile : le geste n'est décidé qu'au relâché, ce qui évite de
     déclencher sur un appui tremblé. */
  const origine = useRef<{ x: number; y: number } | null>(null);
  const auRelache = (e: React.PointerEvent) => {
    const dep = origine.current;
    origine.current = null;
    if (!dep) return;
    const dx = e.clientX - dep.x;
    const dy = e.clientY - dep.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) suivant();
    else precedent();
  };

  const minuterie = `${String(Math.floor(secondes / 60)).padStart(2, "0")}:${String(secondes % 60).padStart(2, "0")}`;

  const Icone = ({
    titre,
    onClick,
    actif,
    children,
  }: {
    titre: string;
    onClick: () => void;
    actif?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      aria-pressed={actif}
      onClick={onClick}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
        actif ? "bg-white/15 text-white" : "text-white/40 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  if (!d) return null;

  return (
    <div
      ref={cadre}
      role="dialog"
      aria-modal="true"
      aria-label={`Présentation : ${doc.titre}`}
      className="fixed inset-0 z-[120] bg-[#0B1120] flex flex-col select-none"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES_RENDU }} />

      <header className="shrink-0 h-12 px-4 flex items-center gap-3 border-b border-white/10">
        <span className="flex items-center gap-1" aria-hidden>
          <span className="w-4 h-[3px] bg-ms-blue" />
          <span className="w-4 h-[3px] bg-ms-pink" />
          <span className="w-4 h-[3px] bg-ms-green" />
        </span>
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/45 truncate max-w-[40ch]">
          {doc.titre}
        </p>
        <span className="ml-auto flex items-center gap-1">
          <span className="mr-2 text-[12px] font-bold tabular-nums text-white/30">{minuterie}</span>
          <Icone titre="Vue d'ensemble — O" onClick={() => setVue((v) => (v === "scene" ? "ensemble" : "scene"))} actif={vue === "ensemble"}>
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" aria-hidden>
              <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" fill="currentColor" opacity="0.85" />
            </svg>
          </Icone>
          <Icone titre="Notes — S" onClick={() => setNotes((n) => !n)} actif={notes}>
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" aria-hidden>
              <path d="M4 4h12v12H4z M7 8h6M7 11h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Icone>
          <Icone
            titre="Plein écran — F"
            onClick={() => {
              const hd = cadre.current?.ownerDocument ?? document;
              if (hd.fullscreenElement) hd.exitFullscreen?.();
              else hd.documentElement.requestFullscreen?.();
            }}
          >
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" aria-hidden>
              <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </Icone>
          <Icone titre="Raccourcis — ?" onClick={() => setAide((a) => !a)} actif={aide}>
            <span className="text-[15px] font-black">?</span>
          </Icone>
          <button
            type="button"
            onClick={fermer}
            className="ml-2 px-3 h-9 rounded-lg text-[12px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            {ancrage ? "Revenir à l'article" : "Fermer"}
          </button>
        </span>
      </header>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {vue === "scene" ? (
            <div
              ref={hote}
              className="flex-1 min-h-0 flex items-center justify-center p-5 touch-pan-y"
              onPointerDown={(e) => (origine.current = { x: e.clientX, y: e.clientY })}
              onPointerUp={auRelache}
              onClick={(e) => {
                // Le tiers gauche recule : c'est le geste attendu, et il évite
                // de chercher des flèches sur une télécommande qu'on n'a pas.
                const r = e.currentTarget.getBoundingClientRect();
                if ((e.clientX - r.left) / r.width < 0.28) precedent();
                else suivant();
              }}
            >
              <div
                ref={morphage}
                style={{ width: largeur, height: hauteur, transform: `scale(${echelle})` }}
                className="shrink-0 origin-center rounded-xl overflow-hidden shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)]"
              >
                <RenduDiapositive d={d} doc={doc} etape={etape} graphique={graphique} />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-7">
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {diapos.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      allerA(i, true);
                      setVue("scene");
                    }}
                    className={`relative block w-full rounded-lg overflow-hidden ring-1 transition-all ${
                      i === indice ? "ring-2 ring-white" : "ring-white/10 hover:ring-white/40"
                    }`}
                    style={{ aspectRatio: `${largeur} / ${hauteur}` }}
                    aria-current={i === indice}
                  >
                    {/* La vraie diapositive, réduite — jamais une vignette
                        approximative : on choisit sur ce qu'on verra. */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 origin-top-left block pointer-events-none"
                      style={{ width: largeur, height: hauteur, transform: "scale(0.238)" }}
                    >
                      <RenduDiapositive d={x} doc={doc} graphique={graphique} />
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-bold tabular-nums text-white/75">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="shrink-0 px-4 py-2.5 flex items-center gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={precedent}
              disabled={indice === 0 && etape === 0}
              className="w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Précédent"
            >
              <svg viewBox="0 0 20 20" className="w-full h-full p-1.5" aria-hidden>
                <path d="M12 4L6 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={suivant}
              disabled={indice === diapos.length - 1 && etape >= etapes}
              className="w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Suivant"
            >
              <svg viewBox="0 0 20 20" className="w-full h-full p-1.5" aria-hidden>
                <path d="M8 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-ms-blue transition-[width] duration-300 ease-out"
                style={{ width: `${((indice + 1) / diapos.length) * 100}%` }}
              />
            </div>
            <p className="text-[12px] font-bold tabular-nums text-white/35" aria-live="polite">
              {indice + 1} / {diapos.length}
            </p>
          </footer>
        </div>

        {notes && (
          <aside className="w-[330px] shrink-0 border-l border-white/10 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 mb-2.5">Notes</p>
              {d.notes ? (
                <p className="text-[13px] leading-relaxed text-white/60 whitespace-pre-wrap">{d.notes}</p>
              ) : (
                <p className="text-[13px] text-white/25 italic">Aucune note sur cette diapositive.</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 mb-2.5">Ensuite</p>
              {diapos[indice + 1] ? (
                <div
                  className="relative w-full rounded-md overflow-hidden ring-1 ring-white/10"
                  style={{ aspectRatio: `${largeur} / ${hauteur}` }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 origin-top-left block"
                    style={{ width: largeur, height: hauteur, transform: "scale(0.228)" }}
                  >
                    <RenduDiapositive d={diapos[indice + 1]} doc={doc} graphique={graphique} />
                  </span>
                </div>
              ) : (
                <p className="text-[13px] text-white/25 italic">Dernière diapositive.</p>
              )}
            </div>
          </aside>
        )}
      </div>

      {aide && (
        <div
          className="absolute inset-0 z-10 bg-[#0B1120]/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setAide(false)}
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 max-w-md w-full">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45 mb-5">Raccourcis</p>
            <dl className="space-y-3">
              {[
                ["→ · Espace · Clic", "Avancer"],
                ["← · Retour arrière", "Reculer"],
                ["Début · Fin", "Première · dernière"],
                ["O", "Vue d'ensemble"],
                ["S", "Notes"],
                ["F", "Plein écran"],
                ["Échap", ancrage ? "Revenir à l'article" : "Fermer"],
              ].map(([t, q]) => (
                <div key={t} className="flex items-baseline gap-4">
                  <dt className="w-[42%] shrink-0 text-[12px] font-bold text-white/70">{t}</dt>
                  <dd className="text-[13px] text-white/45">{q}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default Presentateur;
