import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  FABRIQUES,
  FORMATS,
  documentVide,
  dupliquerDiapositive,
  dupliquerSansMorph,
  etendreAuxGroupes,
  identifiant,
  relire,
  type Diapositive,
  type Document,
  type Element,
  type TypeElement,
} from "@/blog/deck/modele";
import { GABARITS, depuisGabarit } from "@/blog/deck/gabarits";
import { RenduDiapositive, STYLES_RENDU } from "@/blog/deck/Rendu";
import { Graphique } from "@/blog/deck/graphique";
import { documentDepuisArticle } from "@/blog/deck/depuisArticle";
import Presentateur from "@/blog/deck/Presentateur";
import { tousLesArticles } from "@/lib/blog";
import { enregistrerBrouillon } from "../publication";
import { useMenuContextuel } from "../ancre";
import { useFinFlip, useFlip } from "../flip";
import { Bouton, MenuContextuel, Pastille, type ActionMenu } from "../ui";
import { depotDecks, estConflit, stockageLocal, tracer, type Resume } from "./depot";
import { fichierAutonome, telecharger, versArticle } from "./export";
import { importerPptx, resumerPertes } from "./importPptx";
import Toile from "./Toile";
import Inspecteur from "./Inspecteur";

/**
 * ---------------------------------------------------------------------------
 * PRÉSENTATIONS — l'éditeur du panel
 * ---------------------------------------------------------------------------
 *
 * Un logiciel de présentation complet, aux couleurs du site : page blanche,
 * blocs libres, manipulation directe. Les gabarits ne sont que des raccourcis
 * pour éviter la page vide — ce qu'ils produisent est ordinaire.
 *
 * REPRIS DE BENTO : composition libre, morphing par identifiant partagé,
 * apparitions au clic, animations d'entrée, dégradés, ombres, groupes,
 * transitions, fichier autonome, document JSON lisible.
 *
 * AJOUTÉ POUR NOUS : le menu contextuel du Constructeur, l'import PowerPoint,
 * et la conversion en article — une présentation n'est pas indexable, un
 * article l'est, et c'est ce qui justifie que cet éditeur vive dans le panel.
 *
 * ÉCARTÉ : la collaboration temps réel chiffrée. Elle suppose un serveur de
 * relais ; `depot.ts` est écrit pour le jour où il existera.
 */

/* =========================================================================
 * RACCOURCIS
 * =======================================================================
 *
 * Ceux de PowerPoint et de Canva, à l'identique. On n'invente pas une
 * gestuelle : quiconque a déjà fait une présentation les connaît, et un
 * raccourci qui ne fait pas ce qu'il fait ailleurs est pire que pas de
 * raccourci du tout.
 */
const RACCOURCIS: [string, string][][] = [
  [
    ["Ctrl + Z", "Annuler"],
    ["Ctrl + Maj + Z · Ctrl + Y", "Rétablir"],
    ["Ctrl + S", "Enregistrer maintenant"],
  ],
  [
    ["Ctrl + C", "Copier"],
    ["Ctrl + X", "Couper"],
    ["Ctrl + V", "Coller"],
    ["Ctrl + D", "Dupliquer"],
    ["Ctrl + A", "Tout sélectionner"],
    ["Suppr", "Supprimer"],
  ],
  [
    ["Ctrl + G", "Grouper"],
    ["Ctrl + Maj + G", "Dégrouper"],
    ["Alt + clic", "Atteindre un membre du groupe"],
  ],
  [
    ["Flèches", "Déplacer d'une unité"],
    ["Maj + flèches", "Déplacer de dix"],
    ["Maj pendant le glissé", "Contraindre à un axe"],
    ["Maj pendant le redimensionnement", "Conserver les proportions"],
    ["Alt pendant le glissé", "Ignorer les repères"],
  ],
  [
    ["Ctrl + ]", "Avancer d'un plan"],
    ["Ctrl + [", "Reculer d'un plan"],
    ["Ctrl + Maj + ]", "Mettre au premier plan"],
    ["Ctrl + Maj + [", "Mettre à l'arrière-plan"],
  ],
  [
    ["Ctrl + M", "Nouvelle diapositive"],
    ["Ctrl + Maj + D", "Dupliquer la diapositive"],
    ["Page préc. · suiv.", "Diapositive précédente · suivante"],
  ],
  [
    ["T", "Insérer un texte"],
    ["R", "Insérer un rectangle"],
    ["O", "Insérer une ellipse"],
    ["L", "Insérer une ligne"],
    ["I", "Insérer une image"],
  ],
  [
    ["Ctrl + + · −", "Zoomer · dézoomer"],
    ["Ctrl + 0", "Ajuster à la fenêtre"],
    ["F5", "Présenter depuis le début"],
    ["Maj + F5", "Présenter depuis cette diapositive"],
    ["Échap", "Désélectionner"],
    ["?", "Cette liste"],
  ],
];

/* =========================================================================
 * HISTORIQUE
 * ======================================================================= */

const PLAFOND = 90;

/**
 * `cle` regroupe les modifications successives d'un même geste en une seule
 * étape : sans elle, annuler après avoir déplacé un bloc le ferait reculer
 * pixel par pixel, et il faudrait cent Ctrl+Z pour revenir en arrière.
 */
