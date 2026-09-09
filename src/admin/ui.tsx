import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAncre, type Ancre } from "./ancre";
import { depuisIso, iso, relatif } from "./dates";

/**
 * Primitives du panel d'administration.
 *
 * Le panel reste dense : c'est un outil, pas une vitrine, et les proportions
 * généreuses du site public y feraient perdre des lignes de tableau à chaque
 * écran. Ce qu'il a récupéré, c'est le MOUVEMENT — mais seulement celui qui
 * répond à un geste : une liste qui s'ouvre depuis son bouton, un onglet dont
 * l'indicateur voyage, une ligne créée qui se signale. Les durées tiennent
 * entre 90 et 250 ms ; aucune interaction courante ne fait attendre.
 *
 * Les classes `ms-*` employées ici sont définies dans `admin.css`, où le
 * raisonnement complet est exposé.
 */

export const Panneau = ({
  titre,
  children,
  action,
  delai = 0,
}: {
  titre: string;
  children: ReactNode;
  action?: ReactNode;
  /** Décalage d'entrée, pour faire arriver plusieurs panneaux en cascade. */
  delai?: number;
}) => (
  <section
    className="ms-carte ms-entre overflow-hidden"
    style={{ ["--d" as string]: `${delai}ms` }}
  >
    <header className="ms-carte-entete flex items-center justify-between gap-3 px-3.5 h-10">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{titre}</h2>
      {action}
    </header>
    <div className="p-3.5">{children}</div>
  </section>
);

export const Champ = ({
  label,
  aide,
  compteur,
  children,
}: {
  label: string;
  aide?: string;
  compteur?: { valeur: number; min?: number; max: number };
  children: ReactNode;
}) => {
  const c = compteur;
  const hors = c ? c.valeur > c.max || (c.min !== undefined && c.valeur > 0 && c.valeur < c.min) : false;
  return (
    <label className="block mb-3 last:mb-0">
      <span className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
        {c && (
          <span
            /* La clé change avec la valeur : le compteur rejoue donc son
               battement à chaque frappe hors bornes, et le dépassement se voit
               même quand on ne regarde pas le nombre. */
            key={hors ? `hors-${c.valeur}` : "dans"}
            className={`text-[10px] font-mono tabular-nums ${
              hors ? "text-red-600 font-bold ms-battement" : "text-slate-400"
            }`}
          >
            {c.valeur}
            {c.min !== undefined ? `/${c.min}–${c.max}` : `/${c.max}`}
          </span>
        )}
      </span>
      {children}
      {aide && <span className="block mt-1 text-[10.5px] leading-snug text-slate-400">{aide}</span>}
    </label>
  );
};

const baseSaisie =
  "ms-champ w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white placeholder:text-slate-300";

export const Saisie = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`${baseSaisie} ${p.className ?? ""}`} />
);

/* La référence est transmise : insérer une image à l'endroit du curseur exige
   d'atteindre le vrai <textarea>, pas seulement sa valeur. */
export const Zone = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (p, ref) => <textarea {...p} ref={ref} className={`${baseSaisie} resize-y leading-relaxed ${p.className ?? ""}`} />
);
Zone.displayName = "Zone";

/* ---------------------------------------------------------------------------
 * Liste déroulante
 * ---------------------------------------------------------------------------
 * Remplace `<select>`. Le menu natif est rendu par le système d'exploitation :
 * il ignore la charte, ne s'anime pas, et son apparence change d'une machine à
 * l'autre — sur un panel qui cherche une cohérence, c'était la seule pièce qui
 * n'obéissait pas.
 *
 * La signature reste celle d'un `<select>` (`value`, `onChange`, `<option>` en
 * enfants) pour que les écrans existants n'aient rien à changer : l'événement
 * transmis porte un `target.value`, comme le natif.
 *
 * Le clavier est intégralement pris en charge — flèches, Origine/Fin, Entrée,
 * Échap — parce qu'un composant maison qui perd le clavier est une régression,
 * pas une modernisation.
 * ------------------------------------------------------------------------- */

type OptionListe = { valeur: string; libelle: string; desactivee?: boolean };

