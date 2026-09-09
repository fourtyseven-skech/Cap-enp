import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ORDRE_BIBLIOTHEQUE, REGISTRE, RenduBloc } from "@/blocs/registre";
import { IconeBloc } from "@/blocs/icones";
import { FournisseurEdition } from "@/blocs/edition";
import {
  COMPOSITIONS,
  FAMILLES,
  POSITIONS,
  PRESETS_FOND,
  RenduFond,
  RenduPile,
  calqueParDefaut,
  instancierComposition,
  parCleFond,
  type Calque,
  type Position,
} from "@/blocs/fonds";
import { identifiant, type Accent, type Bloc, type TypeBloc } from "@/blocs/types";
import CadreApercu from "./CadreApercu";
import {
  Bouton,
  Champ,
  Flottant,
  MenuActions,
  MenuContextuel,
  Onglets,
  Pastille,
  Saisie,
  type ActionMenu,
} from "./ui";
import { useAncre, useMenuContextuel } from "./ancre";
import { brouillonVide, controler, slugDepuisTitre, type Brouillon } from "./brouillon";
import { CLE_COMPOSITION, enTete, versBrouillon, versCorps } from "./composition";
import Presentateur from "@/blog/deck/Presentateur";
import { documentDepuisArticle } from "@/blog/deck/depuisArticle";
import { articles } from "./depot";
import { enregistrerBrouillon, publierArticle } from "./publication";
import { useFinFlip, useFlip } from "./flip";
import {
  TYPES_SYSTEME,
  enregistrerType,
  instancier,
  supprimerType,
  typesPersonnalises,
  type TypeArticle,
} from "./typesArticle";

const ACCENTS: { v: Accent; nom: string; c: string }[] = [
  { v: "office", nom: "Bleu Office", c: "bg-ms-blue" },
  { v: "digital", nom: "Rose Digital", c: "bg-ms-pink" },
  { v: "service", nom: "Vert Service", c: "bg-ms-green" },
];

/* ---------------------------------------------------------------------------
 * Bloc posé dans la page
 * ------------------------------------------------------------------------- */

