import { useCallback, useEffect, useRef, useState } from "react";
import {
  FORMATS,
  etendreAuxGroupes,
  type Diapositive,
  type Document,
  type ElTexte,
  type Element,
} from "@/blog/deck/modele";
import { RenduElement, type RenduGraphique } from "@/blog/deck/Rendu";

/**
 * ---------------------------------------------------------------------------
 * LA TOILE — manipulation directe
 * ---------------------------------------------------------------------------
 *
 * C'est ici que se joue la différence entre un logiciel de présentation et un
 * générateur de diapositives : on attrape un bloc et on le pose où on veut.
 *
 * ARCHITECTURE EN DEUX COUCHES, et c'est délibéré.
 *
 *   1. Le DESSIN, rendu par `RenduElement` — le même composant que le
 *      présentateur et l'export. Il ne reçoit aucun événement.
 *   2. L'INTERACTION, une couche transparente posée exactement par-dessus, qui
 *      porte les zones de saisie, les poignées et les repères.
 *
 * L'alternative — un composant d'édition qui dessine ET écoute — aurait
 * dupliqué la mise en page. Deux dessins pour la même chose, c'est la garantie
 * qu'ils divergeront : on compose une diapositive et on en projette une autre.
 *
 * REPÈRE DE COORDONNÉES. Tout est calculé dans l'espace du document (1280×720),
 * jamais en pixels d'écran. Les positions de la souris sont divisées par
 * l'échelle avant usage. Conséquence : la composition est identique que l'on
 * édite à 40 % sur un portable ou à 90 % sur un grand écran, et un déplacement
 * ne dérive pas quand on change de zoom en cours de route.
 */

/** Distance d'accrochage, en unités du document. */
const AIMANT = 7;
/** Taille minimale d'un élément, pour qu'il reste attrapable. */
const MINI = 16;

type Poignee = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const CURSEURS: Record<Poignee, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

type Geste =
  | { quoi: "deplacer"; x0: number; y0: number; depart: Map<string, { x: number; y: number }> }
  | { quoi: "redimensionner"; poignee: Poignee; x0: number; y0: number; boite: Element }
  | { quoi: "tourner"; cx: number; cy: number; angle0: number; rot0: number }
  | { quoi: "lasso"; x0: number; y0: number; x1: number; y1: number };

type Repere = { axe: "x" | "y"; valeur: number };