/** Aplatit les `<option>` (y compris ceux produits par un `.map`) en données. */
const lireOptions = (enfants: ReactNode): OptionListe[] => {
  const sortie: OptionListe[] = [];
  Children.toArray(enfants).forEach((n) => {
    if (!isValidElement(n)) return;
    if (n.type === "option") {
      const p = n.props as { value?: string; children?: ReactNode; disabled?: boolean };
      sortie.push({
        valeur: String(p.value ?? ""),
        libelle: Children.toArray(p.children).join(""),
        desactivee: p.disabled,
      });
      return;
    }
    // Fragments et regroupements : on descend d'un cran.
    const p = n.props as { children?: ReactNode };
    if (p?.children) sortie.push(...lireOptions(p.children));
  });
  return sortie;
};

/* ---------------------------------------------------------------------------
 * Couche flottante
 * ---------------------------------------------------------------------------
 * Tous les menus du panel — liste déroulante, calendrier, actions de ligne,
 * clic droit — passent par ici, et sont rendus dans un PORTAIL attaché au
 * <body> plutôt qu'à l'endroit du document où ils sont écrits.
 *
 * C'est la seule façon fiable de les faire passer au-dessus du reste. Un menu
 * posé dans une ligne de tableau reste prisonnier du contexte d'empilement de
 * cette ligne : les lignes suivantes, écrites APRÈS dans le document, se
 * peignent par-dessus lui quel que soit son `z-index` — et c'était exactement
 * le symptôme observé, les boutons « Modifier » des lignes du dessous
 * traversant le menu ouvert. Empiler des `z-index` toujours plus grands ne
 * règle rien : la comparaison n'a pas lieu au même niveau. Sorti dans le
 * <body>, le menu n'a plus de concurrent.
 *
 * Second bénéfice, décisif pour le constructeur : le menu n'est plus coupé par
 * le `overflow: hidden` d'un panneau ou d'une barre latérale.
 * ------------------------------------------------------------------------- */

export const Flottant = ({
  ancre,
  ouvert,
  onFermer,
  children,
  alignement = "gauche",
  largeurMini,
  classe = "",
  declencheur,
}: {
  ancre: Ancre | null;
  ouvert: boolean;
  onFermer: () => void;
  children: ReactNode;
  /** Bord sur lequel le menu s'aligne. */
  alignement?: "gauche" | "droite";
  /** Impose la largeur de l'ancre — utile pour une liste déroulante. */
  largeurMini?: boolean;
  classe?: string;
  /**
   * Bouton qui a ouvert le menu. Il doit être exclu de la détection du « clic
   * ailleurs » : sinon un second clic dessus ferme le menu par cette voie, puis
   * le rouvre par son propre `onClick` — et le menu paraît coincé ouvert.
   */
  declencheur?: React.RefObject<HTMLElement>;
}) => {
  const panneau = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<{ haut: number; gauche: number; sens: "bas" | "haut" } | null>(null);

  /* Position calculée APRÈS mesure du menu réel : estimer sa hauteur à partir
     du nombre d'entrées faisait basculer certains menus du mauvais côté. */
  useLayoutEffect(() => {
    if (!ouvert || !ancre) return;
    const placer = () => {
      const m = panneau.current;
      if (!m) return;
      const { width: l, height: h } = m.getBoundingClientRect();
      const marge = 6;
      const placeDessous = window.innerHeight - (ancre.y + ancre.h) - marge;
      const sens: "bas" | "haut" = h > placeDessous && ancre.y - marge > placeDessous ? "haut" : "bas";
      const haut = sens === "bas" ? ancre.y + ancre.h + marge : Math.max(marge, ancre.y - h - marge);
      let gauche = alignement === "droite" ? ancre.x + ancre.l - l : ancre.x;
      // Recadrage horizontal : un menu qui sort de l'écran est inatteignable.
      gauche = Math.min(Math.max(marge, gauche), window.innerWidth - l - marge);
      setPose({ haut, gauche, sens });
    };
    placer();

    /*
     * Le menu se ferme quand la PAGE défile : son ancre bouge, et le laisser
     * flotter à côté du bouton qui l'a ouvert serait pire que de le fermer.
     *
     * ⚠️ MAIS PAS QUAND C'EST LE MENU LUI-MÊME QUI DÉFILE.
     *
     * L'écoute était posée en phase de CAPTURE sur `window` : elle recevait
     * donc AUSSI les défilements de son propre contenu. Or un menu long est
     * `overflow-y: auto`, et `Liste` appelle `scrollIntoView` sur l'entrée
     * survolée — à l'ouverture, puis à chaque passage de souris.
     *
     * Conséquence, signalée depuis le panel : la liste des icônes, seule assez
     * longue pour défiler (quinze entrées), se refermait AU MOMENT MÊME où on
     * l'ouvrait. Les listes courtes, qui tiennent sans défiler, marchaient —
     * ce qui rendait le défaut incompréhensible vu de l'écran.
     *
     * On ignore donc tout défilement provenant de l'intérieur du panneau.
     */
    const defilement = (e: Event) => {
      const cible = e.target as Node | null;
      if (cible && panneau.current?.contains(cible)) return;
      onFermer();
    };

    window.addEventListener("scroll", defilement, true);
    window.addEventListener("resize", onFermer);
    return () => {
      window.removeEventListener("scroll", defilement, true);
      window.removeEventListener("resize", onFermer);
    };
  }, [ouvert, ancre, alignement, onFermer]);

  useEffect(() => {
    if (!ouvert) {
      setPose(null);
      return;
    }
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (panneau.current?.contains(cible)) return;
      if (declencheur?.current?.contains(cible)) return;
      onFermer();
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    // Différé d'une frame : sans cela, le clic qui vient d'ouvrir le menu est
    // capté par ce même écouteur et le referme aussitôt.
    const t = setTimeout(() => document.addEventListener("pointerdown", dehors, true), 0);
    document.addEventListener("keydown", echap);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", dehors, true);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert, onFermer, declencheur]);

  if (!ouvert || !ancre) return null;

  return createPortal(
    <div
      ref={panneau}
      data-sens={pose?.sens ?? "bas"}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        top: pose?.haut ?? ancre.y + ancre.h + 6,
        left: pose?.gauche ?? ancre.x,
        minWidth: largeurMini ? ancre.l : undefined,
        // Invisible tant que la position n'est pas mesurée : sinon le menu
        // apparaît un instant en haut à gauche avant de sauter à sa place.
        visibility: pose ? "visible" : "hidden",
        zIndex: 9999,
      }}
      className={`ms-menu rounded-lg border border-slate-200 bg-white ${classe}`}
    >
      {children}
    </div>,
    document.body
  );
};