const BlocTriable = ({
  bloc,
  actif,
  onSelect,
  onContexte,
}: {
  bloc: Bloc;
  actif: boolean;
  onSelect: () => void;
  onContexte: (e: React.MouseEvent) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloc.id,
    disabled: bloc.verrouille,
  });

  /**
   * Le bloc se saisit N'IMPORTE OÙ, et pas seulement par sa poignée : c'est le
   * geste que tout le monde tente en premier sur une planche de composition, et
   * ne pas le permettre donne l'impression que l'éditeur ne répond pas.
   *
   * Le texte reste protégé sans traitement particulier : `Edt` arrête déjà la
   * propagation du `pointerdown` pour poser le curseur sans sélectionner le
   * bloc parent. Les zones éditables ne déclenchent donc jamais de déplacement,
   * et l'on peut sélectionner un mot à la souris comme dans un traitement de
   * texte.
   */
  // Le `pointerdown` sert à DEUX choses — sélectionner et amorcer le
  // déplacement. Étalé après `onPointerDown={onSelect}`, celui de la
  // bibliothèque de tri l'aurait purement écrasé et le clic n'aurait plus rien
  // sélectionné. Les deux sont donc appelés explicitement.
  const { onPointerDown: amorcer, ...ecouteurs } = (bloc.verrouille ? {} : listeners) ?? {};

  return (
    <div
      ref={setNodeRef}
      data-flip={bloc.id}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className={`relative group ${bloc.verrouille ? "" : "cursor-grab active:cursor-grabbing"}`}
      {...(bloc.verrouille ? {} : attributes)}
      {...ecouteurs}
      onPointerDown={(e) => {
        onSelect();
        amorcer?.(e);
      }}
      onContextMenu={onContexte}
    >
      <div
        className={`ms-bloc-cadre relative rounded-lg px-6 ${
          actif
            ? bloc.verrouille
              ? "ring-2 ring-amber-400 bg-amber-50/40"
              : "ring-2 ring-ms-blue bg-ms-blue/[0.03]"
            : "ring-1 ring-transparent group-hover:ring-ms-blue/25"
        }`}
      >
        {/* Un bloc verrouillé rend son texte en lecture seule : le contexte
            d'édition est coupé pour lui seul, le reste de la page continue
            d'être modifiable. */}
        {bloc.verrouille ? (
          <FournisseurEdition value={{ actif: false, modifier: () => {} }}>
            <RenduBloc bloc={bloc} />
          </FournisseurEdition>
        ) : (
          <RenduBloc bloc={bloc} />
        )}
      </div>

      {/* Repère de saisie — outillage d'édition, absent de la page publiée. Il
          ne surgit pas : il sort du bord gauche du bloc. */}
      <span
        title={bloc.verrouille ? "Bloc verrouillé" : "Glisser pour déplacer"}
        data-visible={actif ? "1" : "0"}
        className={`ms-poignee absolute -left-1 top-1/2 w-6 h-10 rounded-md text-white text-[13px] flex items-center justify-center pointer-events-none ${
          bloc.verrouille
            ? "bg-amber-500 shadow-[0_4px_12px_-4px_rgba(245,158,11,0.8)]"
            : "bg-ms-blue shadow-[0_4px_12px_-4px_rgba(59,130,246,0.8)]"
        }`}
      >
        {bloc.verrouille ? "🔒" : "⠿"}
      </span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Bibliothèque
 * ------------------------------------------------------------------------- */

const ItemBibliotheque = ({ type, onAjouter }: { type: TypeBloc; onAjouter: () => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib_${type}`,
    data: { source: "bibliotheque", type },
  });
  const def = REGISTRE[type];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAjouter}
      title="Glisser dans la page, ou cliquer pour ajouter à la fin"
      className={`ms-levier group/item flex gap-2.5 cursor-grab active:cursor-grabbing rounded-lg border p-2.5 bg-white hover:border-ms-blue ${
        isDragging ? "opacity-40 border-ms-blue" : "border-slate-200"
      }`}
    >
      {/* La pastille d'icône prend la couleur du pôle au survol : c'est le seul
          endroit où le composant se colore avant d'être posé. */}
      <span className="shrink-0 w-8 h-8 rounded-md bg-slate-50 border border-slate-200 p-1.5 text-slate-700 transition-colors duration-150 group-hover/item:bg-ms-blue/10 group-hover/item:border-ms-blue/30 group-hover/item:text-ms-blue">
        <IconeBloc type={type} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-slate-800 leading-tight">{def.nom}</span>
        <span className="block text-[10px] leading-snug text-slate-500 mt-0.5">{def.role}</span>
      </span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Ligne de la liste des calques
 * ---------------------------------------------------------------------------
 * Réordonner à la souris DEPUIS LA LISTE est le geste central de PowerPoint et
 * de Canva. Il est bien plus sûr que la poignée posée sur la page : les lignes
 * sont courtes, régulières, toujours visibles — alors que sur la planche, deux
 * blocs dupliqués se ressemblent trait pour trait et la cible est mouvante.
 *
 * Le préfixe d'identifiant est indispensable : le même bloc est glissable à
 * deux endroits, et dnd-kit exige des identifiants uniques par contexte.
 * ------------------------------------------------------------------------- */

const PREFIXE_CALQUE = "cal_";
/** Cible de dépôt couvrant toute la colonne de composition. */
const ZONE_PAGE = "zone_page";

/**
 * Colonne de composition, receveuse d'un dépôt.
 *
 * Sans elle, seul un bloc déjà posé pouvait recevoir un composant : lâcher dans
 * le vide sous le dernier bloc ne produisait rien, et le geste semblait avoir
 * échoué alors qu'il n'avait simplement pas de destinataire.
 */
const ZonePage = ({ actif, children }: { actif: boolean; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: ZONE_PAGE });
  return (
    <div
      ref={setNodeRef}
      data-actif={actif && isOver ? "1" : "0"}
      className="ms-depot relative z-10 mx-auto max-w-3xl px-4 py-10 min-h-[60vh] rounded-xl"
    >
      {children}
    </div>
  );
};

/** Œil et cadenas — dessinés plutôt qu'en emoji, dont le rendu varie trop. */
const IconeOeil = ({ ouvert }: { ouvert: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden className="w-3.5 h-3.5">
    <path
      d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    {!ouvert && <path d="M2.5 13.5 13.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
  </svg>
);

const IconeCadenas = ({ ferme }: { ferme: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden className="w-3.5 h-3.5">
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path
      d={ferme ? "M5.5 7V5a2.5 2.5 0 0 1 5 0v2" : "M5.5 7V5a2.5 2.5 0 0 1 5 0"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const LigneCalque = ({
  bloc,
  rang,
  actif,
  onSelect,
  onContexte,
  onBasculerMasque,
  onBasculerVerrou,
  actions,
}: {
  bloc: Bloc;
  rang: number;
  actif: boolean;
  onSelect: () => void;
  onContexte: (e: React.MouseEvent) => void;
  onBasculerMasque: () => void;
  onBasculerVerrou: () => void;
  actions: ActionMenu[];
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${PREFIXE_CALQUE}${bloc.id}`,
    disabled: bloc.verrouille,
  });

  return (
    <div
      ref={setNodeRef}
      data-flip={`cal-${bloc.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      onContextMenu={onContexte}
      className={`group/ligne flex items-center gap-1 rounded-lg border px-1 py-1.5 cursor-pointer transition-colors duration-150 ${
        isDragging
          ? "border-ms-blue bg-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.4)] opacity-90"
          : actif
            ? "border-ms-blue bg-ms-blue/5 shadow-[0_2px_10px_-4px_rgba(59,130,246,0.6)]"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      } ${bloc.masque ? "opacity-55" : ""}`}
    >
      {/* Poignée dédiée : sans elle, un clic destiné à sélectionner déclenche un
          déplacement d'un pixel et la ligne se réordonne par accident. */}
      <span
        {...(bloc.verrouille ? {} : attributes)}
        {...(bloc.verrouille ? {} : listeners)}
        title={bloc.verrouille ? "Calque verrouillé" : "Glisser pour réordonner"}
        onClick={(e) => e.stopPropagation()}
        className={`shrink-0 w-4 h-6 flex items-center justify-center rounded text-[11px] leading-none ${
          bloc.verrouille
            ? "text-slate-200 cursor-not-allowed"
            : "text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing"
        }`}
      >
        ⠿
      </span>
      <span className="shrink-0 w-4 text-[9px] font-mono text-slate-300 tabular-nums">{rang}</span>
      <span className={`shrink-0 w-5 h-5 ${bloc.masque ? "text-slate-300" : "text-slate-500"}`}>
        <IconeBloc type={bloc.type} />
      </span>
      <span
        className={`flex-1 min-w-0 truncate text-[11.5px] font-semibold ${
          bloc.masque ? "text-slate-400 line-through decoration-slate-300" : "text-slate-700"
        }`}
      >
        {REGISTRE[bloc.type].nom}
      </span>

      {/* Les deux interrupteurs restent visibles dès qu'ils sont ACTIFS : un
          calque masqué ou verrouillé doit se voir sans survoler la ligne,
          sinon on cherche pourquoi la page ne réagit pas. */}
      {[
        {
          cle: "masque",
          on: !!bloc.masque,
          f: onBasculerMasque,
          t: bloc.masque ? "Afficher dans la page" : "Masquer dans la page",
          icone: <IconeOeil ouvert={!bloc.masque} />,
          couleur: "text-slate-500",
        },
        {
          cle: "verrou",
          on: !!bloc.verrouille,
          f: onBasculerVerrou,
          t: bloc.verrouille ? "Déverrouiller" : "Verrouiller — ni déplaçable ni modifiable",
          icone: <IconeCadenas ferme={!!bloc.verrouille} />,
          couleur: "text-amber-600",
        },
      ].map((b) => (
        <button
          key={b.cle}
          title={b.t}
          onClick={(e) => {
            e.stopPropagation();
            b.f();
          }}
          className={`shrink-0 w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:bg-slate-100 ${
            b.on ? `${b.couleur} opacity-100` : "text-slate-300 opacity-0 group-hover/ligne:opacity-100 hover:text-slate-600"
          }`}
        >
          {b.icone}
        </button>
      ))}

      <MenuActions actions={actions} titre="Actions du calque" />
    </div>
  );
};

/** Section repliable de la bibliothèque. Fermée par défaut. */
const Section = ({
  titre,
  compte,
  ouvert,
  onToggle,
  children,
}: {
  titre: string;
  compte: number;
  ouvert: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => {
  /**
   * Le contenu n'est monté qu'à la première ouverture, puis conservé. Monter
   * les neuf sections d'emblée ferait rendre plusieurs dizaines de vignettes
   * SVG que personne ne regarde ; le démonter à la fermeture viderait le
   * panneau AVANT que le repli ne se joue, et l'animation se refermerait sur
   * du vide.
   */
  const [monte, setMonte] = useState(ouvert);
  useEffect(() => {
    if (ouvert) setMonte(true);
  }, [ouvert]);

  return (
  <div className="border-b border-slate-200 last:border-b-0">
    <button
      onClick={onToggle}
      aria-expanded={ouvert}
      className="w-full flex items-center gap-2 py-2.5 text-left group"
    >
      {/* Un seul signe, qui PIVOTE : la croix devient le trait du moins. Deux
          caractères échangés donneraient la même information sans montrer que
          c'est le même bouton qui a changé d'état. */}
      <span
        className={`shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors duration-150 ${
          ouvert
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-white border-slate-300 text-slate-500 group-hover:border-slate-900 group-hover:text-slate-900"
        }`}
      >
        <svg viewBox="0 0 12 12" aria-hidden className="w-2.5 h-2.5">
          <line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line
            x1="6"
            y1="1.5"
            x2="6"
            y2="10.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="origin-center transition-transform duration-260 ease-sortie"
            style={{ transform: ouvert ? "rotate(90deg) scaleX(0)" : "none" }}
          />
        </svg>
      </span>
      <span
        className={`flex-1 text-[10.5px] font-bold uppercase tracking-wide transition-colors duration-150 ${
          ouvert ? "text-slate-900" : "text-slate-600"
        }`}
      >
        {titre}
      </span>
      <span className="text-[9.5px] font-mono text-slate-400">{compte}</span>
    </button>
    {/* Repli animé : la hauteur se déduit du contenu, rien n'est mesuré ni
        codé en dur (voir `.ms-repli` dans admin.css). */}
    <div className="ms-repli" data-ouvert={ouvert ? "1" : "0"}>
      <div>
        <div className="pb-3">{monte && children}</div>
      </div>
    </div>
  </div>
  );
};

/** Sélecteur de position — neuf ancres, façon table de composition. */
const Positions = ({
  valeur,
  onChange,
  actif,
}: {
  valeur: Position;
  onChange: (p: Position) => void;
  actif: boolean;
}) => (
  <div className={`grid grid-cols-3 gap-0.5 w-[74px] shrink-0 ${actif ? "" : "opacity-30 pointer-events-none"}`}>
    {POSITIONS.map((p) => (
      <button
        key={p}
        title={p.replace("-", " ")}
        onClick={() => onChange(p)}
        className={`h-6 rounded border transition-colors duration-150 ${
          valeur === p ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <span
          className={`block w-1.5 h-1.5 mx-auto rounded-full transition-all duration-200 ease-ressort ${
            valeur === p ? "bg-white scale-125" : "bg-slate-300 scale-100"
          }`}
        />
      </button>
    ))}
  </div>
);

