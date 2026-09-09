import { useRef } from "react";
import {
  FORMATS,
  type Degrade,
  type Diapositive,
  type Document,
  type ElForme,
  type ElGraphique,
  type ElImage,
  type ElTableau,
  type ElTexte,
  type ElVideo,
  type Element,
  type Ombre,
  cellule,
} from "@/blog/deck/modele";
import { Bouton, Champ, Liste, Saisie, Zone } from "../ui";
import ChampCouleur from "./ChampCouleur";

/**
 * ---------------------------------------------------------------------------
 * INSPECTEUR — les propriétés de ce qui est sélectionné
 * ---------------------------------------------------------------------------
 *
 * Trois états, dans cet ordre de priorité :
 *   · plusieurs éléments  → alignement, répartition, groupage, ordre de plan ;
 *   · un élément          → sa géométrie et ses propriétés propres ;
 *   · rien                → la diapositive et le document.
 *
 * C'est le fonctionnement de tous les logiciels du genre, et ce n'est pas un
 * hasard : le panneau doit répondre à « qu'est-ce que je manipule en ce
 * moment ». Un panneau à onglets fixes obligerait à chercher, à chaque geste,
 * l'endroit où se trouve le réglage voulu.
 *
 * Les listes déroulantes passent toutes par `Liste`, la liste maison du panel :
 * un `<select>` natif ne se met pas à la charte, ne se navigue pas de la même
 * façon d'un système à l'autre, et détonnait à côté du reste de l'interface.
 */

const Ligne = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-end gap-1.5 mb-3">{children}</div>
);