const useHistorique = (initial: Document) => {
  const [pile, setPile] = useState<Document[]>([initial]);
  const [curseur, setCurseur] = useState(0);
  const cle = useRef<string | null>(null);

  const appliquer = useCallback((f: (d: Document) => Document, groupe?: string) => {
    setPile((p) => {
      setCurseur((c) => {
        const suivant = f(p[c]);
        const fusion = groupe !== undefined && groupe === cle.current;
        cle.current = groupe ?? null;
        const tronquee = p.slice(0, c + 1);
        const neuve = fusion ? [...tronquee.slice(0, -1), suivant] : [...tronquee, suivant].slice(-PLAFOND);
        queueMicrotask(() => setPile(neuve));
        return fusion ? c : neuve.length - 1;
      });
      return p;
    });
  }, []);

  return {
    doc: pile[curseur] ?? pile[pile.length - 1],
    appliquer,
    remplacer: useCallback((d: Document) => {
      cle.current = null;
      setPile([d]);
      setCurseur(0);
    }, []),
    annuler: useCallback(() => {
      cle.current = null;
      setCurseur((c) => Math.max(0, c - 1));
    }, []),
    refaire: useCallback(() => {
      cle.current = null;
      setCurseur((c) => Math.min(pile.length - 1, c + 1));
    }, [pile.length]),
    peutAnnuler: curseur > 0,
    peutRefaire: curseur < pile.length - 1,
  };
};

/* =========================================================================
 * RAIL
 * ======================================================================= */