/* ---------------------------------------------------------------------------
 * Constructeur
 * ------------------------------------------------------------------------- */

type Onglet = "composants" | "calques" | "design" | "types";
const LARGEURS = { bureau: "100%" as const, tablette: 768, mobile: 390 };

/* ---------------------------------------------------------------------------
 * Document et historique
 * ---------------------------------------------------------------------------
 * Les blocs et la pile de fond forment UN document, pas deux états séparés.
 * C'est ce qui permet à l'annulation de fonctionner comme partout ailleurs :
 * Ctrl+Z revient au geste précédent, quel qu'il ait été — un bloc déplacé, un
 * calque empilé, une couleur changée.
 *
 * Sans annulation, la moindre fausse manœuvre — un composant supprimé d'un
 * clic, une pile vidée par erreur — se paie en recomposition manuelle. C'est le
 * défaut qui rend un éditeur pénible à utiliser bien avant qu'il ne soit
 * incomplet.
 *
 * Le stockage reste celui du navigateur, comme le reste du panel : la
 * composition survit à un rechargement de page, mais pas à un changement de
 * poste. Le jour du serveur, seules ces deux fonctions de lecture et d'écriture
 * changent.
 * ------------------------------------------------------------------------- */

type Doc = { blocs: Bloc[]; pile: Calque[] };

/** Au-delà, on oublie les gestes les plus anciens : soixante retours arrière
 *  couvrent très largement une séance de composition. */
const PLAFOND_HISTORIQUE = 60;
/** Deux frappes séparées de moins de 700 ms comptent pour un seul geste. */
const FUSION_MS = 700;

const docNeuf = (): Doc => ({
  blocs: instancier(TYPES_SYSTEME[0]),
  pile: [{ ...calqueParDefaut("aurore", "office"), position: "haut-droite" }],
});

const docInitial = (): Doc => {
  try {
    const brut = localStorage.getItem(CLE_COMPOSITION);
    if (brut) {
      const d = JSON.parse(brut) as Doc;
      if (Array.isArray(d?.blocs) && Array.isArray(d?.pile)) return d;
    }
  } catch {
    /* stockage indisponible ou contenu illisible — on repart d'un document neuf */
  }
  return docNeuf();
};

const useHistorique = () => {
  const [h, setH] = useState<{ etats: Doc[]; curseur: number }>(() => ({
    etats: [docInitial()],
    curseur: 0,
  }));
  /** Dernier geste enregistré, pour savoir s'il faut fusionner avec lui. */
  const fusion = useRef<{ cle: string; instant: number } | null>(null);

  const doc = h.etats[h.curseur];

  /**
   * Applique une transformation au document. `cle` regroupe les gestes
   * consécutifs de même nature : sans elle, chaque caractère tapé dans un bloc
   * occuperait une entrée d'historique et Ctrl+Z rendrait les lettres une par
   * une au lieu de rendre la phrase.
   */
  const appliquer = useCallback((f: (d: Doc) => Doc, cle?: string) => {
    setH((prev) => {
      const courant = prev.etats[prev.curseur];
      const suivant = f(courant);
      if (suivant === courant) return prev;

      const maintenant = Date.now();
      const fusionner =
        cle !== undefined && fusion.current?.cle === cle && maintenant - fusion.current.instant < FUSION_MS;
      fusion.current = cle === undefined ? null : { cle, instant: maintenant };

      // Toute action après une annulation coupe la branche « refaire » : c'est
      // le comportement de tous les éditeurs, et le seul qui reste prévisible.
      const base = prev.etats.slice(0, fusionner ? prev.curseur : prev.curseur + 1);
      const etats = [...base, suivant].slice(-PLAFOND_HISTORIQUE);
      return { etats, curseur: etats.length - 1 };
    });
  }, []);

  const annuler = useCallback(() => {
    fusion.current = null;
    setH((p) => (p.curseur > 0 ? { ...p, curseur: p.curseur - 1 } : p));
  }, []);

  const refaire = useCallback(() => {
    fusion.current = null;
    setH((p) => (p.curseur < p.etats.length - 1 ? { ...p, curseur: p.curseur + 1 } : p));
  }, []);

  return {
    doc,
    appliquer,
    annuler,
    refaire,
    peutAnnuler: h.curseur > 0,
    peutRefaire: h.curseur < h.etats.length - 1,
  };
};

/* ---------------------------------------------------------------------------
 * Mise en ligne depuis le constructeur
 * ---------------------------------------------------------------------------
 * Il manquait la sortie : on composait une page entière sans pouvoir en faire
 * un article. La composition est traduite en Markdown (voir `composition.ts`),
 * puis suit exactement le même chemin qu'un article écrit dans l'éditeur —
 * mêmes contrôles, même dépôt, même historique de versions.
 * ------------------------------------------------------------------------- */