const Petit = ({
  label,
  valeur,
  onChange,
  suffixe,
  pas = 1,
}: {
  label: string;
  valeur: number;
  onChange: (n: number) => void;
  suffixe?: string;
  pas?: number;
}) => (
  <label className="flex-1 min-w-0">
    <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      {label}
      {suffixe && <span className="text-slate-300"> {suffixe}</span>}
    </span>
    <input
      type="number"
      step={pas}
      value={Number.isFinite(valeur) ? Math.round(valeur * 100) / 100 : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="ms-champ w-full border border-slate-300 rounded-lg px-2 py-1 text-[12px] tabular-nums text-slate-800 bg-white"
    />
  </label>
);

const Segments = <T extends string | number>({
  valeur,
  options,
  onChange,
}: {
  valeur: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) => (
  <div className="flex gap-1">
    {options.map(([v, nom]) => (
      <button
        key={String(v)}
        type="button"
        onClick={() => onChange(v)}
        aria-pressed={valeur === v}
        className={`flex-1 px-1.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
          valeur === v
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 text-slate-600 hover:border-slate-500"
        }`}
      >
        {nom}
      </button>
    ))}
  </div>
);

const Curseur = ({
  label,
  valeur,
  min,
  max,
  pas = 1,
  unite = "",
  onChange,
}: {
  label: string;
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  unite?: string;
  onChange: (n: number) => void;
}) => (
  <Champ label={`${label} — ${Math.round(valeur * (unite === "%" ? 100 : 1))}${unite ? ` ${unite}` : ""}`}>
    <input
      type="range"
      min={min}
      max={max}
      step={pas}
      value={valeur}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  </Champ>
);

/** Ombres par défaut proposées, du plus discret au plus marqué. */
const OMBRES: [string, Ombre | undefined][] = [
  ["Aucune", undefined],
  ["Douce", { x: 0, y: 10, flou: 24, couleur: "rgba(15,23,42,0.18)" }],
  ["Marquée", { x: 0, y: 20, flou: 40, couleur: "rgba(15,23,42,0.32)" }],
  ["Nette", { x: 6, y: 6, flou: 0, couleur: "rgba(15,23,42,0.85)" }],
];

const ENTREES: [string, string][] = [
  ["", "Aucune"],
  ["fondu", "Fondu"],
  ["fondu-haut", "Fondu vers le haut"],
  ["fondu-bas", "Fondu vers le bas"],
  ["glisse-gauche", "Glisse depuis la droite"],
  ["glisse-droite", "Glisse depuis la gauche"],
  ["glisse-haut", "Glisse depuis le bas"],
  ["glisse-bas", "Glisse depuis le haut"],
  ["zoom", "Zoom"],
];

const GRAISSES: [number, string][] = [
  [200, "Extra-fin"],
  [300, "Fin"],
  [400, "Normal"],
  [500, "Moyen"],
  [600, "Demi-gras"],
  [700, "Gras"],
  [800, "Extra-gras"],
  [900, "Noir"],
];

/* =========================================================================
 * INSPECTEUR
 * ======================================================================= */

export const Inspecteur = ({
  doc,
  d,
  selection,
  majDiapo,
  majDoc,
  onGrouper,
  onDegrouper,
}: {
  doc: Document;
  d: Diapositive;
  selection: string[];
  majDiapo: (f: (d: Diapositive) => Diapositive, cle?: string) => void;
  majDoc: (f: (doc: Document) => Document, cle?: string) => void;
  onGrouper: () => void;
  onDegrouper: () => void;
}) => {
  const { largeur, hauteur } = FORMATS[doc.format];
  const choisirImage = useRef<HTMLInputElement>(null);
  const choisirMedia = useRef<HTMLInputElement>(null);

  const elements = d.elements.filter((e) => selection.includes(e.id));
  const el = elements.length === 1 ? elements[0] : null;

  const patch = (p: Partial<Element>, cle?: string) =>
    majDiapo(
      (s) => ({
        ...s,
        elements: s.elements.map((x) => (selection.includes(x.id) ? ({ ...x, ...p } as Element) : x)),
      }),
      cle
    );

  /* ---------- Ordre de plan ---------- */
  const ordonner = (ou: "devant" | "derriere" | "avant" | "apres") =>
    majDiapo((s) => {
      const pris = s.elements.filter((x) => selection.includes(x.id));
      const reste = s.elements.filter((x) => !selection.includes(x.id));
      if (ou === "devant") return { ...s, elements: [...reste, ...pris] };
      if (ou === "derriere") return { ...s, elements: [...pris, ...reste] };
      const i = s.elements.findIndex((x) => x.id === pris[0]?.id);
      const j = ou === "apres" ? Math.min(i + 1, s.elements.length - 1) : Math.max(i - 1, 0);
      const copie = [...s.elements];
      const [m] = copie.splice(i, 1);
      copie.splice(j, 0, m);
      return { ...s, elements: copie };
    });

  /* ---------- Alignement ----------
     Sur la diapositive quand un seul élément est pris, sur l'ensemble quand
     plusieurs le sont. C'est le comportement attendu : aligner un bloc seul ne
     peut vouloir dire qu'« aligner sur la page ». */
  const aligner = (quoi: "gauche" | "cx" | "droite" | "haut" | "cy" | "bas") =>
    majDiapo((s) => {
      const pris = s.elements.filter((x) => selection.includes(x.id));
      if (!pris.length) return s;
      const solo = pris.length === 1;
      const x1 = solo ? 0 : Math.min(...pris.map((e) => e.x));
      const x2 = solo ? largeur : Math.max(...pris.map((e) => e.x + e.l));
      const y1 = solo ? 0 : Math.min(...pris.map((e) => e.y));
      const y2 = solo ? hauteur : Math.max(...pris.map((e) => e.y + e.h));

      return {
        ...s,
        elements: s.elements.map((e) => {
          if (!selection.includes(e.id)) return e;
          switch (quoi) {
            case "gauche":
              return { ...e, x: Math.round(x1) };
            case "cx":
              return { ...e, x: Math.round((x1 + x2) / 2 - e.l / 2) };
            case "droite":
              return { ...e, x: Math.round(x2 - e.l) };
            case "haut":
              return { ...e, y: Math.round(y1) };
            case "cy":
              return { ...e, y: Math.round((y1 + y2) / 2 - e.h / 2) };
            default:
              return { ...e, y: Math.round(y2 - e.h) };
          }
        }),
      };
    });

  const repartir = (axe: "x" | "y") =>
    majDiapo((s) => {
      const pris = s.elements.filter((x) => selection.includes(x.id));
      if (pris.length < 3) return s;
      const tri = [...pris].sort((a, b) => (axe === "x" ? a.x - b.x : a.y - b.y));
      const debut = axe === "x" ? tri[0].x : tri[0].y;
      const dernier = tri[tri.length - 1];
      const fin = axe === "x" ? dernier.x + dernier.l : dernier.y + dernier.h;
      const total = tri.reduce((n, e) => n + (axe === "x" ? e.l : e.h), 0);
      const ecart = (fin - debut - total) / (tri.length - 1);

      let curseur = debut;
      const places = new Map<string, number>();
      for (const e of tri) {
        places.set(e.id, Math.round(curseur));
        curseur += (axe === "x" ? e.l : e.h) + ecart;
      }
      return {
        ...s,
        elements: s.elements.map((e) => (places.has(e.id) ? { ...e, [axe]: places.get(e.id)! } : e)),
      };
    });

  const Disposition = (
    <>
      <Champ label="Ordre de plan">
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["derriere", "Fond"],
              ["avant", "−1"],
              ["apres", "+1"],
              ["devant", "Avant"],
            ] as const
          ).map(([k, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => ordonner(k)}
              className="px-1 py-1 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-500"
            >
              {n}
            </button>
          ))}
        </div>
      </Champ>

      <Champ label="Aligner">
        <div className="grid grid-cols-6 gap-1">
          {(
            [
              ["gauche", "⇤", "Aligner à gauche"],
              ["cx", "⇹", "Centrer horizontalement"],
              ["droite", "⇥", "Aligner à droite"],
              ["haut", "⤒", "Aligner en haut"],
              ["cy", "⇳", "Centrer verticalement"],
              ["bas", "⤓", "Aligner en bas"],
            ] as const
          ).map(([k, n, t]) => (
            <button
              key={k}
              type="button"
              title={t}
              onClick={() => aligner(k)}
              className="px-1 py-1 rounded-lg border border-slate-300 text-[13px] text-slate-600 hover:border-slate-500"
            >
              {n}
            </button>
          ))}
        </div>
      </Champ>
    </>
  );

  const Effets = el ? (
    <>
      <hr className="my-4 border-slate-200" />
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Effets</p>

      <Curseur
        label="Opacité"
        valeur={el.opacite ?? 1}
        min={0.05}
        max={1}
        pas={0.05}
        unite="%"
        onChange={(n) => patch({ opacite: n }, "fx:op")}
      />

      <Champ label="Ombre portée" aide="Suit la forme réelle — coins arrondis, ellipse, découpe d'image.">
        <Segments
          valeur={
            OMBRES.find(([, o]) => JSON.stringify(o) === JSON.stringify(el.ombre))?.[0] ??
            (el.ombre ? "Douce" : "Aucune")
          }
          options={OMBRES.map(([n]) => [n, n] as [string, string])}
          onChange={(n) => patch({ ombre: OMBRES.find(([x]) => x === n)?.[1] })}
        />
      </Champ>

      <Curseur label="Flou" valeur={el.flou ?? 0} min={0} max={40} onChange={(n) => patch({ flou: n || undefined }, "fx:flou")} />

      <Champ label="Fusion" aide="« Écran » pour un halo lumineux, « Produit » pour un duotone.">
        <Liste value={el.fusion ?? ""} onChange={(e) => patch({ fusion: e.target.value || undefined })}>
          <option value="">Normale</option>
          <option value="multiply">Produit</option>
          <option value="screen">Écran</option>
          <option value="overlay">Incrustation</option>
          <option value="difference">Différence</option>
          <option value="luminosity">Luminosité</option>
        </Liste>
      </Champ>

      <Champ label="Animation d'entrée" aide="Jouée en projection uniquement.">
        <Liste
          value={el.fx?.entree ?? ""}
          onChange={(e) =>
            patch({ fx: { ...el.fx, entree: (e.target.value || undefined) as ElTexte["fx"] extends undefined ? never : NonNullable<Element["fx"]>["entree"] } })
          }
        >
          {ENTREES.map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </Liste>
      </Champ>

      {el.fx?.entree && (
        <Ligne>
          <Petit
            label="Durée"
            suffixe="s"
            pas={0.05}
            valeur={el.fx.duree ?? 0.55}
            onChange={(n) => patch({ fx: { ...el.fx, duree: n } }, "fx:duree")}
          />
          <Petit
            label="Rang"
            valeur={el.fx.ordre ?? 0}
            onChange={(n) => patch({ fx: { ...el.fx, ordre: Math.max(0, n) } }, "fx:ordre")}
          />
        </Ligne>
      )}

      <Champ label="Apparition au clic" aide="0 = présent dès l'arrivée. 1, 2, 3… dévoilent au fil de l'exposé.">
        <Saisie
          type="number"
          min={0}
          value={String(el.etape ?? 0)}
          onChange={(e) => patch({ etape: Math.max(0, Number(e.target.value) || 0) }, "fx:etape")}
        />
      </Champ>

      <Champ label="Lien" aide="Pendant la projection, un clic saute vers cette diapositive.">
        <Liste value={el.lien ?? ""} onChange={(e) => patch({ lien: e.target.value || undefined })}>
          <option value="">Aucun</option>
          {doc.diapositives.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.nom || "Diapositive"}
            </option>
          ))}
        </Liste>
      </Champ>
    </>
  ) : null;

  /* =====================================================================
   * RIEN DE SÉLECTIONNÉ → LA DIAPOSITIVE
   * =================================================================== */

  if (!elements.length) {
    return (
      <div className="p-3">
        <p className="mb-3 text-[10.5px] leading-snug text-slate-400">
          Rien de sélectionné. Cliquez un bloc pour le modifier, ou double-cliquez un texte pour écrire
          directement dessus.
        </p>

        <Champ label="Couleur de fond">
          <ChampCouleur
            valeur={d.fond.couleur}
            theme={doc.theme}
            degrade={d.fond.degrade}
            onDegrade={(g) => majDiapo((s) => ({ ...s, fond: { ...s.fond, degrade: g } }))}
            onChange={(c) => majDiapo((s) => ({ ...s, fond: { ...s.fond, couleur: c } }))}
          />
        </Champ>

        <Champ label="Image de fond">
          <div className="flex items-center gap-2">
            <label className="ms-presse inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 cursor-pointer hover:border-slate-500">
              Choisir
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  // Lue en `data:` : le panel n'a pas encore de serveur de
                  // fichiers, et c'est aussi ce qui rend l'export autonome
                  // réellement autonome.
                  const l = new FileReader();
                  l.onload = () =>
                    majDiapo((s) => ({
                      ...s,
                      fond: { ...s.fond, image: String(l.result), voile: s.fond.voile ?? 0.45 },
                    }));
                  l.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
            </label>
            {d.fond.image && (
              <button
                type="button"
                onClick={() => majDiapo((s) => ({ ...s, fond: { couleur: s.fond.couleur } }))}
                className="text-[11px] text-slate-400 hover:text-red-600"
              >
                Retirer
              </button>
            )}
          </div>
        </Champ>

        {d.fond.image && (
          <Curseur
            label="Voile"
            valeur={d.fond.voile ?? 0}
            min={0}
            max={0.95}
            pas={0.05}
            unite="%"
            onChange={(n) => majDiapo((s) => ({ ...s, fond: { ...s.fond, voile: n } }), "fond:voile")}
          />
        )}

        <Champ label="Nom de la diapositive" aide="Sert aux liens et au rail.">
          <Saisie
            value={d.nom ?? ""}
            placeholder="Introduction"
            onChange={(e) => majDiapo((s) => ({ ...s, nom: e.target.value || undefined }), "diapo:nom")}
          />
        </Champ>

        <Champ label="Transition">
          <Liste
            value={d.transition ?? "fondu"}
            onChange={(e) => majDiapo((s) => ({ ...s, transition: e.target.value as Diapositive["transition"] }))}
          >
            <option value="aucune">Aucune</option>
            <option value="fondu">Fondu</option>
            <option value="glisse">Glissement</option>
            <option value="zoom">Zoom</option>
            <option value="morph">Morphing</option>
          </Liste>
        </Champ>

        <Champ label="Notes de l'orateur" aide="Visibles au pupitre pendant la projection, jamais à l'écran.">
          <Zone
            rows={4}
            value={d.notes}
            placeholder="Ce que vous direz sans l'écrire."
            onChange={(e) => majDiapo((s) => ({ ...s, notes: e.target.value }), "diapo:notes")}
          />
        </Champ>

        <hr className="my-4 border-slate-200" />
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Document</p>

        <Champ label="Titre">
          <Saisie value={doc.titre} onChange={(e) => majDoc((x) => ({ ...x, titre: e.target.value }), "doc:titre")} />
        </Champ>
        <Champ label="Format">
          <Liste value={doc.format} onChange={(e) => majDoc((x) => ({ ...x, format: e.target.value as Document["format"] }))}>
            {Object.keys(FORMATS).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Liste>
        </Champ>
        <Champ label="Couleurs du document" aide="Modifiables : une présentation client peut emprunter ses couleurs.">
          <div className="space-y-2">
            {(
              [
                ["encre", "Encre"],
                ["attenue", "Atténué"],
                ["fond", "Fond"],
              ] as const
            ).map(([k, nom]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[10.5px] text-slate-500">{nom}</span>
                <ChampCouleur
                  valeur={doc.theme[k]}
                  theme={doc.theme}
                  onChange={(c) => majDoc((x) => ({ ...x, theme: { ...x.theme, [k]: c } }))}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[10.5px] text-slate-500">Accents</span>
              <div className="flex gap-1.5">
                {doc.theme.accents.map((c, i) => (
                  <ChampCouleur
                    key={i}
                    valeur={c}
                    theme={doc.theme}
                    onChange={(v) =>
                      majDoc((x) => {
                        const a = [...x.theme.accents] as Document["theme"]["accents"];
                        a[i] = v;
                        return { ...x, theme: { ...x.theme, accents: a } };
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </Champ>
      </div>
    );
  }

  /* =====================================================================
   * PLUSIEURS ÉLÉMENTS
   * =================================================================== */

  if (!el) {
    const groupes = new Set(elements.map((e) => e.groupe).filter(Boolean));
    return (
      <div className="p-3">
        <p className="mb-3 text-[11.5px] font-bold text-slate-700">{elements.length} éléments sélectionnés</p>

        <Champ label="Groupe" aide="Un groupe se sélectionne et se déplace d'un bloc. Alt-clic pour atteindre un membre isolé.">
          <div className="grid grid-cols-2 gap-1">
            <Bouton variante="discret" onClick={onGrouper}>
              Grouper — Ctrl+G
            </Bouton>
            <Bouton variante="discret" onClick={onDegrouper} disabled={groupes.size === 0}>
              Dégrouper
            </Bouton>
          </div>
        </Champ>

        {Disposition}

        <Champ label="Répartir" aide="Écarts identiques. Sans effet en dessous de trois blocs.">
          <div className="grid grid-cols-2 gap-1">
            <Bouton variante="discret" onClick={() => repartir("x")} disabled={elements.length < 3}>
              Horizontalement
            </Bouton>
            <Bouton variante="discret" onClick={() => repartir("y")} disabled={elements.length < 3}>
              Verticalement
            </Bouton>
          </div>
        </Champ>

        <Champ label="Apparition au clic">
          <Saisie
            type="number"
            min={0}
            value={String(elements[0].etape ?? 0)}
            onChange={(e) => patch({ etape: Math.max(0, Number(e.target.value) || 0) })}
          />
        </Champ>
      </div>
    );
  }

  /* =====================================================================
   * UN ÉLÉMENT
   * =================================================================== */

  const degradeDe = (e: Element): Degrade | undefined =>
    e.type === "texte" || e.type === "forme" ? e.degrade : undefined;

  return (
    <div className="p-3">
      <Ligne>
        <Petit label="X" valeur={el.x} onChange={(n) => patch({ x: n }, "geo:x")} />
        <Petit label="Y" valeur={el.y} onChange={(n) => patch({ y: n }, "geo:y")} />
      </Ligne>
      <Ligne>
        <Petit label="Largeur" valeur={el.l} onChange={(n) => patch({ l: Math.max(8, n) }, "geo:l")} />
        <Petit label="Hauteur" valeur={el.h} onChange={(n) => patch({ h: Math.max(8, n) }, "geo:h")} />
        <Petit label="Rot." suffixe="°" valeur={el.rot ?? 0} onChange={(n) => patch({ rot: n }, "geo:r")} />
      </Ligne>

      {Disposition}

      {/* ---------------- TEXTE ---------------- */}
      {el.type === "texte" && (
        <>
          <Champ label="Contenu" aide="Double-cliquez le bloc sur la diapositive pour écrire dedans.">
            <Zone
              rows={3}
              value={(el as ElTexte).html.replace(/<br\s*\/?>/gi, "\n")}
              onChange={(e) => patch({ html: e.target.value.replace(/\n/g, "<br>") } as Partial<Element>, "t:html")}
            />
          </Champ>
          <Ligne>
            <Petit label="Taille" valeur={el.taille} onChange={(n) => patch({ taille: Math.max(6, n) } as Partial<Element>, "t:taille")} />
            <Petit label="Interligne" pas={0.05} valeur={el.interligne} onChange={(n) => patch({ interligne: n } as Partial<Element>, "t:il")} />
            <Petit label="Espac." pas={0.02} valeur={el.interlettre ?? 0} onChange={(n) => patch({ interlettre: n } as Partial<Element>, "t:el")} />
          </Ligne>
          <Champ label="Graisse">
            <Liste value={String(el.graisse)} onChange={(e) => patch({ graisse: Number(e.target.value) } as Partial<Element>)}>
              {GRAISSES.map(([v, n]) => (
                <option key={v} value={String(v)}>
                  {n}
                </option>
              ))}
            </Liste>
          </Champ>
          <Champ label="Police">
            <Liste value={el.police ?? "sans"} onChange={(e) => patch({ police: e.target.value } as Partial<Element>)}>
              <option value="sans">Inter Tight — texte</option>
              <option value="titrage">Poppins — titrage</option>
              <option value="mono">Chasse fixe</option>
            </Liste>
          </Champ>
          <Champ label="Alignement">
            <Segments
              valeur={el.aligne}
              options={[
                ["gauche", "⇤"],
                ["centre", "⇹"],
                ["droite", "⇥"],
              ]}
              onChange={(v) => patch({ aligne: v } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Position verticale">
            <Segments
              valeur={el.vertical ?? "haut"}
              options={[
                ["haut", "Haut"],
                ["milieu", "Milieu"],
                ["bas", "Bas"],
              ]}
              onChange={(v) => patch({ vertical: v } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Couleur">
            <ChampCouleur
              valeur={el.couleur}
              theme={doc.theme}
              degrade={degradeDe(el)}
              onDegrade={(g) => patch({ degrade: g } as Partial<Element>)}
              onChange={(c) => patch({ couleur: c } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Style">
            <div className="flex gap-1">
              {(
                [
                  ["puce", "•", "Point de liste"],
                  ["majuscules", "AA", "Majuscules"],
                  ["italique", "I", "Italique"],
                  ["souligne", "U", "Souligné"],
                ] as const
              ).map(([k, n, t]) => (
                <button
                  key={k}
                  type="button"
                  title={t}
                  onClick={() => patch({ [k]: !el[k] } as Partial<Element>)}
                  aria-pressed={!!el[k]}
                  className={`flex-1 px-2 py-1 rounded-lg border text-[12px] font-bold ${
                    k === "italique" ? "italic" : ""
                  } ${k === "souligne" ? "underline" : ""} ${
                    el[k] ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Champ>
          <Champ label="Lettres évidées" aide="Le grand mot creux d'un séparateur de partie.">
            <div className="flex items-center gap-2">
              <Segments
                valeur={el.contourTexte ? "oui" : "non"}
                options={[
                  ["non", "Pleines"],
                  ["oui", "Évidées"],
                ]}
                onChange={(v) =>
                  patch({
                    contourTexte:
                      v === "oui"
                        ? { epaisseur: 2, couleur: el.couleur, remplissage: "none" }
                        : undefined,
                  } as Partial<Element>)
                }
              />
            </div>
          </Champ>
        </>
      )}

      {/* ---------------- FORME ---------------- */}
      {el.type === "forme" && (
        <>
          <Champ label="Forme">
            <Liste value={el.forme} onChange={(e) => patch({ forme: e.target.value } as Partial<Element>)}>
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="barre">Barre arrondie</option>
              <option value="triangle">Triangle</option>
              <option value="losange">Losange</option>
              <option value="etoile">Étoile</option>
              <option value="ligne">Ligne</option>
              <option value="fleche">Flèche</option>
            </Liste>
          </Champ>
          <Champ label="Remplissage">
            <ChampCouleur
              valeur={el.remplissage}
              theme={doc.theme}
              transparent
              degrade={degradeDe(el)}
              onDegrade={(g) => patch({ degrade: g } as Partial<Element>)}
              onChange={(c) => patch({ remplissage: c } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Contour">
            <ChampCouleur
              valeur={el.contour}
              theme={doc.theme}
              transparent
              onChange={(c) => patch({ contour: c } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Trait">
            <Segments
              valeur={el.trait ?? "plein"}
              options={[
                ["plein", "Plein"],
                ["tirets", "Tirets"],
                ["points", "Points"],
              ]}
              onChange={(v) => patch({ trait: v } as Partial<Element>)}
            />
          </Champ>
          <Ligne>
            <Petit label="Épaisseur" valeur={el.epaisseur} onChange={(n) => patch({ epaisseur: Math.max(0, n) } as Partial<Element>, "f:ep")} />
            <Petit label="Arrondi" valeur={el.rayon} onChange={(n) => patch({ rayon: Math.max(0, n) } as Partial<Element>, "f:r")} />
          </Ligne>
          {(el.forme === "ligne" || el.forme === "fleche") && (
            <Ligne>
              <label className="flex-1">
                <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Début</span>
                <Liste value={el.debut ?? "aucun"} onChange={(e) => patch({ debut: e.target.value } as Partial<Element>)}>
                  <option value="aucun">Aucun</option>
                  <option value="fleche">Flèche</option>
                  <option value="point">Point</option>
                  <option value="barre">Barre</option>
                </Liste>
              </label>
              <label className="flex-1">
                <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Fin</span>
                <Liste value={el.fin ?? (el.forme === "fleche" ? "fleche" : "aucun")} onChange={(e) => patch({ fin: e.target.value } as Partial<Element>)}>
                  <option value="aucun">Aucun</option>
                  <option value="fleche">Flèche</option>
                  <option value="point">Point</option>
                  <option value="barre">Barre</option>
                </Liste>
              </label>
            </Ligne>
          )}
        </>
      )}

      {/* ---------------- IMAGE ---------------- */}
      {el.type === "image" && (
        <>
          <Champ label="Fichier">
            <div className="flex items-center gap-2">
              <Bouton variante="discret" onClick={() => choisirImage.current?.click()}>
                {(el as ElImage).src ? "Remplacer" : "Choisir une image"}
              </Bouton>
              <input
                ref={choisirImage}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const l = new FileReader();
                  l.onload = () => patch({ src: String(l.result) } as Partial<Element>);
                  l.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
              {(el as ElImage).src && (
                <button type="button" onClick={() => patch({ src: "" } as Partial<Element>)} className="text-[11px] text-slate-400 hover:text-red-600">
                  Retirer
                </button>
              )}
            </div>
          </Champ>
          <Champ label="Description" aide="Lue par les lecteurs d'écran, et reprise si la présentation devient un article.">
            <Saisie value={el.alt} onChange={(e) => patch({ alt: e.target.value } as Partial<Element>, "img:alt")} />
          </Champ>
          <Champ label="Ajustement">
            <Segments
              valeur={el.ajustement}
              options={[
                ["couvrir", "Remplir"],
                ["contenir", "Entier"],
                ["etirer", "Étirer"],
              ]}
              onChange={(v) => patch({ ajustement: v } as Partial<Element>)}
            />
          </Champ>
          <Ligne>
            <Petit label="Arrondi" valeur={el.rayon} onChange={(n) => patch({ rayon: Math.max(0, n) } as Partial<Element>, "img:r")} />
          </Ligne>
        </>
      )}

      {/* ---------------- MÉDIA ---------------- */}
      {el.type === "media" && (
        <>
          <Champ label="Nature">
            <Segments
              valeur={(el as ElVideo).nature}
              options={[
                ["video", "Vidéo"],
                ["audio", "Audio"],
              ]}
              onChange={(v) => patch({ nature: v } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Fichier" aide="Incorporé au document : à réserver aux clips courts.">
            <div className="flex items-center gap-2">
              <Bouton variante="discret" onClick={() => choisirMedia.current?.click()}>
                {el.src ? "Remplacer" : "Choisir"}
              </Bouton>
              <input
                ref={choisirMedia}
                type="file"
                accept="video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const l = new FileReader();
                  l.onload = () =>
                    patch({ src: String(l.result), nature: f.type.startsWith("audio") ? "audio" : "video" } as Partial<Element>);
                  l.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
            </div>
          </Champ>
          <Champ label="Lecture">
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["controles", "Contrôles"],
                  ["boucle", "Boucle"],
                  ["muet", "Muet"],
                  ["auto", "Automatique"],
                ] as const
              ).map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ [k]: !el[k] } as Partial<Element>)}
                  aria-pressed={!!el[k]}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
                    el[k] ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Champ>
        </>
      )}

      {/* ---------------- GRAPHIQUE ---------------- */}
      {el.type === "graphique" && (
        <>
          <Champ label="Forme">
            <Liste value={el.graphe} onChange={(e) => patch({ graphe: e.target.value } as Partial<Element>)}>
              <option value="barres">Barres</option>
              <option value="lignes">Lignes</option>
              <option value="aires">Aires</option>
              <option value="secteurs">Secteurs</option>
            </Liste>
          </Champ>
          <Champ label="Données">
            <div className="space-y-1.5">
              {(el as ElGraphique).serie.map((p, i) => (
                <div key={i} className="flex gap-1.5">
                  <Saisie
                    value={p.etiquette}
                    placeholder="Libellé"
                    onChange={(e) =>
                      patch({ serie: el.serie.map((q, j) => (j === i ? { ...q, etiquette: e.target.value } : q)) } as Partial<Element>, `g:${i}:e`)
                    }
                  />
                  <Saisie
                    type="number"
                    className="w-[32%]"
                    value={String(p.valeur)}
                    onChange={(e) =>
                      patch(
                        // Une saisie vide ne doit pas produire `NaN` : le
                        // graphique dessinerait une barre absente au lieu d'une
                        // barre à zéro, et on croirait à un bug.
                        { serie: el.serie.map((q, j) => (j === i ? { ...q, valeur: Number(e.target.value) || 0 } : q)) } as Partial<Element>,
                        `g:${i}:v`
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => patch({ serie: el.serie.filter((_, j) => j !== i) } as Partial<Element>)}
                    className="shrink-0 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Retirer ce point"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Bouton variante="discret" onClick={() => patch({ serie: [...el.serie, { etiquette: "", valeur: 0 }] } as Partial<Element>)}>
                + Ajouter un point
              </Bouton>
            </div>
          </Champ>
          <Champ label="Couleur">
            <ChampCouleur valeur={el.couleur} theme={doc.theme} onChange={(c) => patch({ couleur: c } as Partial<Element>)} />
          </Champ>
          <Champ label="Grille">
            <Segments
              valeur={el.grille ? "oui" : "non"}
              options={[
                ["oui", "Avec"],
                ["non", "Sans"],
              ]}
              onChange={(v) => patch({ grille: v === "oui" } as Partial<Element>)}
            />
          </Champ>
        </>
      )}

      {/* ---------------- TABLEAU ---------------- */}
      {el.type === "tableau" && (
        <>
          <Champ label="Cellules">
            <div className="space-y-1">
              {(el as ElTableau).lignes.map((ligne, i) => (
                <div key={i} className="flex gap-1">
                  {ligne.map((c, j) => (
                    <Saisie
                      key={j}
                      value={c.html}
                      onChange={(e) =>
                        patch(
                          {
                            lignes: el.lignes.map((r, ri) =>
                              ri === i ? r.map((v, ci) => (ci === j ? { ...v, html: e.target.value } : v)) : r
                            ),
                          } as Partial<Element>,
                          `tb:${i}:${j}`
                        )
                      }
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => patch({ lignes: el.lignes.filter((_, ri) => ri !== i) } as Partial<Element>)}
                    className="shrink-0 w-6 rounded-lg text-slate-400 hover:text-red-600"
                    aria-label="Retirer la ligne"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-1 pt-1">
                <Bouton
                  variante="discret"
                  onClick={() => patch({ lignes: [...el.lignes, el.lignes[0].map(() => cellule())] } as Partial<Element>)}
                >
                  + Ligne
                </Bouton>
                <Bouton
                  variante="discret"
                  onClick={() =>
                    patch({
                      lignes: el.lignes.map((r) => [...r, cellule()]),
                      colonnes: [...el.colonnes, { p: 1 }],
                    } as Partial<Element>)
                  }
                >
                  + Colonne
                </Bouton>
                <Bouton
                  variante="discret"
                  disabled={(el.lignes[0]?.length ?? 0) <= 1}
                  onClick={() =>
                    patch({
                      lignes: el.lignes.map((r) => r.slice(0, -1)),
                      colonnes: el.colonnes.slice(0, -1),
                    } as Partial<Element>)
                  }
                >
                  − Colonne
                </Bouton>
              </div>
            </div>
          </Champ>
          <Champ label="Première ligne en en-tête">
            <Segments
              valeur={el.entete ? "oui" : "non"}
              options={[
                ["oui", "Oui"],
                ["non", "Non"],
              ]}
              onChange={(v) => patch({ entete: v === "oui" } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Couleur d'en-tête">
            <ChampCouleur
              valeur={el.style.couleurEntete}
              theme={doc.theme}
              onChange={(c) => patch({ style: { ...el.style, couleurEntete: c } } as Partial<Element>)}
            />
          </Champ>
          <Champ label="Zébrure" aide="Teinte une ligne sur deux — utile au-delà de cinq lignes.">
            <ChampCouleur
              valeur={el.style.zebrure ?? "transparent"}
              theme={doc.theme}
              transparent
              onChange={(c) =>
                patch({ style: { ...el.style, zebrure: c === "transparent" ? undefined : c } } as Partial<Element>)
              }
            />
          </Champ>
          <Ligne>
            <Petit label="Taille" valeur={el.style.taille} onChange={(n) => patch({ style: { ...el.style, taille: Math.max(8, n) } } as Partial<Element>, "tb:tl")} />
            <Petit label="Marge X" valeur={el.style.padX} onChange={(n) => patch({ style: { ...el.style, padX: Math.max(0, n) } } as Partial<Element>, "tb:px")} />
            <Petit label="Marge Y" valeur={el.style.padY} onChange={(n) => patch({ style: { ...el.style, padY: Math.max(0, n) } } as Partial<Element>, "tb:py")} />
          </Ligne>
        </>
      )}

      {Effets}

      <div className="mt-3 flex gap-1">
        <button
          type="button"
          onClick={() => patch({ verrouille: true })}
          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-500"
          title="L'élément ne sera plus attrapable à la souris. Déverrouillez-le depuis la liste des calques."
        >
          Verrouiller
        </button>
      </div>
    </div>
  );
};

export default Inspecteur;