export const Toile = ({
  doc,
  d,
  selection,
  setSelection,
  majDiapo,
  graphique,
  zoom = 0,
  onContexte,
  onEditionTexte,
}: {
  doc: Document;
  d: Diapositive;
  selection: string[];
  setSelection: (ids: string[]) => void;
  majDiapo: (f: (d: Diapositive) => Diapositive, cle?: string) => void;
  graphique?: RenduGraphique;
  /** 0 = ajuster à la fenêtre. Sinon, facteur d'échelle imposé. */
  zoom?: number;
  /**
   * Clic droit. Le geste attendu partout où l'on manipule des objets sur une
   * planche — PowerPoint, Canva, un explorateur de fichiers. Ne pas le proposer
   * oblige à remonter à la barre d'outils pour chaque action, alors même que la
   * main est déjà sur l'objet.
   */
  onContexte?: (e: React.MouseEvent, cible: string | null) => void;
  /** Signale au parent qu'une saisie est en cours : il suspend ses raccourcis. */
  onEditionTexte?: (enCours: boolean) => void;
}) => {
  const { largeur, hauteur } = FORMATS[doc.format];
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [ajuste, setAjuste] = useState(0.5);
  const echelle = zoom || ajuste;

  const [geste, setGeste] = useState<Geste | null>(null);
  const [reperes, setReperes] = useState<Repere[]>([]);
  const [enSaisie, setEnSaisie] = useState<string | null>(null);

  const visibles = d.elements.filter((e) => !e.masque);
  const selectionnes = visibles.filter((e) => selection.includes(e.id));

  /* ---------- Échelle d'ajustement ---------- */
  useEffect(() => {
    const n = hote.current;
    if (!n || typeof ResizeObserver === "undefined") return;
    const mesurer = () => {
      const r = n.getBoundingClientRect();
      // 48 unités de marge : sans elles, les poignées d'un élément collé au
      // bord de la diapositive tombent hors de la zone visible et deviennent
      // inattrapables.
      setAjuste(Math.min((r.width - 48) / largeur, (r.height - 48) / hauteur));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(n);
    return () => obs.disconnect();
  }, [largeur, hauteur]);

  /** Position de la souris dans le repère du document. */
  const enDocument = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = scene.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (e.clientX - r.left) / echelle, y: (e.clientY - r.top) / echelle };
    },
    [echelle]
  );

  /* =====================================================================
   * ACCROCHAGE
   * ===================================================================
   *
   * On aligne sur les bords et les centres des AUTRES éléments, plus ceux de
   * la diapositive. C'est ce qui permet d'obtenir un alignement exact à la
   * souris — sans quoi il faudrait saisir des coordonnées à la main pour que
   * deux blocs soient vraiment sur la même ligne.
   */
  const candidats = useCallback(
    (ignorer: Set<string>) => {
      const x: number[] = [0, largeur / 2, largeur];
      const y: number[] = [0, hauteur / 2, hauteur];
      for (const e of visibles) {
        if (ignorer.has(e.id)) continue;
        x.push(e.x, e.x + e.l / 2, e.x + e.l);
        y.push(e.y, e.y + e.h / 2, e.y + e.h);
      }
      return { x, y };
    },
    [visibles, largeur, hauteur]
  );

  /** Cherche l'accrochage le plus proche pour un jeu de valeurs candidates. */
  const accrocher = (valeurs: number[], cibles: number[]) => {
    let meilleur: { delta: number; ligne: number } | null = null;
    for (const v of valeurs) {
      for (const c of cibles) {
        const delta = c - v;
        if (Math.abs(delta) <= AIMANT && (!meilleur || Math.abs(delta) < Math.abs(meilleur.delta))) {
          meilleur = { delta, ligne: c };
        }
      }
    }
    return meilleur;
  };

  /* =====================================================================
   * GESTES
   * =================================================================== */

  const auDeplacement = useCallback(
    (ev: PointerEvent) => {
      if (!geste) return;
      const p = enDocument(ev);

      if (geste.quoi === "lasso") {
        setGeste({ ...geste, x1: p.x, y1: p.y });
        return;
      }

      if (geste.quoi === "deplacer") {
        let dx = p.x - geste.x0;
        let dy = p.y - geste.y0;

        // Maj contraint le déplacement à un axe : le geste le plus demandé
        // quand on aligne une colonne.
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }

        const ids = new Set(geste.depart.keys());
        const cib = candidats(ids);
        const traits: Repere[] = [];

        if (!ev.altKey) {
          const bornes = [...geste.depart.values()];
          const el0 = visibles.filter((e) => ids.has(e.id));
          const gx = Math.min(...bornes.map((b) => b.x)) + dx;
          const gy = Math.min(...bornes.map((b) => b.y)) + dy;
          const gl = Math.max(...el0.map((e, i) => bornes[i].x + e.l)) - Math.min(...bornes.map((b) => b.x));
          const gh = Math.max(...el0.map((e, i) => bornes[i].y + e.h)) - Math.min(...bornes.map((b) => b.y));

          const ax = accrocher([gx, gx + gl / 2, gx + gl], cib.x);
          const ay = accrocher([gy, gy + gh / 2, gy + gh], cib.y);
          if (ax) {
            dx += ax.delta;
            traits.push({ axe: "x", valeur: ax.ligne });
          }
          if (ay) {
            dy += ay.delta;
            traits.push({ axe: "y", valeur: ay.ligne });
          }
        }
        setReperes(traits);

        majDiapo(
          (s) => ({
            ...s,
            elements: s.elements.map((e) => {
              const dep = geste.depart.get(e.id);
              return dep ? { ...e, x: Math.round(dep.x + dx), y: Math.round(dep.y + dy) } : e;
            }),
          }),
          "toile:deplacer"
        );
        return;
      }

      if (geste.quoi === "redimensionner") {
        const b = geste.boite;
        const dx = p.x - geste.x0;
        const dy = p.y - geste.y0;
        const h = geste.poignee;

        let { x, y, l, h: ht } = b;
        if (h.includes("e")) l = b.l + dx;
        if (h.includes("s")) ht = b.h + dy;
        if (h.includes("w")) {
          l = b.l - dx;
          x = b.x + dx;
        }
        if (h.includes("n")) {
          ht = b.h - dy;
          y = b.y + dy;
        }

        // Maj conserve les proportions — indispensable sur une image, qu'un
        // redimensionnement libre déforme sans qu'on s'en rende compte tout de
        // suite.
        if (ev.shiftKey && b.l > 0 && b.h > 0 && h.length === 2) {
          const ratio = b.l / b.h;
          if (Math.abs(l - b.l) > Math.abs(ht - b.h)) ht = l / ratio;
          else l = ht * ratio;
          if (h.includes("w")) x = b.x + (b.l - l);
          if (h.includes("n")) y = b.y + (b.h - ht);
        }

        l = Math.max(MINI, l);
        ht = Math.max(MINI, ht);

        majDiapo(
          (s) => ({
            ...s,
            elements: s.elements.map((e) =>
              e.id === b.id
                ? { ...e, x: Math.round(x), y: Math.round(y), l: Math.round(l), h: Math.round(ht) }
                : e
            ),
          }),
          "toile:redimensionner"
        );
        return;
      }

      if (geste.quoi === "tourner") {
        const angle = (Math.atan2(p.y - geste.cy, p.x - geste.cx) * 180) / Math.PI;
        let rot = geste.rot0 + (angle - geste.angle0);
        // Maj crante à 15° : personne ne vise 45,000° à la souris.
        if (ev.shiftKey) rot = Math.round(rot / 15) * 15;
        majDiapo(
          (s) => ({
            ...s,
            elements: s.elements.map((e) =>
              selection.includes(e.id) ? { ...e, rot: Math.round(rot) } : e
            ),
          }),
          "toile:tourner"
        );
      }
    },
    [geste, enDocument, majDiapo, candidats, visibles, selection]
  );

  const auRelache = useCallback(() => {
    if (geste?.quoi === "lasso") {
      const x1 = Math.min(geste.x0, geste.x1);
      const x2 = Math.max(geste.x0, geste.x1);
      const y1 = Math.min(geste.y0, geste.y1);
      const y2 = Math.max(geste.y0, geste.y1);
      // Sélection par recouvrement, pas par inclusion stricte : effleurer un
      // bloc suffit à le prendre, ce qui est le comportement attendu et évite
      // d'avoir à englober exactement des éléments qui dépassent du cadre.
      const pris = visibles
        .filter((e) => !e.verrouille && e.x < x2 && e.x + e.l > x1 && e.y < y2 && e.y + e.h > y1)
        .map((e) => e.id);
      setSelection(pris);
    }
    setGeste(null);
    setReperes([]);
  }, [geste, visibles, setSelection]);

  useEffect(() => {
    if (!geste) return;
    window.addEventListener("pointermove", auDeplacement);
    window.addEventListener("pointerup", auRelache);
    return () => {
      window.removeEventListener("pointermove", auDeplacement);
      window.removeEventListener("pointerup", auRelache);
    };
  }, [geste, auDeplacement, auRelache]);

  /* =====================================================================
   * SAISIE DE TEXTE EN PLACE
   * ===================================================================
   *
   * Un `contenteditable` posé exactement sur le texte rendu, avec la même
   * typographie. On écrit là où le texte s'affichera, pas dans un champ à côté
   * — c'est ce qu'on attend d'un logiciel de présentation.
   */
  const zoneSaisie = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enSaisie) return;
    const n = zoneSaisie.current;
    if (!n) return;
    n.focus();
    // Curseur en fin de texte : le placer au début obligerait à naviguer avant
    // de pouvoir compléter une phrase, ce qui est le cas le plus courant.
    const r = document.createRange();
    r.selectNodeContents(n);
    r.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [enSaisie]);

  useEffect(() => {
    onEditionTexte?.(enSaisie !== null);
  }, [enSaisie, onEditionTexte]);

  const finSaisie = () => {
    const n = zoneSaisie.current;
    if (n && enSaisie) {
      const html = n.innerHTML;
      majDiapo(
        (s) => ({
          ...s,
          elements: s.elements.map((e) => (e.id === enSaisie ? ({ ...e, html } as Element) : e)),
        }),
        undefined
      );
    }
    setEnSaisie(null);
  };

  /* =====================================================================
   * RENDU
   * =================================================================== */

  const cadreSelection = (() => {
    if (!selectionnes.length) return null;
    const x = Math.min(...selectionnes.map((e) => e.x));
    const y = Math.min(...selectionnes.map((e) => e.y));
    const l = Math.max(...selectionnes.map((e) => e.x + e.l)) - x;
    const h = Math.max(...selectionnes.map((e) => e.y + e.h)) - y;
    return { x, y, l, h, rot: selectionnes.length === 1 ? selectionnes[0].rot ?? 0 : 0 };
  })();

  /** Épaisseur constante à l'écran quelle que soit l'échelle d'édition. */
  const px = (n: number) => n / echelle;

  return (
    <div
      ref={hote}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onPointerDown={(e) => {
        // Clic hors de la diapositive : on désélectionne. Sans cela, on ne peut
        // plus « ne rien avoir de sélectionné » sans utiliser Échap.
        if (e.target === e.currentTarget) {
          setSelection([]);
          setEnSaisie(null);
        }
      }}
    >
      <div
        ref={scene}
        style={{
          width: largeur,
          height: hauteur,
          transform: `scale(${echelle})`,
          background: d.fond.couleur || doc.theme.fond,
        }}
        className="relative shrink-0 origin-center shadow-[0_18px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/10"
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return;
          setSelection([]);
          onContexte?.(e, null);
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          setEnSaisie(null);
          if (!e.shiftKey) setSelection([]);
          const p = enDocument(e);
          setGeste({ quoi: "lasso", x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
      >
        {/* ---------- Fond ---------- */}
        {d.fond.image && (
          <>
            <img
              src={d.fond.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            {!!d.fond.voile && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: d.fond.couleur, opacity: d.fond.voile }}
              />
            )}
          </>
        )}

        {/* ---------- Couche 1 : le dessin ----------
            Exactement celui du présentateur et de l'export. Aucun événement. */}
        <div className="absolute inset-0 pointer-events-none">
          {visibles.map((e) =>
            e.id === enSaisie ? null : (
              <RenduElement key={e.id} el={e} theme={doc.theme} graphique={graphique} />
            )
          )}
        </div>

        {/* ---------- Saisie en place ---------- */}
        {enSaisie &&
          (() => {
            const el = visibles.find((x) => x.id === enSaisie) as ElTexte | undefined;
            if (!el || el.type !== "texte") return null;
            return (
              <div
                ref={zoneSaisie}
                contentEditable
                suppressContentEditableWarning
                onBlur={finSaisie}
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    finSaisie();
                  }
                  // La frappe ne doit pas remonter aux raccourcis de l'éditeur :
                  // taper « d » dans un titre ne doit pas dupliquer la diapo.
                  ev.stopPropagation();
                }}
                style={{
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: el.l,
                  height: el.h,
                  transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
                  fontFamily:
                    el.police === "titrage"
                      ? "Poppins, system-ui, sans-serif"
                      : "'Inter Tight', system-ui, sans-serif",
                  fontSize: el.taille,
                  fontWeight: el.graisse,
                  fontStyle: el.italique ? "italic" : "normal",
                  color: el.couleur,
                  textAlign: el.aligne === "centre" ? "center" : el.aligne === "droite" ? "right" : "left",
                  lineHeight: el.interligne,
                  letterSpacing: el.interlettre ? `${el.interlettre}em` : undefined,
                  textTransform: el.majuscules ? "uppercase" : "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent:
                    el.vertical === "milieu" ? "center" : el.vertical === "bas" ? "flex-end" : "flex-start",
                  outline: `${px(2)}px solid #3B82F6`,
                  outlineOffset: px(3),
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                  cursor: "text",
                }}
                dangerouslySetInnerHTML={{ __html: el.html }}
              />
            );
          })()}

        {/* ---------- Couche 2 : les zones de saisie ---------- */}
        {visibles.map((e) => {
          if (e.verrouille || e.id === enSaisie) return null;
          const actif = selection.includes(e.id);
          return (
            <div
              key={e.id}
              role="button"
              tabIndex={-1}
              aria-label={`Élément ${e.type}`}
              onContextMenu={(ev) => {
                // La sélection suit le clic droit : ouvrir un menu sur un objet
                // qui n'est pas sélectionné, puis agir « sur la sélection »,
                // agirait sur un autre objet que celui désigné.
                if (!selection.includes(e.id)) {
                  setSelection(etendreAuxGroupes(visibles, [e.id]));
                }
                onContexte?.(ev, e.id);
              }}
              onPointerDown={(ev) => {
                ev.stopPropagation();
                setEnSaisie(null);
                const dejaPris = selection.includes(e.id);
                // Alt descend jusqu'à l'élément isolé : c'est le geste standard
                // pour atteindre un membre d'un groupe sans le défaire.
                const base = ev.altKey ? [e.id] : etendreAuxGroupes(visibles, [e.id]);
                const cible = ev.shiftKey
                  ? dejaPris
                    ? selection.filter((i) => !base.includes(i))
                    : [...selection, ...base]
                  : dejaPris
                    ? selection
                    : base;
                setSelection(cible);

                const p = enDocument(ev);
                const depart = new Map<string, { x: number; y: number }>();
                for (const x of visibles) {
                  if (cible.includes(x.id) && !x.verrouille) depart.set(x.id, { x: x.x, y: x.y });
                }
                setGeste({ quoi: "deplacer", x0: p.x, y0: p.y, depart });
              }}
              onDoubleClick={(ev) => {
                ev.stopPropagation();
                if (e.type === "texte") setEnSaisie(e.id);
              }}
              style={{
                position: "absolute",
                left: e.x,
                top: e.y,
                width: e.l,
                height: e.h,
                transform: e.rot ? `rotate(${e.rot}deg)` : undefined,
                cursor: "move",
                // Un contour très discret au survol : on doit sentir qu'un bloc
                // est attrapable sans que la diapositive se couvre de cadres.
                outline: actif ? "none" : undefined,
              }}
              className={actif ? "" : "hover:outline hover:outline-1 hover:outline-ms-blue/40"}
            />
          );
        })}

        {/* ---------- Repères d'accrochage ---------- */}
        {reperes.map((r, i) => (
          <div
            key={i}
            className="absolute pointer-events-none bg-ms-pink"
            style={
              r.axe === "x"
                ? { left: r.valeur, top: 0, width: px(1), height: hauteur }
                : { top: r.valeur, left: 0, height: px(1), width: largeur }
            }
          />
        ))}

        {/* ---------- Cadre de sélection et poignées ---------- */}
        {cadreSelection && !enSaisie && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: cadreSelection.x,
              top: cadreSelection.y,
              width: cadreSelection.l,
              height: cadreSelection.h,
              transform: cadreSelection.rot ? `rotate(${cadreSelection.rot}deg)` : undefined,
              outline: `${px(1.5)}px solid #3B82F6`,
            }}
          >
            {/* Rotation : la poignée est détachée au-dessus, comme partout
                ailleurs — la confondre avec un coin rendrait le redimensionnement
                imprévisible. */}
            {selectionnes.length === 1 && (
              <div
                className="absolute pointer-events-auto rounded-full bg-white border border-ms-blue"
                style={{
                  left: cadreSelection.l / 2 - px(6),
                  top: -px(30),
                  width: px(12),
                  height: px(12),
                  cursor: "grab",
                }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  const cx = cadreSelection.x + cadreSelection.l / 2;
                  const cy = cadreSelection.y + cadreSelection.h / 2;
                  const p = enDocument(ev);
                  setGeste({
                    quoi: "tourner",
                    cx,
                    cy,
                    angle0: (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI,
                    rot0: selectionnes[0].rot ?? 0,
                  });
                }}
              />
            )}

            {selectionnes.length === 1 &&
              (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as Poignee[]).map((h) => {
                const gx = h.includes("w") ? 0 : h.includes("e") ? cadreSelection.l : cadreSelection.l / 2;
                const gy = h.includes("n") ? 0 : h.includes("s") ? cadreSelection.h : cadreSelection.h / 2;
                return (
                  <div
                    key={h}
                    className="absolute pointer-events-auto bg-white border border-ms-blue"
                    style={{
                      left: gx - px(4.5),
                      top: gy - px(4.5),
                      width: px(9),
                      height: px(9),
                      cursor: CURSEURS[h],
                      borderRadius: px(2),
                    }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      const p = enDocument(ev);
                      setGeste({
                        quoi: "redimensionner",
                        poignee: h,
                        x0: p.x,
                        y0: p.y,
                        boite: selectionnes[0],
                      });
                    }}
                  />
                );
              })}
          </div>
        )}

        {/* ---------- Lasso ---------- */}
        {geste?.quoi === "lasso" && (
          <div
            className="absolute pointer-events-none border border-ms-blue bg-ms-blue/10"
            style={{
              left: Math.min(geste.x0, geste.x1),
              top: Math.min(geste.y0, geste.y1),
              width: Math.abs(geste.x1 - geste.x0),
              height: Math.abs(geste.y1 - geste.y0),
            }}
          />
        )}
      </div>

      {/* Échelle affichée : on sait toujours à quel grossissement on compose. */}
      <span className="absolute bottom-2 right-3 text-[10.5px] font-bold tabular-nums text-slate-400">
        {Math.round(echelle * 100)} %
      </span>
    </div>
  );
};

export default Toile;