const Publication = ({ blocs, acteur }: { blocs: Bloc[]; acteur: string }) => {
  const bouton = useRef<HTMLButtonElement>(null);
  const { ancre, ouvert, basculer, fermer } = useAncre();

  const [slug, setSlug] = useState("");
  const [slugTouche, setSlugTouche] = useState(false);
  const [fait, setFait] = useState<Brouillon["statut"] | null>(null);
  /* Le refus du dépôt, affiché dans le panneau plutôt que nulle part. */
  const [echec, setEchec] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const tete = enTete(blocs);
  const adresse = (slugTouche ? slug : slugDepuisTitre(tete.titre)).trim();

  // Base : l'article existant à cette adresse, sinon un brouillon neuf. C'est
  // ce qui préserve le référencement et les questions fréquentes quand on
  // recompose une page déjà en ligne.
  const projet = useMemo<Brouillon>(() => {
    const existant = adresse ? articles.obtenir(adresse) : undefined;
    return versBrouillon(blocs, { ...(existant ?? brouillonVide()), slug: adresse });
  }, [blocs, adresse]);

  const controles = useMemo(() => controler(projet), [projet]);
  const bloquants = controles.filter((c) => c.bloquant && !c.ok);
  const existant = adresse ? articles.obtenir(adresse) : undefined;

  /*
   * Même correction que dans l'Éditeur, et pour la même raison : le panneau se
   * fermait sur « Publié » sans avoir attendu le dépôt. Un refus laissait donc
   * l'utilisateur devant une liste d'articles inchangée, sans explication.
   *
   * On ne ferme plus qu'après un succès confirmé.
   */
  const enregistrer = async (statut: Brouillon["statut"]) => {
    setEchec(null);
    setEnvoi(true);
    try {
      const r =
        statut === "publie"
          ? await publierArticle(projet, acteur)
          : await enregistrerBrouillon(projet, acteur);

      if (!r.ok) {
        setEchec(
          r.bloquants?.length ? `${r.message} ${r.bloquants.join(" · ")}` : r.message
        );
        return;
      }

      setFait(r.statut);
      setTimeout(() => {
        setFait(null);
        fermer();
      }, 1400);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <Bouton
        ref={bouton}
        variante="principal"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          basculer(bouton.current);
        }}
      >
        Enregistrer / Publier
      </Bouton>

      <Flottant
        ancre={ancre}
        ouvert={ouvert}
        onFermer={fermer}
        declencheur={bouton}
        alignement="droite"
        classe="w-[340px] p-3"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
          {existant ? "Mettre à jour un article" : "Créer l'article"}
        </p>

        {/* Le titre n'est pas saisi ici : il est LU dans la page. Deux endroits
            où écrire le même titre finissent toujours par diverger. */}
        <Champ label="Titre" aide="Repris du bloc d'accroche. Modifiez-le directement dans la page.">
          <Saisie
            value={tete.titre}
            readOnly
            placeholder="Aucun bloc d'accroche"
            className="bg-slate-50 text-slate-500"
          />
        </Champ>

        {!tete.titre && (
          <p className="-mt-1 mb-3 p-2 rounded-lg border border-amber-200 bg-amber-50 text-[10.5px] leading-snug text-amber-900">
            Ajoutez un bloc <strong>Accroche</strong> en tête de page : c'est lui qui porte le titre, le chapeau
            et la rubrique de l'article.
          </p>
        )}

        <Champ
          label="Adresse de la page"
          aide={
            existant
              ? "Un article existe déjà à cette adresse : il sera remplacé par cette composition."
              : "Déduite du titre. Elle ne doit plus changer après publication."
          }
        >
          <Saisie
            value={adresse}
            onChange={(e) => {
              setSlugTouche(true);
              setSlug(e.target.value);
            }}
            className="font-mono text-[12px]"
            placeholder="mon-article"
          />
        </Champ>

        {bloquants.length > 0 && (
          <div className="mb-3 p-2 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-[10.5px] font-semibold text-amber-900 mb-1">
              {bloquants.length} contrôle{bloquants.length > 1 ? "s" : ""} à lever avant publication
            </p>
            <ul className="space-y-0.5">
              {bloquants.slice(0, 4).map((c) => (
                <li key={c.libelle} className="text-[10px] leading-snug text-amber-800">
                  · {c.libelle}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] leading-snug text-amber-700">
              Le brouillon, lui, s'enregistre dès maintenant — complétez le reste dans l'éditeur Markdown.
            </p>
          </div>
        )}

        {echec && (
          <p className="ms-insere mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[10.5px] leading-snug text-red-800">
            Rien n'a été publié. {echec}
          </p>
        )}

        <div className="flex gap-2">
          <Bouton
            variante="neutre"
            className="flex-1 justify-center"
            disabled={envoi || !adresse || !tete.titre}
            onClick={() => void enregistrer("brouillon")}
          >
            {fait === "brouillon" ? "Mis de côté" : "Brouillon"}
          </Bouton>
          <Bouton
            variante="principal"
            className="flex-1 justify-center"
            disabled={envoi || !adresse || bloquants.length > 0}
            onClick={() => void enregistrer("publie")}
          >
            {envoi ? "Envoi…" : fait === "publie" ? "Publié" : "Publier"}
          </Bouton>
        </div>

        <p className="mt-2 text-[9.5px] leading-snug text-slate-400">
          La composition devient du Markdown ordinaire, relisible et corrigeable dans l'éditeur. La conversion
          ne se fait que dans ce sens : rouvrir l'article n'y reconstitue pas les blocs.
        </p>
      </Flottant>
    </>
  );
};

const Constructeur = ({ acteur = "Administrateur" }: { acteur?: string }) => {
  const { doc, appliquer, annuler, refaire, peutAnnuler, peutRefaire } = useHistorique();
  const { blocs, pile } = doc;

  const majBlocs = useCallback(
    (f: (b: Bloc[]) => Bloc[], cle?: string) => appliquer((d) => ({ ...d, blocs: f(d.blocs) }), cle),
    [appliquer]
  );
  const majPile = useCallback(
    (f: (p: Calque[]) => Calque[], cle?: string) => appliquer((d) => ({ ...d, pile: f(d.pile) }), cle),
    [appliquer]
  );

  /* Sauvegarde différée : écrire à chaque frappe solliciterait le stockage des
     dizaines de fois par phrase, sans rien apporter. */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CLE_COMPOSITION, JSON.stringify(doc));
      } catch {
        /* quota atteint — la composition reste vivante pour la session */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [doc]);

  const [selection, setSelection] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("composants");
  const [appareil, setAppareil] = useState<keyof typeof LARGEURS>("bureau");
  /**
   * Aperçu en diaporama de la composition en cours.
   *
   * Le deck est reconstruit à l'ouverture depuis le Markdown que produirait une
   * publication — pas depuis les blocs. C'est le point important : on juge la
   * présentation sur ce que l'article DEVIENDRA une fois enregistré, jamais sur
   * un état intermédiaire qui n'existera nulle part ailleurs. Un écart entre
   * l'aperçu et le résultat serait pire que pas d'aperçu du tout.
   */
  const [diapoOuvert, setDiapoOuvert] = useState(false);
  const [calqueActif, setCalqueActif] = useState<string | null>(null);
  /** Calque tout juste ajouté — surligné brièvement pour qu'on le repère. */
  const [calqueNeuf, setCalqueNeuf] = useState<string | null>(null);
  /**
   * Sections dépliées de la bibliothèque. Tout est REPLIÉ au départ : neuf
   * sections ouvertes simultanément noyaient l'écran et rendaient le choix
   * impossible. On ouvre ce qu'on cherche, une section à la fois.
   */
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const basculer = (cle: string) => setOuvertes((o) => ({ ...o, [cle]: !o[cle] }));
  const [perso, setPerso] = useState<TypeArticle[]>([]);
  const [enGlissement, setEnGlissement] = useState<string | null>(null);
  const [nomType, setNomType] = useState("");

  useEffect(() => setPerso(typesPersonnalises()), []);

  /* Les calques masqués sortent de la page mais restent dans la composition —
     c'est toute la différence avec une suppression. */
  const visibles = useMemo(() => blocs.filter((b) => !b.masque), [blocs]);

  /**
   * Repositionnement animé de la page et de la liste des calques.
   *
   * `ignorerFlip` neutralise l'animation le temps d'un rendu à la fin d'un
   * glisser-déposer : la bibliothèque de tri anime déjà le retour à la place, et
   * les deux mouvements se combattraient.
   */
  const ignorerFlip = useRef(false);
  const pageFlip = useFlip<HTMLDivElement>(ignorerFlip);
  const calquesFlip = useFlip<HTMLDivElement>(ignorerFlip);
  useFinFlip(ignorerFlip);

  const capteurs = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /**
   * Choix de la cible sous le pointeur.
   *
   * La colonne de composition est une cible de dépôt qui couvre toute la
   * hauteur : avec la règle par défaut, qui compare les CENTRES, elle
   * l'emporterait régulièrement sur le bloc que l'on survole — et un
   * déplacement destiné à insérer un composant à un endroit précis finirait à
   * la fin de la page.
   *
   * On regarde donc d'abord ce qui se trouve réellement sous le pointeur, en
   * ignorant la colonne. Elle ne sert que de recours : rien sous le pointeur,
   * c'est qu'on a lâché dans le blanc, et le composant va à la fin.
   */
  const cible: CollisionDetection = useCallback((args) => {
    const sansColonne = args.droppableContainers.filter((c) => c.id !== ZONE_PAGE);
    const dessous = pointerWithin({ ...args, droppableContainers: sansColonne });
    if (dessous.length) return dessous;
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.id === ZONE_PAGE),
    });
  }, []);
  const blocActif = useMemo(() => blocs.find((b) => b.id === selection) ?? null, [blocs, selection]);
  const indexActif = blocs.findIndex((b) => b.id === selection);
  const calqueChoisi = pile.find((c) => c.id === calqueActif) ?? pile[pile.length - 1] ?? null;

  const majCalque = (id: string, p: Partial<Calque>, cle?: string) =>
    majPile((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)), cle);

  const ajouterCalque = (preset: string) => {
    const c = calqueParDefaut(preset, calqueChoisi?.accent ?? "office");
    majPile((prev) => [...prev, c]);
    setCalqueActif(c.id);
    // Flash sur la ligne correspondante : c'est ce qui relie visuellement le
    // clic dans la bibliothèque (à gauche) et son effet dans la pile (à droite).
    setCalqueNeuf(c.id);
    setTimeout(() => setCalqueNeuf((n) => (n === c.id ? null : n)), 1400);
  };

  const deplacerCalque = (de: number, vers: number) => {
    if (vers < 0 || vers >= pile.length) return;
    majPile((prev) => arrayMove(prev, de, vers));
  };

  /**
   * Écriture d'un champ édité en place. Le chemin peut viser une valeur
   * simple (`titre`), un élément de liste (`points.2`), une propriété d'un
   * couple (`etapes.1.a`) ou une moitié de valeur composée (`valeurs.0.nombre`).
   */
  const modifier = (blocId: string, chemin: string, valeur: string) =>
    majBlocs(
      (prev) =>
      prev.map((b) => {
        if (b.id !== blocId) return b;
        const [cle, idx, sous] = chemin.split(".");
        const donnees = { ...b.donnees };

        if (idx === undefined) {
          donnees[cle] = valeur;
          return { ...b, donnees };
        }

        const tableau = [...((donnees[cle] as unknown[]) ?? [])];
        const i = Number(idx);
        if (sous === undefined) {
          tableau[i] = valeur;
        } else if (sous === "nombre" || sous === "legende") {
          const [nombre = "", legende = ""] = String(tableau[i] ?? "").split("|");
          tableau[i] = sous === "nombre" ? `${valeur}|${legende}` : `${nombre}|${valeur}`;
        } else {
          tableau[i] = { ...(tableau[i] as Record<string, unknown>), [sous]: valeur };
        }
        donnees[cle] = tableau;
        return { ...b, donnees };
      }),
      // Une phrase tapée d'affilée = un seul retour arrière.
      `texte:${blocId}:${chemin}`
    );

  const ajouter = (type: TypeBloc, index?: number) => {
    const d = REGISTRE[type].defauts();
    const nouveau: Bloc = { id: identifiant(), type, donnees: d.donnees, style: d.style };
    majBlocs((p) => {
      const n = [...p];
      n.splice(index ?? n.length, 0, nouveau);
      return n;
    });
    setSelection(nouveau.id);
  };

  const deplacer = (de: number, vers: number) => {
    if (de < 0 || vers < 0 || vers >= blocs.length) return;
    majBlocs((p) => arrayMove(p, de, vers));
  };

  /**
   * Duplication. Le double atterrit JUSTE APRÈS l'original et devient l'objet
   * sélectionné — c'est le comportement de PowerPoint comme de Canva. Ajouté en
   * fin de page, il faudrait le retrouver puis le remonter à la main ; et deux
   * blocs identiques éloignés l'un de l'autre ne se distinguent plus.
   */
  const dupliquer = (id: string) => {
    const i = blocs.findIndex((b) => b.id === id);
    if (i === -1) return;
    const copie: Bloc = { ...blocs[i], id: identifiant() };
    majBlocs((p) => {
      const n = [...p];
      n.splice(i + 1, 0, copie);
      return n;
    });
    setSelection(copie.id);
    return copie.id;
  };

  const supprimer = (id: string) => {
    majBlocs((p) => p.filter((b) => b.id !== id));
    setSelection((s) => (s === id ? null : s));
  };

  const surFinGlissement = (e: DragEndEvent) => {
    setEnGlissement(null);
    const { active, over } = e;
    if (!over) return;

    // La bibliothèque de tri replace déjà l'élément : pas de seconde animation.
    ignorerFlip.current = true;

    if (active.data.current?.source === "bibliotheque") {
      // Déposé sur la colonne et non sur un bloc : le composant va à la fin.
      const cible = String(over.id).replace(PREFIXE_CALQUE, "");
      const idx = cible === ZONE_PAGE ? -1 : blocs.findIndex((b) => b.id === cible);
      ajouter(active.data.current.type as TypeBloc, idx === -1 ? undefined : idx);
      return;
    }
    if (active.id === over.id || over.id === ZONE_PAGE) return;

    // La liste des calques et la page manipulent les mêmes blocs sous deux
    // identités : le préfixe les distingue pour dnd-kit, qui exige des
    // identifiants uniques dans un même contexte.
    const nu = (v: string | number) => String(v).replace(PREFIXE_CALQUE, "");
    deplacer(
      blocs.findIndex((b) => b.id === nu(active.id)),
      blocs.findIndex((b) => b.id === nu(over.id))
    );
  };

  const sauverType = () => {
    if (!nomType.trim() || !blocs.length) return;
    enregistrerType(nomType.trim(), "", blocs);
    setPerso(typesPersonnalises());
    setNomType("");
  };

  /* ------------------------------------------------------------------------
   * Raccourcis clavier
   * ------------------------------------------------------------------------
   * Le même gestionnaire est posé sur le document parent ET sur celui de
   * l'aperçu : un `keydown` produit dans un iframe ne remonte pas au parent, et
   * Ctrl+Z serait donc resté sans effet dès que le curseur est dans un texte.
   *
   * L'annulation est interceptée même pendant la saisie : les textes sont
   * rendus par React, l'annulation native du navigateur remettrait des
   * caractères dans le DOM sans prévenir l'état — et l'affichage se
   * désynchroniserait du document.
   * ---------------------------------------------------------------------- */
  const presse = useRef<Bloc | null>(null);

  const raccourci = useCallback(
    (e: KeyboardEvent) => {
      const commande = e.ctrlKey || e.metaKey;
      const touche = e.key.toLowerCase();

      if (commande && touche === "z") {
        e.preventDefault();
        if (e.shiftKey) refaire();
        else annuler();
        return;
      }
      if (commande && touche === "y") {
        e.preventDefault();
        refaire();
        return;
      }

      // Le reste ne doit jamais voler une touche à la frappe en cours.
      const cible = e.target as HTMLElement | null;
      if (cible?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

      if (touche === "escape") {
        setSelection(null);
        return;
      }
      if (!selection) return;

      if (commande && touche === "d") {
        e.preventDefault();
        dupliquer(selection);
        return;
      }
      if (commande && touche === "c") {
        presse.current = blocs.find((b) => b.id === selection) ?? null;
        return;
      }
      if (commande && touche === "v" && presse.current) {
        e.preventDefault();
        const copie: Bloc = { ...presse.current, id: identifiant() };
        const i = blocs.findIndex((b) => b.id === selection);
        majBlocs((p) => {
          const n = [...p];
          n.splice(i === -1 ? n.length : i + 1, 0, copie);
          return n;
        });
        setSelection(copie.id);
        return;
      }
      if (touche === "delete" || touche === "backspace") {
        e.preventDefault();
        supprimer(selection);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, blocs, annuler, refaire, majBlocs]
  );

  const docApercu = useRef<Document | null>(null);

  useEffect(() => {
    document.addEventListener("keydown", raccourci);
    const cadre = docApercu.current;
    cadre?.addEventListener("keydown", raccourci);
    return () => {
      document.removeEventListener("keydown", raccourci);
      cadre?.removeEventListener("keydown", raccourci);
    };
  }, [raccourci]);

  /* ---------------- Menu contextuel ---------------- */
  const menu = useMenuContextuel();
  const [cibleMenu, setCibleMenu] = useState<string | null>(null);

  const ouvrirMenu = (id: string) => (e: React.MouseEvent) => {
    setSelection(id);
    setCibleMenu(id);
    menu.ouvrir(e);
  };

  /** Bascule un drapeau de calque — masquage ou verrouillage. */
  const basculerDrapeau = (id: string, cle: "masque" | "verrouille") =>
    majBlocs((p) => p.map((b) => (b.id === id ? { ...b, [cle]: !b[cle] } : b)));

  const actionsBloc = (id: string): ActionMenu[] => {
    const i = blocs.findIndex((b) => b.id === id);
    const b = blocs[i];
    if (!b) return [];
    return [
      { libelle: "Dupliquer", raccourci: "Ctrl+D", onClick: () => dupliquer(id) },
      {
        libelle: "Copier",
        raccourci: "Ctrl+C",
        onClick: () => {
          presse.current = b;
        },
      },
      {
        libelle: b.masque ? "Afficher dans la page" : "Masquer dans la page",
        onClick: () => basculerDrapeau(id, "masque"),
      },
      {
        libelle: b.verrouille ? "Déverrouiller" : "Verrouiller",
        onClick: () => basculerDrapeau(id, "verrouille"),
      },
      // Un calque verrouillé ne se déplace pas : proposer l'action grisée vaut
      // mieux que la faire disparaître, sinon on croit à un menu incomplet.
      { libelle: "Monter", onClick: () => deplacer(i, i - 1), desactivee: i <= 0 || b.verrouille },
      {
        libelle: "Descendre",
        onClick: () => deplacer(i, i + 1),
        desactivee: i === blocs.length - 1 || b.verrouille,
      },
      { libelle: "Placer au début", onClick: () => deplacer(i, 0), desactivee: i <= 0 || b.verrouille },
      {
        libelle: "Placer à la fin",
        onClick: () => deplacer(i, blocs.length - 1),
        desactivee: i === blocs.length - 1 || b.verrouille,
      },
      {
        libelle: b.verrouille ? "Déverrouiller pour supprimer" : "Supprimer",
        raccourci: b.verrouille ? undefined : "Suppr",
        onClick: () => (b.verrouille ? basculerDrapeau(id, "verrouille") : supprimer(id)),
        danger: true,
      },
    ];
  };

  return (
    <DndContext
      sensors={capteurs}
      collisionDetection={cible}
      onDragStart={(e: DragStartEvent) => setEnGlissement(String(e.active.id))}
      onDragEnd={surFinGlissement}
    >
      <div className="flex h-[calc(100vh-48px)]">
        {/* ================= BARRE LATÉRALE ================= */}
        <aside className="w-[300px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <nav className="border-b border-slate-200">
            <Onglets
              valeur={onglet}
              onChange={(v) => setOnglet(v)}
              variante="souligne"
              items={[
                ["composants", "Ajouter"],
                ["calques", "Calques"],
                ["design", "Filigrane"],
                ["types", "Types"],
              ]}
            />
          </nav>

          {/* La clé remonte le panneau à chaque changement d'onglet : le contenu
              entre par le côté, du même geste que le curseur qui vient de s'y
              déplacer. */}
          <div key={onglet} className="ms-entre-lat flex-1 overflow-y-auto p-3">
            {/* ---------- Composants ---------- */}
            {onglet === "composants" && (
              <>
                <p className="text-[10.5px] text-slate-500 leading-snug mb-3">
                  Glissez un composant à l'endroit voulu, ou cliquez pour l'ajouter à la fin. Le texte se
                  modifie ensuite directement dans la page.
                </p>
                <div className="ms-cascade space-y-2">
                  {ORDRE_BIBLIOTHEQUE.map((t) => (
                    <ItemBibliotheque key={t} type={t} onAjouter={() => ajouter(t)} />
                  ))}
                </div>
              </>
            )}

            {/* ---------- Calques ---------- */}
            {onglet === "calques" && (
              <>
                <p className="text-[10.5px] text-slate-500 leading-snug mb-3">
                  L'ordre de la page, de haut en bas. Glissez une ligne par sa poignée pour la déplacer, ou
                  faites un clic droit pour dupliquer et supprimer.
                </p>
                <SortableContext
                  items={blocs.map((b) => `${PREFIXE_CALQUE}${b.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div ref={calquesFlip} className="space-y-1">
                    {blocs.map((b, i) => (
                      <LigneCalque
                        key={b.id}
                        bloc={b}
                        rang={i + 1}
                        actif={selection === b.id}
                        onSelect={() => setSelection(b.id)}
                        onContexte={ouvrirMenu(b.id)}
                        onBasculerMasque={() => basculerDrapeau(b.id, "masque")}
                        onBasculerVerrou={() => basculerDrapeau(b.id, "verrouille")}
                        actions={actionsBloc(b.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
                {blocs.length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    Aucun composant. Ajoutez-en depuis l'onglet « Ajouter ».
                  </p>
                )}
              </>
            )}

            {/* ---------- Fond & filigrane ---------- */}
            {onglet === "design" && (
              <>
                <p className="text-[10px] leading-snug text-slate-400 mb-1">
                  Dépliez une section pour voir son contenu. Un clic sur une vignette empile le calque à
                  droite.
                </p>

                <Section
                  titre="Filigranes prêts"
                  compte={COMPOSITIONS.length}
                  ouvert={!!ouvertes["compositions"]}
                  onToggle={() => basculer("compositions")}
                >
                  <p className="text-[10px] leading-snug text-slate-400 mb-2">
                    Une composition remplace la pile entière. Vous ajustez ensuite à droite.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPOSITIONS.map((c) => (
                      <button
                        key={c.cle}
                        onClick={() => {
                          const nouvelle = instancierComposition(c);
                          majPile(() => nouvelle);
                          setCalqueActif(nouvelle[nouvelle.length - 1]?.id ?? null);
                        }}
                        title={c.usage}
                        className="ms-levier rounded-lg border border-slate-200 hover:border-slate-900 overflow-hidden text-left"
                      >
                        <span className="relative block h-[72px] overflow-hidden bg-ms-paper">
                          <RenduPile calques={instancierComposition(c)} />
                        </span>
                        <span className="block px-2 py-1.5 border-t border-slate-100">
                          <span className="block text-[10.5px] font-bold text-slate-800 leading-tight">
                            {c.nom}
                          </span>
                          <span className="block text-[9.5px] text-slate-400 mt-0.5">
                            {c.couches.length} calques
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </Section>

                {FAMILLES.map((fam) => {
                  const liste = PRESETS_FOND.filter((f) => f.famille === fam);
                  return (
                    <Section
                      key={fam}
                      titre={fam}
                      compte={liste.length}
                      ouvert={!!ouvertes[fam]}
                      onToggle={() => basculer(fam)}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {liste.map((f) => (
                          <button
                            key={f.cle}
                            onClick={() => ajouterCalque(f.cle)}
                            title={`${f.note} — cliquer pour empiler`}
                            className="ms-levier group rounded-lg border border-slate-200 hover:border-slate-900 overflow-hidden text-left"
                          >
                            <span className="relative block h-14 overflow-hidden bg-ms-paper">
                              <RenduFond
                                preset={f}
                                accent={calqueChoisi?.accent ?? "office"}
                                position="centre"
                              />
                              {/* Le voile monte du bas du cadre plutôt que
                                  d'apparaître d'un bloc : il vient de la pile,
                                  qui est en dessous. */}
                              <span className="ms-voile absolute inset-0 flex items-center justify-center bg-slate-900/75 text-white text-[10px] font-bold">
                                + Empiler
                              </span>
                            </span>
                            <span className="block px-2 py-1.5 text-[10.5px] font-bold text-slate-700 border-t border-slate-100">
                              {f.nom}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Section>
                  );
                })}
              </>
            )}

            {/* ---------- Types ---------- */}
            {onglet === "types" && (
              <>
                <p className="text-[10.5px] text-slate-500 leading-snug mb-3">
                  Appliquer un type remplace la composition en cours.
                </p>
                <div className="ms-cascade space-y-2 mb-5">
                  {TYPES_SYSTEME.map((t) => (
                    <button
                      key={t.cle}
                      onClick={() => {
                        majBlocs(() => instancier(t));
                        setSelection(null);
                      }}
                      className="ms-levier w-full text-left rounded-lg border border-slate-200 bg-white p-2.5 hover:border-slate-400"
                    >
                      <span className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[12px] font-bold text-slate-800">{t.nom}</span>
                        <Pastille ton="neutre">{t.composition.length || "vierge"}</Pastille>
                      </span>
                      <span className="block text-[10px] leading-snug text-slate-500">{t.description}</span>
                    </button>
                  ))}
                </div>

                {perso.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Mes types</p>
                    <div className="space-y-2 mb-5">
                      {perso.map((t) => (
                        <div key={t.cle} className="ms-insere flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 transition-colors duration-150 hover:border-slate-400">
                          <button
                            onClick={() => {
                              majBlocs(() => instancier(t));
                              setSelection(null);
                            }}
                            className="flex-1 text-left text-[12px] font-bold text-slate-800 hover:underline"
                          >
                            {t.nom}
                            <span className="block text-[10px] font-normal text-slate-400">
                              {t.composition.length} blocs
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              supprimerType(t.cle);
                              setPerso(typesPersonnalises());
                            }}
                            className="text-[12px] text-slate-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="border-t border-slate-200 pt-3">
                  <Champ label="Enregistrer la composition" aide="La structure est conservée, les textes vidés.">
                    <Saisie value={nomType} onChange={(e) => setNomType(e.target.value)} placeholder="Interview, Actu…" />
                  </Champ>
                  <Bouton variante="principal" onClick={sauverType} disabled={!nomType.trim() || !blocs.length}>
                    Créer le type
                  </Bouton>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ================= ZONE DE COMPOSITION ================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
          {/* Barre contextuelle : agit sur le bloc sélectionné, façon PowerPoint */}
          <div className="h-11 shrink-0 border-b border-slate-200 bg-white flex items-center gap-3 px-3">
            {/* Annuler / Refaire en tête de barre, à la place qu'ils occupent
                dans tous les éditeurs — c'est là qu'on les cherche. */}
            <span className="flex items-center gap-0.5 pr-3 border-r border-slate-200">
              {[
                { t: "Annuler — Ctrl+Z", d: "M7 4 3 8l4 4M3 8h7a5 5 0 0 1 0 10H8", f: annuler, actif: peutAnnuler },
                { t: "Refaire — Ctrl+Maj+Z", d: "M13 4l4 4-4 4M17 8h-7a5 5 0 0 0 0 10h2", f: refaire, actif: peutRefaire },
              ].map((b) => (
                <button
                  key={b.t}
                  title={b.t}
                  onClick={b.f}
                  disabled={!b.actif}
                  className="ms-presse w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                >
                  <svg viewBox="0 0 20 22" aria-hidden className="w-4 h-4">
                    <path d={b.d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </span>

            {blocActif ? (
              <>
                {/* La clé rejoue l'entrée quand on passe d'un bloc à l'autre :
                    la barre change vraiment de sujet, elle ne se contente pas
                    d'échanger un mot. */}
                <span
                  key={blocActif.id}
                  className="ms-entre-lat flex items-center gap-1.5 pr-3 border-r border-slate-200"
                >
                  <span className="w-5 h-5 text-ms-blue">
                    <IconeBloc type={blocActif.type} />
                  </span>
                  <span className="text-[11.5px] font-bold text-slate-700">{REGISTRE[blocActif.type].nom}</span>
                </span>

                <span className="flex items-center gap-1">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.v}
                      title={a.nom}
                      onClick={() =>
                        majBlocs((p) =>
                          p.map((b) => (b.id === blocActif.id ? { ...b, style: { accent: a.v } } : b))
                        )
                      }
                      className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ease-ressort active:scale-90 ${a.c} ${
                        blocActif.style.accent === a.v
                          ? "border-slate-900 scale-110"
                          : "border-transparent opacity-40 hover:opacity-90 hover:scale-105"
                      }`}
                    />
                  ))}
                </span>

                <span className="flex items-center gap-1 pl-3 border-l border-slate-200">
                  <Bouton variante="discret" onClick={() => deplacer(indexActif, 0)} disabled={indexActif <= 0}>
                    Premier plan
                  </Bouton>
                  <Bouton
                    variante="discret"
                    onClick={() => deplacer(indexActif, blocs.length - 1)}
                    disabled={indexActif === blocs.length - 1}
                  >
                    Arrière-plan
                  </Bouton>
                  <Bouton variante="discret" onClick={() => dupliquer(blocActif.id)}>
                    Dupliquer
                  </Bouton>
                  <Bouton variante="discret" onClick={() => supprimer(blocActif.id)}>
                    Supprimer
                  </Bouton>
                </span>
              </>
            ) : (
              <span className="text-[11.5px] text-slate-400">
                Cliquez un bloc pour le mettre en forme — le texte se modifie directement dans la page.
              </span>
            )}

            <span className="ml-auto flex items-center gap-2">
              <Onglets
                valeur={appareil}
                onChange={(v) => setAppareil(v)}
                items={(Object.keys(LARGEURS) as (keyof typeof LARGEURS)[]).map((a) => [
                  a,
                  a[0].toUpperCase() + a.slice(1),
                ])}
              />
              <Bouton variante="discret" onClick={() => setDiapoOuvert(true)} disabled={visibles.length === 0}>
                Diaporama
              </Bouton>
              <span className="pl-2 border-l border-slate-200">
                <Publication blocs={blocs} acteur={acteur} />
              </span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex justify-center">
            <div
              className="w-full h-full flex justify-center"
              style={{ maxWidth: LARGEURS[appareil] === "100%" ? "100%" : LARGEURS[appareil] }}
            >
              <CadreApercu
                largeur="100%"
                surDocument={(d) => {
                  docApercu.current = d;
                }}
              >
                <FournisseurEdition value={{ actif: true, modifier }}>
                  {/* Fond et filigrane choisis dans la bibliothèque */}
                  <div
                    className="relative min-h-full"
                    style={{ pointerEvents: "auto" }}
                    onPointerDown={() => {
                      setSelection(null);
                      // Le menu contextuel est rendu dans le document parent :
                      // un clic dans le cadre ne l'atteint pas tout seul.
                      menu.fermer();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <RenduPile calques={pile} />

                    {/* Toute la colonne accueille un dépôt : lâcher un composant
                        dans le blanc sous le dernier bloc est le geste naturel,
                        et ne rien faire dans ce cas passe pour une panne. */}
                    <ZonePage actif={!!enGlissement?.startsWith("lib_")}>
                      <SortableContext items={visibles.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                        <div ref={pageFlip} className="space-y-1">
                          {visibles.map((b) => (
                            <BlocTriable
                              key={b.id}
                              bloc={b}
                              actif={selection === b.id}
                              onSelect={() => setSelection(b.id)}
                              onContexte={ouvrirMenu(b.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>

                      {visibles.length === 0 && (
                        <div
                          data-actif={enGlissement?.startsWith("lib_") ? "1" : "0"}
                          className="ms-depot border-2 border-dashed border-ms-ink/20 rounded-xl p-12 text-center"
                        >
                          <p className="text-[13px] text-ms-ink/40">
                            {blocs.length === 0
                              ? "Page vierge — glissez un composant depuis la bibliothèque."
                              : "Tous les calques sont masqués. Rouvrez un œil dans la liste des calques."}
                          </p>
                        </div>
                      )}
                    </ZonePage>
                  </div>
                </FournisseurEdition>
              </CadreApercu>
            </div>
          </div>
        </div>
        {/* ================= BARRE DE DROITE — LA PILE ================= */}
        <aside className="w-[286px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
          <header className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-slate-200 bg-slate-50">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Pile du fond
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{pile.length}</span>
              {pile.length > 0 && (
                <button
                  onClick={() => { majPile(() => []); setCalqueActif(null); }}
                  className="text-[10px] text-slate-400 hover:text-red-600"
                  title="Vider la pile"
                >
                  Vider
                </button>
              )}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto p-2.5">
            {pile.length === 0 && (
              <p className="text-[11px] leading-snug text-slate-400">
                Pile vide. Choisissez une composition ou empilez des calques depuis la bibliothèque, à gauche.
              </p>
            )}

            {/* Du haut de la pile vers le bas — comme on les voit à l'écran */}
            <div className="space-y-1.5">
              {[...pile].reverse().map((c) => {
                const i = pile.indexOf(c);
                const preset = parCleFond(c.preset);
                const ouvert = calqueChoisi?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setCalqueActif(c.id)}
                    className={`ms-insere rounded-lg border cursor-pointer transition-colors duration-150 ${
                      calqueNeuf === c.id
                        ? "ms-signal border-ms-blue bg-ms-blue/5"
                        : ouvert
                          ? "border-slate-900 ring-1 ring-slate-900"
                          : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span className="relative block w-11 h-8 shrink-0 rounded-sm overflow-hidden border border-slate-200 bg-ms-paper">
                        <RenduFond preset={preset} accent={c.accent} position={c.position} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[11.5px] font-bold text-slate-700 leading-tight">
                          {preset.nom}
                        </span>
                        <span className="block text-[9.5px] text-slate-400">
                          {preset.famille} · {Math.round(c.opacite * 100)} %
                          {i === 0 && " · socle"}
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <button
                          title="Monter"
                          onClick={(e) => { e.stopPropagation(); deplacerCalque(i, i + 1); }}
                          disabled={i === pile.length - 1}
                          className="w-5 h-4 rounded text-[9px] text-slate-400 hover:bg-slate-100 disabled:opacity-25"
                        >
                          ▲
                        </button>
                        <button
                          title="Descendre"
                          onClick={(e) => { e.stopPropagation(); deplacerCalque(i, i - 1); }}
                          disabled={i === 0}
                          className="w-5 h-4 rounded text-[9px] text-slate-400 hover:bg-slate-100 disabled:opacity-25"
                        >
                          ▼
                        </button>
                      </span>
                      <button
                        title="Retirer ce calque"
                        onClick={(e) => { e.stopPropagation(); majPile((p) => p.filter((x) => x.id !== c.id)); }}
                        className="w-5 h-5 shrink-0 rounded text-[12px] text-slate-300 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>

                    {/* Les réglages du calque se déplient sous sa ligne. Ils
                        restent montés en permanence — une pile compte rarement
                        plus de huit calques, et c'est le prix pour que le repli
                        se ferme sur du contenu et non sur du vide. */}
                    <div className="ms-repli" data-ouvert={ouvert ? "1" : "0"}>
                      <div>
                      <div className="border-t border-slate-200 p-2.5 bg-slate-50 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Couleur
                          </span>
                          <span className="flex gap-1">
                            {ACCENTS.map((a) => (
                              <button
                                key={a.v}
                                title={a.nom}
                                onClick={(e) => { e.stopPropagation(); majCalque(c.id, { accent: a.v }); }}
                                className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ease-ressort active:scale-90 ${a.c} ${
                                  c.accent === a.v
                                    ? "border-slate-900 scale-110"
                                    : "border-transparent opacity-40 hover:opacity-90 hover:scale-105"
                                }`}
                              />
                            ))}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-1">
                            Position
                          </span>
                          <Positions
                            valeur={c.position}
                            onChange={(pos) => majCalque(c.id, { position: pos })}
                            actif={preset.positionnable}
                          />
                        </div>

                        <label className="block" onClick={(e) => e.stopPropagation()}>
                          <span className="flex items-baseline justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Intensité
                            </span>
                            <span className="text-[9.5px] font-mono text-slate-400">
                              {Math.round(c.opacite * 100)} %
                            </span>
                          </span>
                          <input
                            type="range"
                            min={5}
                            max={100}
                            value={Math.round(c.opacite * 100)}
                            onChange={(e) => majCalque(c.id, { opacite: Number(e.target.value) / 100 })}
                            className="w-full accent-slate-900"
                          />
                        </label>

                        <p className="text-[10px] leading-snug text-slate-400">{preset.note}</p>
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pile.length > 0 && (
              <p className="mt-3 pt-3 border-t border-slate-200 text-[9.5px] leading-snug text-slate-400">
                Le calque du bas (« socle ») pose la couleur de page. Dosage conseillé : socle à 100 %, motif de
                sujet entre 30 et 50 %, signature sous 25 %.
              </p>
            )}
          </div>
        </aside>
      </div>

      <DragOverlay>
        {enGlissement?.startsWith("lib_") && (
          <div className="ms-insere flex items-center gap-2 rounded-lg border border-ms-blue bg-white px-3 py-2 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.55)] rotate-[-1.5deg] scale-105">
            <span className="w-5 h-5 text-ms-blue">
              <IconeBloc type={enGlissement.replace("lib_", "") as TypeBloc} />
            </span>
            <span className="text-[12px] font-bold text-slate-800">
              {REGISTRE[enGlissement.replace("lib_", "") as TypeBloc].nom}
            </span>
          </div>
        )}
      </DragOverlay>

      {/* Un seul menu contextuel pour toute la vue : la page et la liste des
          calques ouvrent le même, sur le bloc qu'elles désignent. */}
      <MenuContextuel
        ancre={menu.ancre}
        ouvert={menu.ouvert}
        onFermer={menu.fermer}
        actions={cibleMenu ? actionsBloc(cibleMenu) : []}
      />

      {/* Aperçu en diaporama. Rendu dans le document du panel, et non dans le
          cadre d'aperçu : celui-ci est un miroir sans interaction
          (`pointer-events: none`), et une présentation qu'on ne peut pas faire
          défiler ne s'aperçoit pas. Ses raccourcis clavier ont d'ailleurs
          besoin du document réel. */}
      {diapoOuvert && (
        <Presentateur
          doc={documentDepuisArticle({
            ...enTete(blocs),
            corps: versCorps(blocs),
            auteur: acteur,
            publie_le: new Date().toISOString().slice(0, 10),
          })}
          ancrage={false}
          onFermer={() => setDiapoOuvert(false)}
        />
      )}
    </DndContext>
  );
};

export default Constructeur;