export const Liste = ({
  value,
  onChange,
  className = "",
  disabled,
  children,
  placeholder = "Choisir…",
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
  placeholder?: string;
}) => {
  const options = lireOptions(children);
  const choisie = options.find((o) => o.valeur === String(value ?? ""));

  const [survol, setSurvol] = useState(0);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { ancre, ouvert, basculer, fermer } = useAncre();

  /* À l'ouverture, le survol part de l'entrée déjà choisie : les flèches
     continuent depuis la valeur en cours, elles ne repartent pas du haut. */
  useLayoutEffect(() => {
    if (!ouvert) return;
    setSurvol(Math.max(0, options.findIndex((o) => o.valeur === String(value ?? ""))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, value]);

  /* L'entrée survolée reste dans le champ de vision quand on navigue aux
     flèches sur une liste plus longue que le menu. */
  useEffect(() => {
    if (!ouvert) return;
    menu.current?.querySelector<HTMLElement>(`[data-i="${survol}"]`)?.scrollIntoView({ block: "nearest" });
  }, [survol, ouvert]);

  const valider = (i: number) => {
    const o = options[i];
    if (!o || o.desactivee) return;
    onChange?.({ target: { value: o.valeur } });
    fermer();
  };

  const clavier = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!ouvert) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        basculer(bouton.current);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        fermer();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSurvol((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSurvol((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setSurvol(0);
        break;
      case "End":
        e.preventDefault();
        setSurvol(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        valider(survol);
        break;
      case "Tab":
        fermer();
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={bouton}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={(e) => {
          e.stopPropagation();
          basculer(bouton.current);
        }}
        onKeyDown={clavier}
        className={`ms-champ w-full flex items-center gap-2 border rounded-lg pl-2.5 pr-2 py-1.5 text-[13px] text-left bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          ouvert ? "border-ms-blue" : "border-slate-300"
        }`}
        style={ouvert ? { boxShadow: "var(--ms-halo)" } : undefined}
      >
        <span className={`flex-1 min-w-0 truncate ${choisie ? "text-slate-800" : "text-slate-400"}`}>
          {choisie?.libelle ?? placeholder}
        </span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="ms-chevron w-3 h-3 shrink-0 text-slate-400"
          data-ouvert={ouvert ? "1" : "0"}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Flottant
        ancre={ancre}
        ouvert={ouvert}
        onFermer={fermer}
        declencheur={bouton}
        largeurMini
        classe="max-w-[min(20rem,80vw)] max-h-72 overflow-y-auto p-1"
      >
        <div ref={menu} role="listbox">
          {options.map((o, i) => {
            const actif = o.valeur === String(value ?? "");
            return (
              <div
                key={o.valeur + i}
                role="option"
                aria-selected={actif}
                data-i={i}
                data-survol={survol === i ? "1" : "0"}
                onPointerEnter={() => setSurvol(i)}
                onClick={() => valider(i)}
                style={{ ["--i" as string]: i }}
                className={`ms-menu-item flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] cursor-pointer select-none ${
                  o.desactivee ? "opacity-40 pointer-events-none" : ""
                } ${actif ? "font-bold text-slate-900" : "text-slate-600"}`}
              >
                <span
                  className={`w-1.5 h-1.5 shrink-0 rounded-full transition-transform duration-150 ${
                    actif ? "bg-ms-blue scale-100" : "bg-transparent scale-0"
                  }`}
                />
                <span className="truncate">{o.libelle}</span>
              </div>
            );
          })}
          {options.length === 0 && (
            <p className="px-2.5 py-2 text-[11.5px] text-slate-400">Aucun choix disponible.</p>
          )}
        </div>
      </Flottant>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Sélecteur de date
 * ---------------------------------------------------------------------------
 * `<input type="date">` a le même défaut que `<select>` : son calendrier est
 * dessiné par le système, ignore la charte, et son format d'affichage change
 * d'une machine à l'autre — sur une date de publication, c'est une source de
 * confusion réelle entre le format français et l'américain.
 *
 * La valeur échangée reste ISO (`AAAA-MM-JJ`), identique à celle de l'input
 * natif : le stockage, l'export Markdown et le tri ne changent pas d'un iota.
 * ------------------------------------------------------------------------- */

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

const LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
const MOIS_AN = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export const SelecteurDate = ({
  value,
  onChange,
  className = "",
  disabled,
  placeholder = "Choisir une date",
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const choisie = depuisIso(value);
  const [curseur, setCurseur] = useState<Date>(() => choisie ?? new Date());
  const bouton = useRef<HTMLButtonElement>(null);
  const { ancre, ouvert, basculer, fermer } = useAncre();

  // À la réouverture, on revient sur le mois de la date choisie : rouvrir le
  // calendrier trois mois plus loin parce qu'on y avait navigué la fois d'avant
  // oblige à se réorienter à chaque fois.
  useEffect(() => {
    if (ouvert) setCurseur(choisie ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  /** Grille de six semaines, commençant un lundi — cadre stable, sans saut de
   *  hauteur d'un mois à l'autre. */
  const grille = useMemo(() => {
    const premier = new Date(curseur.getFullYear(), curseur.getMonth(), 1);
    const decalage = (premier.getDay() + 6) % 7;
    const depart = new Date(premier);
    depart.setDate(1 - decalage);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(depart);
      d.setDate(depart.getDate() + i);
      return d;
    });
  }, [curseur]);

  const deplacer = (jours: number) => {
    const d = new Date(curseur);
    d.setDate(d.getDate() + jours);
    setCurseur(d);
  };
  const mois = (n: number) => {
    const d = new Date(curseur.getFullYear(), curseur.getMonth() + n, 1);
    setCurseur(d);
  };

  const valider = (d: Date) => {
    onChange?.({ target: { value: iso(d) } });
    fermer();
  };

  const clavier = (e: React.KeyboardEvent) => {
    if (!ouvert) {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        basculer(bouton.current);
      }
      return;
    }
    const touches: Record<string, () => void> = {
      ArrowLeft: () => deplacer(-1),
      ArrowRight: () => deplacer(1),
      ArrowUp: () => deplacer(-7),
      ArrowDown: () => deplacer(7),
      PageUp: () => mois(-1),
      PageDown: () => mois(1),
      Enter: () => valider(curseur),
      " ": () => valider(curseur),
    };
    const f = touches[e.key];
    if (f) {
      e.preventDefault();
      f();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={bouton}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          basculer(bouton.current);
        }}
        onKeyDown={clavier}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        className={`ms-champ w-full flex items-center gap-2 border rounded-lg pl-2.5 pr-2 py-1.5 text-[13px] text-left bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          ouvert ? "border-ms-blue" : "border-slate-300"
        }`}
        style={ouvert ? { boxShadow: "var(--ms-halo)" } : undefined}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="w-3.5 h-3.5 shrink-0 text-slate-400">
          <rect x="2" y="3.5" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 7h12M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span className={`flex-1 min-w-0 truncate ${choisie ? "text-slate-800" : "text-slate-400"}`}>
          {choisie ? LONG.format(choisie) : placeholder}
        </span>
        {choisie && <span className="shrink-0 text-[10px] text-slate-400">{relatif(value)}</span>}
      </button>

      <Flottant ancre={ancre} ouvert={ouvert} onFermer={fermer} declencheur={bouton} classe="w-[268px] p-2.5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => mois(-1)}
              title="Mois précédent"
              className="ms-presse w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              ‹
            </button>
            <span className="text-[12px] font-bold text-slate-800 capitalize">{MOIS_AN.format(curseur)}</span>
            <button
              type="button"
              onClick={() => mois(1)}
              title="Mois suivant"
              className="ms-presse w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {JOURS.map((j, i) => (
              <span key={i} className="text-center text-[9.5px] font-bold uppercase text-slate-400">
                {j}
              </span>
            ))}
          </div>

          <div key={`${curseur.getFullYear()}-${curseur.getMonth()}`} className="grid grid-cols-7 gap-0.5">
            {grille.map((d) => {
              const horsMois = d.getMonth() !== curseur.getMonth();
              const estChoisie = !!choisie && iso(d) === iso(choisie);
              const estAujourdhui = iso(d) === iso(aujourdhui);
              return (
                <button
                  key={iso(d)}
                  type="button"
                  onClick={() => valider(d)}
                  className={`h-7 rounded-md text-[11.5px] tabular-nums transition-all duration-150 ${
                    estChoisie
                      ? "bg-slate-900 text-white font-bold shadow-[0_2px_8px_-2px_rgba(15,23,42,0.6)]"
                      : horsMois
                        ? "text-slate-300 hover:bg-slate-100"
                        : "text-slate-700 hover:bg-ms-blue/10 hover:text-slate-900"
                  } ${estAujourdhui && !estChoisie ? "ring-1 ring-ms-blue font-bold text-ms-blue" : ""}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => valider(new Date())}
              className="ms-presse flex-1 h-7 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => {
                onChange?.({ target: { value: "" } });
                fermer();
              }}
              className="ms-presse h-7 px-2.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              Effacer
            </button>
          </div>
        </div>
      </Flottant>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Menu d'actions secondaires
 * ---------------------------------------------------------------------------
 * Aligner cinq boutons au bout d'une ligne de tableau ne tient pas : la piste
 * est de largeur fixe, les boutons se compriment jusqu'à devenir des pastilles
 * illisibles et débordent sur la colonne voisine. L'action principale reste
 * visible, le reste passe derrière un bouton unique.
 * ------------------------------------------------------------------------- */

export type ActionMenu = {
  libelle: string;
  onClick: () => void;
  /** Rouge, avec un séparateur au-dessus : ce qui retire ou détruit. */
  danger?: boolean;
  desactivee?: boolean;
  /** Rappel du raccourci clavier équivalent, aligné à droite. */
  raccourci?: string;
};

/** Corps d'un menu — partagé par le bouton « ⋯ » et par le clic droit. */
const EntreesMenu = ({ actions, apres }: { actions: ActionMenu[]; apres: () => void }) => (
  <div role="menu" className="p-1">
    {actions.map((a, i) => (
      <button
        key={a.libelle}
        type="button"
        role="menuitem"
        disabled={a.desactivee}
        style={{ ["--i" as string]: i }}
        onClick={() => {
          a.onClick();
          apres();
        }}
        className={`ms-menu-item w-full flex items-center gap-2 text-left rounded-md px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40 disabled:pointer-events-none ${
          a.danger
            ? "text-red-600 hover:bg-red-50 mt-1 border-t border-slate-100 rounded-t-none pt-2"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <span className="flex-1">{a.libelle}</span>
        {/* Le raccourci est rappelé ici et nulle part ailleurs : c'est en
            ouvrant le menu qu'on apprend qu'on peut s'en passer. */}
        {a.raccourci && <span className="shrink-0 text-[10px] font-mono text-slate-400">{a.raccourci}</span>}
      </button>
    ))}
  </div>
);

export const MenuActions = ({ actions, titre = "Autres actions" }: { actions: ActionMenu[]; titre?: string }) => {
  const bouton = useRef<HTMLButtonElement>(null);
  const { ancre, ouvert, basculer, fermer } = useAncre();

  return (
    <div className="relative shrink-0">
      <button
        ref={bouton}
        type="button"
        title={titre}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={(e) => {
          e.stopPropagation();
          basculer(bouton.current);
        }}
        className={`ms-presse w-8 h-8 rounded-lg border text-[15px] leading-none transition-colors ${
          ouvert
            ? "border-slate-400 bg-slate-100 text-slate-900"
            : "border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-800 hover:bg-white"
        }`}
      >
        ⋯
      </button>

      <Flottant
        ancre={ancre}
        ouvert={ouvert}
        onFermer={fermer}
        declencheur={bouton}
        alignement="droite"
        classe="w-48"
      >
        <EntreesMenu actions={actions} apres={fermer} />
      </Flottant>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Menu contextuel
 * ---------------------------------------------------------------------------
 * Le clic droit est le geste attendu partout où l'on manipule des objets sur
 * une planche — PowerPoint, Canva, un explorateur de fichiers. Ne pas le
 * proposer oblige à remonter à la barre d'outils pour chaque action, alors même
 * que la main est déjà sur l'objet.
 * ------------------------------------------------------------------------- */

export const MenuContextuel = ({
  ancre,
  ouvert,
  onFermer,
  actions,
}: {
  ancre: Ancre | null;
  ouvert: boolean;
  onFermer: () => void;
  actions: ActionMenu[];
}) => (
  <Flottant ancre={ancre} ouvert={ouvert} onFermer={onFermer} classe="w-52">
    <EntreesMenu actions={actions} apres={onFermer} />
  </Flottant>
);

/* ---------------------------------------------------------------------------
 * Indicateurs
 * ------------------------------------------------------------------------- */

/** Tuile de chiffre-clé. La valeur bat quand elle change. */
export const Tuile = ({
  libelle,
  valeur,
  detail,
  ton = "neutre",
}: {
  libelle: string;
  valeur: string | number;
  detail?: string;
  ton?: "neutre" | "ok" | "alerte" | "bloc";
}) => {
  const couleur = {
    neutre: "text-slate-900",
    ok: "text-emerald-600",
    alerte: "text-amber-600",
    bloc: "text-red-600",
  }[ton];
  return (
    <div className="ms-carte ms-levier p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">{libelle}</p>
      <p key={String(valeur)} className={`ms-battement text-[22px] font-extrabold leading-none tabular-nums ${couleur}`}>
        {valeur}
      </p>
      {detail && <p className="mt-1 text-[10px] leading-snug text-slate-400">{detail}</p>}
    </div>
  );
};

/** Anneau de score. Le tracé se dessine à l'affichage plutôt que d'apparaître. */
export const Anneau = ({ valeur, taille = 92 }: { valeur: number; taille?: number }) => {
  const r = (taille - 10) / 2;
  const circonference = 2 * Math.PI * r;
  const ton = valeur >= 80 ? "text-emerald-500" : valeur >= 55 ? "text-amber-500" : "text-red-500";
  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }}>
      <svg viewBox={`0 0 ${taille} ${taille}`} className="-rotate-90 w-full h-full">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200" />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          className={`${ton} transition-[stroke-dashoffset] duration-900 ease-sortie`}
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - Math.max(0, Math.min(100, valeur)) / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-extrabold leading-none text-slate-900 tabular-nums">{Math.round(valeur)}</span>
        <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400">sur 100</span>
      </span>
    </div>
  );
};

/** Barre de proportion. */
export const Jauge = ({ valeur, total, ton = "bg-ms-blue" }: { valeur: number; total: number; ton?: string }) => (
  <span className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
    <span
      className={`block h-full rounded-full transition-[width] duration-500 ease-sortie ${ton}`}
      style={{ width: `${(valeur / Math.max(total, 1)) * 100}%` }}
    />
  </span>
);

/* ------------------------------------------------------------------------- */

/* La référence est transmise : un bouton peut servir d'ancre à un menu
   flottant, ce qui exige d'atteindre l'élément réel pour le mesurer. */
export const Bouton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "principal" | "neutre" | "discret" }
>(({ variante = "neutre", children, ...p }, ref) => {
  const styles = {
    principal:
      "bg-slate-900 text-white border-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.18)] hover:bg-slate-800 hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.5)] disabled:bg-slate-300 disabled:border-slate-300 disabled:shadow-none",
    neutre:
      "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 hover:shadow-[0_2px_8px_-3px_rgba(15,23,42,0.25)]",
    discret: "bg-transparent text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-100",
  }[variante];
  return (
    <button
      {...p}
      ref={ref}
      className={`ms-bouton inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
});
Bouton.displayName = "Bouton";

export const Pastille = ({ ton, children }: { ton: "ok" | "alerte" | "bloc" | "neutre"; children: ReactNode }) => {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    alerte: "bg-amber-50 text-amber-700 border-amber-200",
    bloc: "bg-red-50 text-red-700 border-red-200",
    neutre: "bg-slate-100 text-slate-600 border-slate-200",
  }[ton];
  return (
    <span
      className={`ms-insere inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${styles}`}
    >
      {children}
    </span>
  );
};

/* ---------------------------------------------------------------------------
 * Onglets
 * ---------------------------------------------------------------------------
 * Un seul indicateur, qui se déplace. La position est mesurée sur le bouton
 * actif après chaque rendu : rien n'est codé en dur, les libellés peuvent
 * changer de longueur sans dérégler l'alignement.
 * ------------------------------------------------------------------------- */

export const Onglets = <T extends string>({
  valeur,
  onChange,
  items,
  variante = "pilule",
  className = "",
}: {
  valeur: T;
  onChange: (v: T) => void;
  /* `NoInfer` : sans lui, TypeScript déduit aussi `T` du tableau de libellés et
     retombe sur `string`, ce qui laisserait passer une clé qui n'existe pas. Le
     type ne doit venir que de l'état, jamais de la liste. */
  items: [NoInfer<T>, string][];
  /** `pilule` : fond plein qui glisse. `souligne` : trait sous l'onglet. */
  variante?: "pilule" | "souligne";
  className?: string;
}) => {
  const barre = useRef<HTMLDivElement>(null);
  const [cadre, setCadre] = useState<{ x: number; l: number } | null>(null);

  useLayoutEffect(() => {
    const mesurer = () => {
      const actif = barre.current?.querySelector<HTMLElement>(`[data-cle="${valeur}"]`);
      if (!actif || !barre.current) return;
      setCadre({ x: actif.offsetLeft, l: actif.offsetWidth });
    };
    mesurer();
    // Les polices arrivent après le premier rendu : sans nouvelle mesure, le
    // curseur reste calé sur des largeurs qui n'existent plus.
    const obs = new ResizeObserver(mesurer);
    if (barre.current) obs.observe(barre.current);
    return () => obs.disconnect();
  }, [valeur, items.length]);

  const pilule = variante === "pilule";

  return (
    <div
      ref={barre}
      className={`ms-onglets flex items-center ${pilule ? "gap-1" : ""} ${className}`}
      role="tablist"
    >
      <span
        aria-hidden
        data-pret={cadre ? "1" : "0"}
        className={`ms-curseur ${
          pilule
            ? "top-0 bottom-0 rounded-lg bg-slate-900 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.55)]"
            : "bottom-0 h-[2px] rounded-full bg-slate-900"
        }`}
        style={{ transform: `translateX(${cadre?.x ?? 0}px)`, width: cadre?.l ?? 0 }}
      />
      {items.map(([cle, nom]) => {
        const actif = valeur === cle;
        return (
          <button
            key={cle}
            role="tab"
            aria-selected={actif}
            data-cle={cle}
            onClick={() => onChange(cle)}
            className={`ms-presse relative z-10 ${
              pilule
                ? "h-7 px-2.5 rounded-lg text-[11.5px] font-semibold"
                : "flex-1 h-9 text-[11px] font-bold uppercase tracking-wide"
            } transition-colors duration-150 ${
              actif
                ? pilule
                  ? "text-white"
                  : "text-slate-900"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            {nom}
          </button>
        );
      })}
    </div>
  );
};

/** Barre d'attente — remplace le mot « Chargement… » figé. */
export const Attente = ({ texte = "Chargement" }: { texte?: string }) => (
  <div className="p-6 max-w-xs">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">{texte}</p>
    <div className="ms-attente h-[3px] rounded-full" />
  </div>
);