const Vignette = ({
  d,
  doc,
  rang,
  actif,
  onSelect,
  onContexte,
}: {
  d: Diapositive;
  doc: Document;
  rang: number;
  actif: boolean;
  onSelect: () => void;
  onContexte: (e: React.MouseEvent) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id });
  const { largeur, hauteur } = FORMATS[doc.format];
  const k = 0.128;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onPointerDown={onSelect}
      onContextMenu={(e) => {
        onSelect();
        onContexte(e);
      }}
      className="flex items-start gap-1.5 cursor-grab active:cursor-grabbing"
    >
      <span className="w-4 shrink-0 pt-1 text-right text-[10px] font-bold tabular-nums text-slate-400">
        {rang}
      </span>
      <span
        className={`relative block overflow-hidden rounded-md ring-1 transition-all ${
          actif ? "ring-2 ring-ms-blue" : "ring-slate-200 hover:ring-slate-400"
        } ${d.masque ? "opacity-40" : ""}`}
        style={{ width: largeur * k, height: hauteur * k, background: d.fond.couleur }}
      >
        {/* La vraie diapositive, réduite — jamais une vignette approximative :
            on réorganise un exposé en regardant ce qu'on aura à l'écran. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 origin-top-left block pointer-events-none"
          style={{ width: largeur, height: hauteur, transform: `scale(${k})` }}
        >
          <RenduDiapositive d={d} doc={doc} graphique={Graphique} />
        </span>
        {d.masque && (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-slate-600 bg-white/60">
            Masquée
          </span>
        )}
      </span>
    </div>
  );
};

/* =========================================================================
 * LA VUE
 * ======================================================================= */

const Presentations = ({ acteur = "Administrateur" }: { acteur?: string }) => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [iDiapo, setIDiapo] = useState(0);
  const [presenter, setPresenter] = useState(false);
  const [departPresentation, setDepartPresentation] = useState(0);
  const [calques, setCalques] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [menuGabarit, setMenuGabarit] = useState(false);
  const [aide, setAide] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [enSaisie, setEnSaisie] = useState(false);

  const { doc, appliquer, remplacer, annuler, refaire, peutAnnuler, peutRefaire } = useHistorique(
    documentVide(acteur)
  );

  const jeton = useRef<string>("");
  const presses = useRef<Element[]>([]);
  const capteurs = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const menu = useMenuContextuel();
  const cibleMenu = useRef<"element" | "diapositive" | "vide">("vide");

  const diapos = doc.diapositives;
  const d = diapos[Math.min(iDiapo, diapos.length - 1)];

  const rafraichir = useCallback(async () => setResumes(await depotDecks.lister()), []);
  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  /* ---------- Modifications ---------- */

  const majDoc = useCallback((f: (x: Document) => Document, cle?: string) => appliquer(f, cle), [appliquer]);

  const majDiapo = useCallback(
    (f: (s: Diapositive) => Diapositive, cle?: string) =>
      appliquer((x) => ({ ...x, diapositives: x.diapositives.map((s, i) => (i === iDiapo ? f(s) : s)) }), cle),
    [appliquer, iDiapo]
  );

  /* ---------- Enregistrement différé ---------- */
  useEffect(() => {
    if (!ouvert) return;
    const t = setTimeout(async () => {
      const r = await depotDecks.enregistrer(doc, jeton.current);
      if (estConflit(r)) {
        setMessage(
          "Cette présentation a été modifiée ailleurs depuis son ouverture. Vos changements ne sont pas enregistrés — exportez-les en JSON avant de recharger."
        );
        return;
      }
      jeton.current = r.meta.maj_le;
      void rafraichir();
    }, 700);
    return () => clearTimeout(t);
  }, [doc, ouvert, rafraichir]);

  /* ---------- Actions ---------- */

  const inserer = useCallback(
    (type: TypeElement, options: Partial<Element> = {}) => {
      const el = FABRIQUES[type](options);
      majDiapo((s) => ({ ...s, elements: [...s.elements, el] }));
      setSelection([el.id]);
    },
    [majDiapo]
  );

  const ajouterDiapo = useCallback(
    (gabarit: string) => {
      const neuve = depuisGabarit(gabarit, doc.theme);
      appliquer((x) => {
        const l = [...x.diapositives];
        // Insérée APRÈS la diapositive courante : on construit un exposé dans
        // l'ordre où on le pense.
        l.splice(iDiapo + 1, 0, neuve);
        return { ...x, diapositives: l };
      });
      setIDiapo(iDiapo + 1);
      setSelection([]);
      setMenuGabarit(false);
    },
    [appliquer, doc.theme, iDiapo]
  );

  const dupliquerDiapo = useCallback(
    (avecMorph: boolean) => {
      appliquer((x) => {
        const l = [...x.diapositives];
        l.splice(iDiapo + 1, 0, avecMorph ? dupliquerDiapositive(d) : dupliquerSansMorph(d));
        return { ...x, diapositives: l };
      });
      setIDiapo(iDiapo + 1);
    },
    [appliquer, d, iDiapo]
  );

  const supprimerDiapo = useCallback(() => {
    if (diapos.length <= 1) return;
    appliquer((x) => ({ ...x, diapositives: x.diapositives.filter((_, i) => i !== iDiapo) }));
    setIDiapo(Math.max(0, iDiapo - 1));
    setSelection([]);
  }, [appliquer, diapos.length, iDiapo]);

  const deplacerDiapo = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = diapos.findIndex((s) => s.id === active.id);
    const vers = diapos.findIndex((s) => s.id === over.id);
    appliquer((x) => ({ ...x, diapositives: arrayMove(x.diapositives, de, vers) }));
    setIDiapo(vers);
  };

  const copier = useCallback(
    (couper = false) => {
      const pris = d.elements.filter((x) => selection.includes(x.id));
      if (!pris.length) return;
      presses.current = structuredClone(pris);
      if (couper) {
        majDiapo((s) => ({ ...s, elements: s.elements.filter((x) => !selection.includes(x.id)) }));
        setSelection([]);
      }
    },
    [d.elements, selection, majDiapo]
  );

  const coller = useCallback(() => {
    if (!presses.current.length) return;
    // Décalé de vingt-quatre unités : collé exactement sur l'original, on
    // croirait que rien ne s'est passé.
    const copies = presses.current.map((x) => ({
      ...structuredClone(x),
      id: identifiant(),
      x: x.x + 24,
      y: x.y + 24,
    }));
    majDiapo((s) => ({ ...s, elements: [...s.elements, ...copies] }));
    setSelection(copies.map((x) => x.id));
  }, [majDiapo]);

  const dupliquer = useCallback(() => {
    if (!selection.length) return;
    const copies = d.elements
      .filter((x) => selection.includes(x.id))
      .map((x) => ({ ...structuredClone(x), id: identifiant(), x: x.x + 24, y: x.y + 24 }));
    majDiapo((s) => ({ ...s, elements: [...s.elements, ...copies] }));
    setSelection(copies.map((x) => x.id));
  }, [d.elements, selection, majDiapo]);

  const supprimer = useCallback(() => {
    if (!selection.length) return;
    majDiapo((s) => ({ ...s, elements: s.elements.filter((x) => !selection.includes(x.id)) }));
    setSelection([]);
  }, [selection, majDiapo]);

  const grouper = useCallback(() => {
    if (selection.length < 2) return;
    const g = identifiant("g");
    majDiapo((s) => ({
      ...s,
      elements: s.elements.map((x) => (selection.includes(x.id) ? { ...x, groupe: g } : x)),
    }));
  }, [selection, majDiapo]);

  const degrouper = useCallback(() => {
    majDiapo((s) => ({
      ...s,
      elements: s.elements.map((x) => (selection.includes(x.id) ? { ...x, groupe: undefined } : x)),
    }));
  }, [selection, majDiapo]);

  const plan = useCallback(
    (ou: "devant" | "derriere" | "avant" | "apres") =>
      majDiapo((s) => {
        const pris = s.elements.filter((x) => selection.includes(x.id));
        const reste = s.elements.filter((x) => !selection.includes(x.id));
        if (!pris.length) return s;
        if (ou === "devant") return { ...s, elements: [...reste, ...pris] };
        if (ou === "derriere") return { ...s, elements: [...pris, ...reste] };
        const i = s.elements.findIndex((x) => x.id === pris[0].id);
        const j = ou === "apres" ? Math.min(i + 1, s.elements.length - 1) : Math.max(i - 1, 0);
        const copie = [...s.elements];
        const [m] = copie.splice(i, 1);
        copie.splice(j, 0, m);
        return { ...s, elements: copie };
      }),
    [selection, majDiapo]
  );

  const projeter = useCallback(
    (depuisDebut: boolean) => {
      setDepartPresentation(depuisDebut ? 0 : iDiapo);
      setPresenter(true);
    },
    [iDiapo]
  );

  /* ---------- Raccourcis ----------
     Ceux de PowerPoint et de Canva. On ignore tout ce qui vient d'un champ de
     saisie : sinon, taper « d » dans un titre dupliquerait un bloc. */
  useEffect(() => {
    if (!ouvert || presenter) return;
    const au = (e: KeyboardEvent) => {
      const c = e.target as HTMLElement | null;
      const dansUnChamp =
        enSaisie ||
        (c && (c.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)));
      const cmd = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      // F5 et Ctrl+S restent actifs même en saisie : ce sont les seuls gestes
      // qu'on veut pouvoir faire sans quitter un champ.
      if (e.key === "F5") {
        e.preventDefault();
        return projeter(!e.shiftKey);
      }
      if (cmd && k === "s") {
        e.preventDefault();
        setMessage("Enregistré.");
        return;
      }
      if (dansUnChamp) return;

      if (cmd && k === "z") {
        e.preventDefault();
        return e.shiftKey ? refaire() : annuler();
      }
      if (cmd && k === "y") {
        e.preventDefault();
        return refaire();
      }
      if (cmd && k === "a") {
        e.preventDefault();
        return setSelection(d.elements.filter((x) => !x.verrouille && !x.masque).map((x) => x.id));
      }
      if (cmd && k === "c") return copier(false);
      if (cmd && k === "x") {
        e.preventDefault();
        return copier(true);
      }
      if (cmd && k === "v") {
        e.preventDefault();
        return coller();
      }
      if (cmd && k === "d") {
        e.preventDefault();
        return e.shiftKey ? dupliquerDiapo(true) : dupliquer();
      }
      if (cmd && k === "g") {
        e.preventDefault();
        return e.shiftKey ? degrouper() : grouper();
      }
      if (cmd && k === "m") {
        e.preventDefault();
        return ajouterDiapo("titre-contenu");
      }
      if (cmd && (e.key === "]" || e.key === "}")) {
        e.preventDefault();
        return plan(e.shiftKey ? "devant" : "apres");
      }
      if (cmd && (e.key === "[" || e.key === "{")) {
        e.preventDefault();
        return plan(e.shiftKey ? "derriere" : "avant");
      }
      if (cmd && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        return setZoom((z) => Math.min(3, (z || 0.5) + 0.1));
      }
      if (cmd && e.key === "-") {
        e.preventDefault();
        return setZoom((z) => Math.max(0.1, (z || 0.5) - 0.1));
      }
      if (cmd && e.key === "0") {
        e.preventDefault();
        return setZoom(0);
      }
      if (cmd) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selection.length) return;
        e.preventDefault();
        return supprimer();
      }
      if (e.key === "Escape") return setSelection([]);
      if (e.key === "?") return setAide((a) => !a);
      if (e.key === "PageDown") {
        e.preventDefault();
        return setIDiapo((i) => Math.min(diapos.length - 1, i + 1));
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        return setIDiapo((i) => Math.max(0, i - 1));
      }

      // Outils d'insertion à une touche, comme Canva.
      if (k === "t") return inserer("texte");
      if (k === "r") return inserer("forme", { forme: "rectangle" } as Partial<Element>);
      if (k === "o") return inserer("forme", { forme: "ellipse" } as Partial<Element>);
      if (k === "l") return inserer("forme", { forme: "ligne", epaisseur: 3 } as Partial<Element>);
      if (k === "i") return inserer("image");

      if (e.key.startsWith("Arrow")) {
        // Rien de sélectionné : les flèches parcourent les diapositives, comme
        // dans tous les logiciels du genre.
        if (!selection.length) {
          e.preventDefault();
          const sens = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
          return setIDiapo((i) => Math.min(diapos.length - 1, Math.max(0, i + sens)));
        }
        e.preventDefault();
        const pas = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowRight" ? pas : e.key === "ArrowLeft" ? -pas : 0;
        const dy = e.key === "ArrowDown" ? pas : e.key === "ArrowUp" ? -pas : 0;
        majDiapo(
          (s) => ({
            ...s,
            elements: s.elements.map((x) => (selection.includes(x.id) ? { ...x, x: x.x + dx, y: x.y + dy } : x)),
          }),
          "clavier:deplacer"
        );
      }
    };
    window.addEventListener("keydown", au);
    return () => window.removeEventListener("keydown", au);
  }, [
    ouvert, presenter, enSaisie, selection, d, diapos.length, majDiapo, annuler, refaire,
    copier, coller, dupliquer, supprimer, grouper, degrouper, plan, inserer, ajouterDiapo,
    dupliquerDiapo, projeter,
  ]);

  /* ---------- Menu contextuel ----------
     Le même composant que le Constructeur : un seul menu pour toute la vue, dont
     les entrées changent selon ce que le clic droit a désigné. */
  const actionsMenu = (): ActionMenu[] => {
    if (cibleMenu.current === "diapositive") {
      return [
        { libelle: "Nouvelle diapositive", onClick: () => ajouterDiapo("titre-contenu"), raccourci: "Ctrl+M" },
        { libelle: "Dupliquer", onClick: () => dupliquerDiapo(true), raccourci: "Ctrl+Maj+D" },
        { libelle: "Dupliquer sans morphing", onClick: () => dupliquerDiapo(false) },
        {
          libelle: d.masque ? "Réafficher dans le déroulé" : "Masquer du déroulé",
          onClick: () => majDiapo((s) => ({ ...s, masque: !s.masque })),
        },
        { libelle: "Présenter depuis ici", onClick: () => projeter(false), raccourci: "Maj+F5" },
        { libelle: "Supprimer", onClick: supprimerDiapo, danger: true, desactivee: diapos.length <= 1 },
      ];
    }

    if (cibleMenu.current === "element") {
      const pris = d.elements.filter((x) => selection.includes(x.id));
      const groupes = pris.some((x) => x.groupe);
      return [
        { libelle: "Couper", onClick: () => copier(true), raccourci: "Ctrl+X" },
        { libelle: "Copier", onClick: () => copier(false), raccourci: "Ctrl+C" },
        { libelle: "Dupliquer", onClick: dupliquer, raccourci: "Ctrl+D" },
        { libelle: "Mettre au premier plan", onClick: () => plan("devant"), raccourci: "Ctrl+Maj+]" },
        { libelle: "Avancer d'un plan", onClick: () => plan("apres"), raccourci: "Ctrl+]" },
        { libelle: "Reculer d'un plan", onClick: () => plan("avant"), raccourci: "Ctrl+[" },
        { libelle: "Mettre à l'arrière-plan", onClick: () => plan("derriere"), raccourci: "Ctrl+Maj+[" },
        {
          libelle: groupes ? "Dégrouper" : "Grouper",
          onClick: groupes ? degrouper : grouper,
          raccourci: groupes ? "Ctrl+Maj+G" : "Ctrl+G",
          desactivee: !groupes && selection.length < 2,
        },
        {
          libelle: "Verrouiller",
          onClick: () =>
            majDiapo((s) => ({
              ...s,
              elements: s.elements.map((x) => (selection.includes(x.id) ? { ...x, verrouille: true } : x)),
            })),
        },
        { libelle: "Supprimer", onClick: supprimer, danger: true, raccourci: "Suppr" },
      ];
    }

    return [
      { libelle: "Coller", onClick: coller, raccourci: "Ctrl+V", desactivee: !presses.current.length },
      { libelle: "Tout sélectionner", onClick: () => setSelection(d.elements.map((x) => x.id)), raccourci: "Ctrl+A" },
      { libelle: "Insérer un texte", onClick: () => inserer("texte"), raccourci: "T" },
      { libelle: "Insérer un rectangle", onClick: () => inserer("forme"), raccourci: "R" },
      { libelle: "Insérer une image", onClick: () => inserer("image"), raccourci: "I" },
      { libelle: "Nouvelle diapositive", onClick: () => ajouterDiapo("titre-contenu"), raccourci: "Ctrl+M" },
    ];
  };

  /* ---------- Ouvertures ---------- */

  const ouvrir = async (id: string) => {
    const x = await depotDecks.obtenir(id);
    if (!x) return setMessage("Présentation introuvable.");
    remplacer(x);
    jeton.current = x.meta.maj_le;
    setIDiapo(0);
    setSelection([]);
    setOuvert(true);
  };

  const creer = async (gabarit = "ouverture") => {
    const base = documentVide(acteur);
    const enregistre = await depotDecks.creer({ ...base, diapositives: [depuisGabarit(gabarit, base.theme)] });
    tracer(acteur, "creation", `présentation ${enregistre.id}`, enregistre.titre);
    await rafraichir();
    await ouvrir(enregistre.id);
  };

  const depuisArticle = async (slug: string) => {
    const a = tousLesArticles.find((x) => x.slug === slug);
    if (!a) return;
    const x = documentDepuisArticle({ ...a, accent: a.accent ?? "office" });
    const enregistre = await depotDecks.creer(x);
    tracer(acteur, "creation", `présentation ${enregistre.id}`, `Depuis l'article ${slug}`);
    await rafraichir();
    await ouvrir(enregistre.id);
  };

  const importerJson = (f: File) => {
    const l = new FileReader();
    l.onload = async () => {
      const x = relire(JSON.parse(String(l.result) || "{}"), acteur);
      if (!x) return setMessage("Fichier non reconnu : ce n'est pas une présentation.");
      const enregistre = await depotDecks.creer(x);
      await rafraichir();
      await ouvrir(enregistre.id);
      setMessage(`Présentation importée — ${x.diapositives.length} diapositives.`);
    };
    l.readAsText(f);
  };

  const importerPowerPoint = async (f: File) => {
    setOccupe(`Lecture de ${f.name}…`);
    try {
      const { document: x, ignores } = await importerPptx(f, acteur);
      const enregistre = await depotDecks.creer(x);
      tracer(acteur, "creation", `présentation ${enregistre.id}`, `Import PowerPoint — ${f.name}`);
      await rafraichir();
      await ouvrir(enregistre.id);
      const pertes = resumerPertes(ignores);
      setMessage(
        `« ${x.titre} » importé — ${x.diapositives.length} diapositives, toutes modifiables.` +
          (pertes ? ` ${pertes}` : "")
      );
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setOccupe(null);
    }
  };

  /* ---------- Sorties ---------- */

  const exporterHtml = async () => {
    setOccupe("Incorporation des polices et des images…");
    try {
      const html = await fichierAutonome(doc);
      telecharger(html, `${doc.meta.slug || "presentation"}.html`);
      tracer(acteur, "export", `présentation ${doc.id}`, "Fichier autonome");
      setMessage(`Fichier autonome produit — ${Math.round(html.length / 1024)} Ko, ouvrable hors ligne.`);
    } catch {
      setMessage("L'export a échoué : les ressources du site n'ont pas pu être lues.");
    } finally {
      setOccupe(null);
    }
  };

  /*
   * La troisième source d'articles : un jeu de diapositives converti en texte.
   *
   * Elle souffrait du même défaut que l'Éditeur et le Constructeur — le
   * message « Article créé » s'affichait sans attendre le dépôt. Une adresse
   * déjà prise, une session expirée ou un serveur muet donnaient donc un
   * message de succès et aucun article.
   *
   * On passe par le même point unique que les deux autres écrans : la
   * présentation devient un BROUILLON, jamais un article publié d'emblée. Une
   * conversion automatique mérite une relecture avant de partir en ligne.
   */
  const publierEnArticle = async () => {
    const { brouillon, imagesIgnorees } = versArticle(doc);
    if (!brouillon.corps.trim()) return setMessage("Rien à publier : la présentation n'a aucun texte.");

    setOccupe("Conversion de la présentation en article…");
    try {
      const r = await enregistrerBrouillon(brouillon, acteur);
      if (!r.ok) {
        setMessage(
          `L'article n'a pas été créé. ${r.message}` +
            (r.bloquants?.length ? ` (${r.bloquants.join(" · ")})` : "")
        );
        return;
      }
      setMessage(
        `Article « ${brouillon.titre} » créé en brouillon. Les graphiques sont devenus des tableaux pour rester indexables.` +
          (imagesIgnorees
            ? ` ${imagesIgnorees} image(s) incorporée(s) ont été laissées de côté : trop lourdes pour un fichier versionné, leur description a été conservée.`
            : "")
      );
    } finally {
      setOccupe(null);
    }
  };

  /* =====================================================================
   * ÉCRAN 1 — BIBLIOTHÈQUE
   * =================================================================== */

  if (!ouvert) {
    return (
      <div className="max-w-[1200px] mx-auto p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[17px] font-bold text-slate-800">Présentations</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500 max-w-2xl">
              Un logiciel de présentation à la charte du site : page blanche, blocs libres, projection en
              salle, export en un seul fichier HTML autonome — et conversion en article pour qu'un travail
              fait pour un rendez-vous finisse par être référencé.
            </p>
            {stockageLocal && (
              <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
                Les présentations vivent dans ce navigateur tant que le serveur n'est pas en service.
                Exportez le JSON pour les mettre à l'abri.
              </p>
            )}
          </div>
          <span className="flex items-center gap-2 shrink-0">
            <label className="ms-presse inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-[11.5px] font-bold text-slate-600 cursor-pointer hover:border-slate-500">
              Importer un PowerPoint
              <input
                type="file"
                accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importerPowerPoint(f);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="ms-presse inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-[11.5px] font-bold text-slate-600 cursor-pointer hover:border-slate-500">
              JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importerJson(f);
                  e.target.value = "";
                }}
              />
            </label>
            <Bouton variante="principal" onClick={() => void creer()}>
              Nouvelle présentation
            </Bouton>
          </span>
        </div>

        {(message || occupe) && (
          <p className="ms-insere mb-4 text-[12px] leading-relaxed text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-2.5">
            {occupe ?? message}
            {!occupe && (
              <button onClick={() => setMessage(null)} className="ml-2 text-slate-400 hover:text-slate-800">
                ×
              </button>
            )}
          </p>
        )}

        {resumes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center mb-8">
            <p className="text-[13px] text-slate-400">
              Aucune présentation. Créez-en une, importez un PowerPoint, ou partez d'un article ci-dessous.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {resumes.map((r) => (
              <div key={r.id} className="ms-carte overflow-hidden">
                <button
                  type="button"
                  onClick={() => void ouvrir(r.id)}
                  className="block w-full bg-slate-100"
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <span className="flex h-full items-center justify-center text-[12px] font-bold text-slate-400">
                    {r.diapositives} diapositive{r.diapositives > 1 ? "s" : ""}
                  </span>
                </button>
                <div className="p-3 border-t border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-800 truncate">{r.titre}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {r.auteur} · {new Date(r.maj_le).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {r.article && <Pastille ton="neutre">Depuis un article</Pastille>}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Supprimer « ${r.titre} » ? Cette action est définitive.`)) return;
                        await depotDecks.supprimer(r.id);
                        tracer(acteur, "suppression", `présentation ${r.id}`, r.titre);
                        void rafraichir();
                      }}
                      className="ml-auto text-[11px] text-slate-400 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="ms-carte">
          <header className="ms-carte-entete flex items-center px-3.5 h-10">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">
              Partir d'un article existant
            </h2>
          </header>
          <div className="p-3.5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {tousLesArticles.map((a) => (
              <button
                key={a.slug}
                type="button"
                onClick={() => void depuisArticle(a.slug)}
                className="ms-levier text-left p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400"
              >
                <span className="block text-[12px] font-bold text-slate-700 truncate">{a.titre}</span>
                <span className="block mt-0.5 text-[10.5px] text-slate-400">
                  {a.categorie} · {a.spec.nom}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  /* =====================================================================
   * ÉCRAN 2 — L'ÉDITEUR
   * =================================================================== */

  const Outil = ({ type, nom, chemin, options }: { type: TypeElement; nom: string; chemin: string; options?: Partial<Element> }) => (
    <button
      type="button"
      title={nom}
      onClick={() => inserer(type, options)}
      className="ms-presse w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" aria-hidden>
        <path d={chemin} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: STYLES_RENDU }} />

      {/* ---------- Barre d'outils ---------- */}
      <div className="shrink-0 h-11 px-3 flex items-center gap-2 border-b border-slate-200 bg-white">
        <Bouton
          variante="discret"
          onClick={() => {
            setOuvert(false);
            setPresenter(false);
            void rafraichir();
          }}
        >
          ← Bibliothèque
        </Bouton>

        <span className="flex items-center gap-0.5 px-2 border-x border-slate-200">
          {[
            { t: "Annuler — Ctrl+Z", d: "M7 4 3 8l4 4M3 8h7a5 5 0 0 1 0 10H8", f: annuler, on: peutAnnuler },
            { t: "Rétablir — Ctrl+Maj+Z", d: "M13 4l4 4-4 4M17 8h-7a5 5 0 0 0 0 10h2", f: refaire, on: peutRefaire },
          ].map((b) => (
            <button
              key={b.t}
              title={b.t}
              onClick={b.f}
              disabled={!b.on}
              className="ms-presse w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:pointer-events-none"
            >
              <svg viewBox="0 0 20 22" aria-hidden className="w-[17px] h-[17px]">
                <path d={b.d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </span>

        <span className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
          <Outil type="texte" nom="Texte — T" chemin="M4 5h12M10 5v11M7 16h6" />
          <Outil type="forme" nom="Forme — R" chemin="M3 4h9v9H3zM8 8h9v9H8" />
          <Outil type="image" nom="Image — I" chemin="M3 4h14v12H3zM3 13l4-4 4 4 3-3 3 3" />
          <Outil type="graphique" nom="Graphique" chemin="M4 16V9M9 16V4M14 16v-5M3 16h14" />
          <Outil type="tableau" nom="Tableau" chemin="M3 4h14v12H3zM3 8h14M8 8v8M13 8v8" />
          <Outil type="media" nom="Vidéo" chemin="M3 5h14v10H3zM8 8l5 2-5 2z" />
        </span>

        <span className="relative">
          <Bouton variante="discret" onClick={() => setMenuGabarit((m) => !m)}>
            + Diapositive
          </Bouton>
          {menuGabarit && (
            <>
              <span className="fixed inset-0 z-10" onClick={() => setMenuGabarit(false)} />
              <div className="absolute z-20 left-0 top-9 w-[268px] rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 max-h-[70vh] overflow-y-auto">
                {GABARITS.map((g) => (
                  <button
                    key={g.cle}
                    type="button"
                    onClick={() => ajouterDiapo(g.cle)}
                    className="block w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                  >
                    <span className="block text-[12px] font-bold text-slate-700">{g.nom}</span>
                    <span className="block text-[10.5px] leading-snug text-slate-400">{g.role}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </span>

        <input
          value={doc.titre}
          onChange={(e) => majDoc((x) => ({ ...x, titre: e.target.value }), "doc:titre")}
          className="ms-champ min-w-0 flex-1 max-w-[240px] border border-transparent hover:border-slate-200 focus:border-slate-300 rounded-lg px-2 py-1 text-[13px] font-bold text-slate-800 bg-transparent"
          aria-label="Titre de la présentation"
        />

        <span className="flex items-center gap-0.5 px-1 border-l border-slate-200 text-[11px] text-slate-400">
          <button
            title="Dézoomer — Ctrl+−"
            onClick={() => setZoom((z) => Math.max(0.1, (z || 0.5) - 0.1))}
            className="ms-presse w-7 h-7 rounded-lg hover:bg-slate-100 hover:text-slate-900"
          >
            −
          </button>
          <button
            title="Ajuster — Ctrl+0"
            onClick={() => setZoom(0)}
            className="ms-presse px-1.5 h-7 rounded-lg hover:bg-slate-100 hover:text-slate-900 tabular-nums"
          >
            {zoom ? `${Math.round(zoom * 100)} %` : "Ajusté"}
          </button>
          <button
            title="Zoomer — Ctrl++"
            onClick={() => setZoom((z) => Math.min(3, (z || 0.5) + 0.1))}
            className="ms-presse w-7 h-7 rounded-lg hover:bg-slate-100 hover:text-slate-900"
          >
            +
          </button>
        </span>

        <span className="ml-auto flex items-center gap-1.5">
          <button
            title="Raccourcis — ?"
            onClick={() => setAide(true)}
            className="ms-presse w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-[15px] font-black"
          >
            ?
          </button>
          <Bouton variante="discret" onClick={() => setCalques((c) => !c)}>
            Calques
          </Bouton>
          <Bouton
            variante="discret"
            onClick={() => {
              telecharger(JSON.stringify(doc, null, 2), `${doc.meta.slug || "presentation"}.json`, "application/json");
              tracer(acteur, "export", `présentation ${doc.id}`, "JSON");
            }}
          >
            JSON
          </Bouton>
          <Bouton variante="discret" onClick={() => void exporterHtml()} disabled={!!occupe}>
            {occupe ? "Export…" : "Fichier autonome"}
          </Bouton>
          <Bouton variante="neutre" disabled={!!occupe} onClick={() => void publierEnArticle()}>
            Publier en article
          </Bouton>
          <Bouton variante="principal" onClick={() => projeter(true)}>
            Présenter
          </Bouton>
        </span>
      </div>

      {(message || occupe) && (
        <p className="ms-insere shrink-0 px-3 py-2 text-[11.5px] leading-relaxed text-slate-700 bg-slate-50 border-b border-slate-200">
          {occupe ?? message}
          {!occupe && message && (
            <button onClick={() => setMessage(null)} className="ml-2 text-slate-400 hover:text-slate-800">
              ×
            </button>
          )}
        </p>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* ---------- Rail ---------- */}
        <aside className="w-[168px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
          <header className="h-9 shrink-0 flex items-center px-2.5 border-b border-slate-200 bg-white">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              {diapos.length} diapo{diapos.length > 1 ? "s" : ""}
            </span>
          </header>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={deplacerDiapo}>
              <SortableContext items={diapos.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {diapos.map((s, i) => (
                  <Vignette
                    key={s.id}
                    d={s}
                    doc={doc}
                    rang={i + 1}
                    actif={i === iDiapo}
                    onSelect={() => {
                      setIDiapo(i);
                      setSelection([]);
                    }}
                    onContexte={(e) => {
                      cibleMenu.current = "diapositive";
                      menu.ouvrir(e);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="shrink-0 p-2 border-t border-slate-200 bg-white">
            <Bouton variante="discret" onClick={() => ajouterDiapo("titre-contenu")} className="w-full justify-center">
              + Nouvelle diapositive
            </Bouton>
          </div>
        </aside>

        {/* ---------- Toile ---------- */}
        <main className="flex-1 min-w-0 bg-slate-200/70">
          <Toile
            doc={doc}
            d={d}
            selection={selection}
            setSelection={setSelection}
            majDiapo={majDiapo}
            graphique={Graphique}
            zoom={zoom}
            onEditionTexte={setEnSaisie}
            onContexte={(e, cible) => {
              cibleMenu.current = cible ? "element" : "vide";
              menu.ouvrir(e);
            }}
          />
        </main>

        {/* ---------- Calques ---------- */}
        {calques && <PanneauCalques d={d} selection={selection} setSelection={setSelection} majDiapo={majDiapo} />}

        {/* ---------- Inspecteur ---------- */}
        <aside className="w-[292px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          <Inspecteur
            doc={doc}
            d={d}
            selection={selection}
            majDiapo={majDiapo}
            majDoc={majDoc}
            onGrouper={grouper}
            onDegrouper={degrouper}
          />
        </aside>
      </div>

      {/* Un seul menu contextuel pour toute la vue : la toile et le rail
          ouvrent le même, sur la cible qu'ils désignent. */}
      <MenuContextuel ancre={menu.ancre} ouvert={menu.ouvert} onFermer={menu.fermer} actions={actionsMenu()} />

      {aide && (
        <div
          className="fixed inset-0 z-[130] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setAide(false)}
        >
          <div
            className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-800">Raccourcis clavier</h2>
              <button onClick={() => setAide(false)} className="text-slate-400 hover:text-slate-800 text-[18px]">
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
              {RACCOURCIS.map((groupe, i) => (
                <dl key={i} className="space-y-1.5">
                  {groupe.map(([touche, quoi]) => (
                    <div key={touche} className="flex items-baseline gap-3">
                      <dt className="w-[46%] shrink-0 text-[11.5px] font-mono text-slate-700">{touche}</dt>
                      <dd className="text-[12px] text-slate-500">{quoi}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </div>
        </div>
      )}

      {presenter && (
        <Presentateur
          doc={doc}
          depart={departPresentation}
          ancrage={false}
          graphique={Graphique}
          onFermer={() => setPresenter(false)}
        />
      )}
    </div>
  );
};

/* =========================================================================
 * PANNEAU DES CALQUES
 * =======================================================================
 *
 * Seul endroit d'où l'on peut reprendre un élément verrouillé : par définition,
 * il n'est plus attrapable sur la toile. Les lignes s'animent à la
 * réorganisation, avec le même mécanisme que la pile du Constructeur — après
 * un changement de plan, l'œil doit pouvoir suivre la ligne qu'il manipulait.
 */
const PanneauCalques = ({
  d,
  selection,
  setSelection,
  majDiapo,
}: {
  d: Diapositive;
  selection: string[];
  setSelection: (ids: string[]) => void;
  majDiapo: (f: (s: Diapositive) => Diapositive, cle?: string) => void;
}) => {
  const ignorer = useRef(false);
  const liste = useFlip<HTMLDivElement>(ignorer);
  useFinFlip(ignorer);

  const nom = (e: Element) => {
    if (e.type === "texte") return e.html.replace(/<[^>]*>/g, "").slice(0, 20) || "Texte";
    if (e.type === "forme") return e.forme;
    if (e.type === "media") return e.nature;
    return e.type;
  };

  return (
    <aside className="w-[196px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <header className="h-9 shrink-0 flex items-center px-2.5 border-b border-slate-200 bg-slate-50">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">Calques</span>
        <span className="ml-auto text-[10px] text-slate-400">{d.elements.length}</span>
      </header>
      <div ref={liste} className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {/* Du premier plan vers le fond, comme partout ailleurs. */}
        {[...d.elements].reverse().map((e) => (
          <div
            key={e.id}
            data-flip={e.id}
            className={`ms-levier flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[11px] ${
              selection.includes(e.id) ? "border-ms-blue bg-ms-blue/5" : "border-transparent hover:bg-slate-50"
            }`}
          >
            <button
              type="button"
              onClick={(ev) =>
                setSelection(
                  ev.shiftKey
                    ? selection.includes(e.id)
                      ? selection.filter((i) => i !== e.id)
                      : [...selection, e.id]
                    : etendreAuxGroupes(d.elements, [e.id])
                )
              }
              className="flex-1 min-w-0 text-left truncate font-semibold text-slate-600"
            >
              {nom(e)}
            </button>
            {e.groupe && <span className="shrink-0 text-[9px] text-slate-300" title="Groupé">⛓</span>}
            <button
              type="button"
              title={e.masque ? "Afficher" : "Masquer"}
              onClick={() =>
                majDiapo((s) => ({
                  ...s,
                  elements: s.elements.map((x) => (x.id === e.id ? { ...x, masque: !x.masque } : x)),
                }))
              }
              className="w-5 shrink-0 text-slate-400 hover:text-slate-800"
            >
              {e.masque ? "◌" : "●"}
            </button>
            <button
              type="button"
              title={e.verrouille ? "Déverrouiller" : "Verrouiller"}
              onClick={() =>
                majDiapo((s) => ({
                  ...s,
                  elements: s.elements.map((x) => (x.id === e.id ? { ...x, verrouille: !x.verrouille } : x)),
                }))
              }
              className="w-5 shrink-0 text-slate-400 hover:text-slate-800"
            >
              {e.verrouille ? "🔒" : "○"}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Presentations;
