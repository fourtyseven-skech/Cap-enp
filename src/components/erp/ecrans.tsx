import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Écrans de démonstration de MEGA ERP.
 *
 * L'interface réelle n'étant pas disponible, ces écrans en sont une
 * reconstitution allégée : même charte que le site, même vocabulaire métier que
 * les modules réellement édités (commercial, stock, comptabilité SCF,
 * production, paie).
 *
 * Toutes les données sont fictives et volontairement anonymes — des numéros de
 * pièce, jamais un nom de client. Un mockup qui affiche de vrais noms crée une
 * ambiguïté que personne ne souhaite.
 */

export type Module = {
  cle: string;
  nom: string;
  /** Ce que le module apporte, en une phrase — affiché sous l'écran. */
  argument: string;
  Icone: () => JSX.Element;
  Ecran: () => JSX.Element;
};

const I = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full" aria-hidden="true">
    {children}
  </svg>
);

/* ---------- Briques d'écran ---------- */

const reduit = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mise en forme française : espace fine pour les milliers, virgule décimale. */
const fr = (v: number, dec: number) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/**
 * Nombre qui se compte à l'affichage.
 *
 * Un chiffre qui grimpe attire l'œil bien plus qu'un chiffre posé — c'est le
 * réflexe des tableaux de bord réels, et ça donne à la démonstration l'air de
 * charger de vraies données. Le texte non numérique (« Équilibrée ») est rendu
 * tel quel.
 */
const Compteur = ({ texte, delai = 0 }: { texte: string; delai?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Le point de code U+202F est l'espace fine insécable qui sépare les
    // milliers en français. Posée telle quelle dans la classe de caractères,
    // elle était invisible à la relecture : impossible de deviner ce que le
    // motif cherchait, ni de repérer sa disparition à un copier-coller près.
    const m = texte.match(/^([\d\s\u202F]+(?:,\d+)?)(.*)$/);
    if (!m || reduit()) {
      el.textContent = texte;
      return;
    }
    const cible = parseFloat(m[1].replace(/[\s\u202F]/g, "").replace(",", "."));
    const dec = m[1].includes(",") ? 1 : 0;
    const suite = m[2];
    const o = { v: 0 };
    el.textContent = fr(0, dec) + suite;
    const t = gsap.to(o, {
      v: cible,
      duration: 1.15,
      delay: delai,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = fr(o.v, dec) + suite;
      },
    });
    return () => {
      t.kill();
    };
  }, [texte, delai]);

  return <span ref={ref}>{texte}</span>;
};

/**
 * Le triangle de variation.
 *
 * Dessiné, et non écrit avec « ▲ » : ce caractère n'appartient pas au
 * sous-ensemble latin des polices servies par le site, il tomberait sur une
 * police de secours — un glyphe d'une autre fonte au milieu d'un chiffre se
 * voit immédiatement.
 */
const Fleche = ({ baisse }: { baisse?: boolean }) => (
  <svg viewBox="0 0 8 6" className={`w-[6px] h-[5px] fill-current ${baisse ? "rotate-180" : ""}`} aria-hidden="true">
    <path d="M4 0 8 6 0 6Z" />
  </svg>
);

const Kpi = ({
  valeur,
  libelle,
  ton = "ink",
  i = 0,
  variation,
}: {
  valeur: string;
  libelle: string;
  ton?: "ink" | "blue" | "green" | "pink";
  i?: number;
  /** Évolution par rapport à la période précédente, ex. « +8,2 % ». */
  variation?: { texte: string; baisse?: boolean };
}) => {
  const c = { ink: "text-ms-ink", blue: "text-ms-blue", green: "text-ms-green", pink: "text-ms-pink" }[ton];
  return (
    <div data-anim className="rounded-lg bg-white border border-black/5 px-2.5 md:px-3 py-2 md:py-2.5">
      <div className="flex items-baseline justify-between gap-1">
        <div className={`text-[13px] md:text-lg font-extrabold tracking-tight tabular-nums ${c}`}>
          <Compteur texte={valeur} delai={0.12 + i * 0.06} />
        </div>
        {/*
         * L'évolution, à côté du chiffre.
         *
         * C'est ce petit écart qui distingue un tableau de bord d'une maquette :
         * un chiffre seul ne dit rien, un chiffre comparé raconte un mois.
         */}
        {variation && (
          <span
            className={`inline-flex items-center gap-0.5 text-[8px] md:text-[9px] font-bold tabular-nums ${
              variation.baisse ? "text-ms-pink" : "text-ms-green"
            }`}
          >
            <Fleche baisse={variation.baisse} />
            {variation.texte}
          </span>
        )}
      </div>
      <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/40 mt-0.5 leading-tight">
        {libelle}
      </div>
    </div>
  );
};

/**
 * Une ligne de tableau.
 *
 * `masqueMobile` retire des colonnes sur écran étroit. La fenêtre de démo perd
 * la moitié de sa largeur au profit de la barre latérale : à quatre colonnes,
 * chaque cellule tombait sous les cinquante pixels et tout finissait en points
 * de suspension — un tableau où plus rien n'est lisible ne démontre rien. On
 * garde donc les colonnes qui portent l'information (la pièce, le montant, son
 * état) et on met de côté celles qui la répètent.
 */
const Ligne = ({
  cols,
  entete = false,
  masqueMobile = [],
}: {
  cols: (string | JSX.Element)[];
  entete?: boolean;
  masqueMobile?: number[];
}) => (
  <div
    data-anim
    className={`grid gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 grid-cols-[repeat(var(--cols-mobile),minmax(0,1fr))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] ${
      entete ? "border-b border-black/10" : "border-b border-black/[0.04]"
    }`}
    style={
      {
        "--cols": cols.length,
        "--cols-mobile": cols.length - masqueMobile.length,
      } as React.CSSProperties
    }
  >
    {cols.map((c, i) => (
      <span
        key={i}
        className={`truncate ${masqueMobile.includes(i) ? "hidden sm:block" : ""} ${
          entete
            ? "text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/35"
            : "text-[9px] md:text-[10.5px] text-ms-ink/70"
        }`}
      >
        {c}
      </span>
    ))}
  </div>
);

const Etat = ({ texte, ton }: { texte: string; ton: "ok" | "attente" | "alerte" }) => {
  const c = {
    ok: "bg-ms-green/10 text-ms-green",
    attente: "bg-ms-blue/10 text-ms-blue",
    alerte: "bg-ms-pink/10 text-ms-pink",
  }[ton];
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-bold ${c}`}>{texte}</span>;
};

const Barre = ({ pct, ton = "blue" }: { pct: number; ton?: "blue" | "green" | "pink" }) => {
  const c = { blue: "bg-ms-blue", green: "bg-ms-green", pink: "bg-ms-pink" }[ton];
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
        {/* La barre pousse depuis zéro : l'animation part de `width: 0` et
            s'arrête sur la largeur posée en style — voir index.css. */}
        <span
          className={`block h-full rounded-full ${c}`}
          style={{ width: `${pct}%`, animation: "erp-barre 900ms cubic-bezier(0.22,1,0.36,1) both" }}
        />
      </span>
      <span className="text-[8px] md:text-[9px] font-bold text-ms-ink/40 tabular-nums">{pct}%</span>
    </span>
  );
};

const Titre = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <div data-anim className="flex items-baseline justify-between mb-2.5">
    <h4 className="text-[11px] md:text-[13px] font-extrabold text-ms-ink tracking-tight">{children}</h4>
    {note && <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/30">{note}</span>}
  </div>
);

/* ---------- Les cinq écrans ---------- */

/** Les douze mois de l'exercice, initiale seule — l'axe doit rester discret. */
const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Chiffre d'affaires mensuel, en pourcentage du meilleur mois. */
const CA_MENSUEL = [38, 52, 44, 61, 55, 72, 66, 84, 78, 91, 86, 100];

/**
 * Le tableau de bord.
 *
 * ⚠️ CE QUI FAISAIT « MAQUETTE », ET CE QU'IL NE FAUT PAS DÉFAIRE.
 *
 * Il ne portait que quatre chiffres et douze rectangles nus, puis un tiers de
 * la fenêtre restait vide. Trois manques précis en étaient la cause :
 *
 *  · l'histogramme n'avait ni ligne de base, ni graduation, ni mois — un
 *    graphique sans repères n'est pas un graphique, c'est un motif ;
 *  · les chiffres n'étaient comparés à rien, alors qu'un tableau de bord existe
 *    pour montrer une évolution ;
 *  · le vide sous le graphique disait « écran de démonstration ». Un vrai
 *    tableau de bord est dense : il montre le chiffre ET ce qui l'explique.
 *
 * D'où l'axe, les variations, et la colonne des dernières pièces à droite.
 */
const Tableau = () => (
  <>
    <Titre note="Exercice en cours">Tableau de bord</Titre>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
      <Kpi valeur="14,2 M" libelle="CA du mois" ton="blue" i={0} variation={{ texte: "8,2 %" }} />
      <Kpi valeur="23,4 %" libelle="Marge brute" ton="green" i={1} variation={{ texte: "1,4 pt" }} />
      <Kpi valeur="187" libelle="Commandes" i={2} variation={{ texte: "12" }} />
      <Kpi valeur="9" libelle="Stocks critiques" ton="pink" i={3} variation={{ texte: "3", baisse: true }} />
    </div>

    <div className="grid gap-2 md:grid-cols-5">
      {/* --- Le graphique, avec ses repères --- */}
      {/* `flex flex-col` + `flex-1` sur la zone tracée : les deux panneaux de la
          rangée sont étirés à la même hauteur, et sans cela le graphique gardait
          sa hauteur fixe en laissant du blanc sous son axe. */}
      <div data-anim className="md:col-span-3 rounded-lg bg-white border border-black/5 p-2.5 md:p-3 flex flex-col">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/40">
            Chiffre d'affaires — 12 derniers mois
          </span>
          <span className="text-[8px] md:text-[9px] font-bold text-ms-ink/50 tabular-nums">
            Cumul 142 M
          </span>
        </div>

        <div className="relative flex-1 min-h-[4rem] md:min-h-[4.75rem]">
          {/* Les graduations : trois filets, dont la ligne de base. Sans elles,
              les colonnes flottent et rien ne dit ce qu'elles mesurent. */}
          {[0, 50, 100].map((y) => (
            <span
              key={y}
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-black/[0.07]"
              style={{ bottom: `${y}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-[3px] md:gap-1.5">
            {CA_MENSUEL.map((h, i) => {
              const dernier = i === CA_MENSUEL.length - 1;
              return (
                <span key={i} className="relative flex-1 h-full flex items-end">
                  {/* Le mois en cours porte sa valeur : c'est le chiffre qu'on
                      vient lire, il ne doit pas se déduire de la hauteur. */}
                  {dernier && (
                    <span
                      data-anim
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-1 py-px rounded bg-ms-blue text-white text-[7px] md:text-[8px] font-bold tabular-nums whitespace-nowrap"
                    >
                      14,2 M
                    </span>
                  )}
                  <span
                    className={`w-full rounded-t origin-bottom ${
                      dernier ? "bg-ms-blue" : i > 8 ? "bg-ms-blue/70" : "bg-ms-blue/25"
                    }`}
                    style={{
                      height: `${dernier ? h - 16 : h}%`,
                      animation: "erp-colonne 620ms cubic-bezier(0.22,1,0.36,1) both",
                      animationDelay: `${0.18 + i * 0.045}s`,
                    }}
                  />
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex gap-[3px] md:gap-1.5 mt-1 border-t border-black/5 pt-1">
          {MOIS.map((m, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[7px] md:text-[8px] font-bold tabular-nums ${
                i === MOIS.length - 1 ? "text-ms-blue" : "text-ms-ink/25"
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* --- Ce qui explique le chiffre : les dernières pièces --- */}
      <div data-anim className="md:col-span-2 rounded-lg bg-white border border-black/5 overflow-hidden flex flex-col">
        <div className="px-2.5 md:px-3 pt-2 pb-1.5 flex items-baseline justify-between">
          <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/40">
            Dernières pièces
          </span>
          <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-ms-ink/25">
            Aujourd'hui
          </span>
        </div>
        {[
          ["FA-2026-0913", "1 975 000", <Etat key="a" texte="Échue" ton="alerte" />],
          ["BC-2026-0187", "1 240 000", <Etat key="b" texte="Livré" ton="ok" />],
          ["FA-2026-0912", "845 000", <Etat key="c" texte="Réglée" ton="ok" />],
          ["DV-2026-0455", "3 100 000", <Etat key="d" texte="En attente" ton="attente" />],
        ].map((c, i) => (
          <Ligne key={i} cols={c as (string | JSX.Element)[]} />
        ))}
        <p className="px-2.5 md:px-3 py-1.5 mt-auto text-[8px] md:text-[9px] text-ms-ink/35 leading-snug">
          Mises à jour à la validation, sans traitement de nuit.
        </p>
      </div>
    </div>
  </>
);

const Commercial = () => (
  <>
    <Titre note="Cycle de vente">Commercial</Titre>
    <div className="rounded-lg bg-white border border-black/5 overflow-hidden">
      <Ligne entete masqueMobile={[1]} cols={["Pièce", "Type", "Montant", "État"]} />
      {[
        ["BC-2026-0187", "Bon de commande", "1 240 000", <Etat key="a" texte="Livré" ton="ok" />],
        ["FA-2026-0912", "Facture", "845 000", <Etat key="b" texte="Réglée" ton="ok" />],
        ["DV-2026-0455", "Devis", "3 100 000", <Etat key="c" texte="En attente" ton="attente" />],
        ["BL-2026-0733", "Bon de livraison", "612 000", <Etat key="d" texte="Partiel" ton="alerte" />],
        ["FA-2026-0913", "Facture", "1 975 000", <Etat key="e" texte="Échue" ton="alerte" />],
      ].map((c, i) => (
        <Ligne key={i} cols={c as (string | JSX.Element)[]} />
      ))}
    </div>
    <p data-anim className="mt-2.5 text-[9px] md:text-[10px] text-ms-ink/45 leading-snug">
      Du devis au règlement, sans ressaisie : chaque pièce en engendre une autre.
    </p>
  </>
);

const Stocks = () => (
  <>
    <Titre note="Temps réel">Stocks & approvisionnement</Titre>
    <div className="grid grid-cols-3 gap-2 mb-3">
      <Kpi valeur="4 812" libelle="Références" i={0} />
      <Kpi valeur="96,3 %" libelle="Fiabilité inventaire" ton="green" i={1} />
      <Kpi valeur="9" libelle="Sous le seuil" ton="pink" i={2} />
    </div>
    <div className="rounded-lg bg-white border border-black/5 overflow-hidden">
      <Ligne entete cols={["Référence", "Dépôt", "Couverture"]} />
      {[
        ["ART-40128", "Alger — Central", <Barre key="a" pct={82} ton="green" />],
        ["ART-40915", "Oran", <Barre key="b" pct={46} />],
        ["ART-41302", "Alger — Central", <Barre key="c" pct={14} ton="pink" />],
        ["ART-41877", "Constantine", <Barre key="d" pct={67} ton="green" />],
      ].map((c, i) => (
        <Ligne key={i} cols={c as (string | JSX.Element)[]} />
      ))}
    </div>
  </>
);

const Comptabilite = () => (
  <>
    <Titre note="Conforme SCF">Comptabilité</Titre>
    <div className="grid grid-cols-3 gap-2 mb-3">
      <Kpi valeur="Équilibrée" libelle="Balance générale" ton="green" />
      <Kpi valeur="1 204" libelle="Écritures du mois" i={1} />
      <Kpi valeur="0" libelle="Anomalies" ton="green" />
    </div>
    <div className="rounded-lg bg-white border border-black/5 overflow-hidden">
      <Ligne entete masqueMobile={[1]} cols={["Compte", "Libellé", "Débit", "Crédit"]} />
      {[
        ["411000", "Clients", "2 840 000", "—"],
        ["701000", "Ventes de marchandises", "—", "2 386 555"],
        ["445700", "TVA collectée", "—", "453 445"],
        ["512000", "Banque", "845 000", "—"],
      ].map((c, i) => (
        <Ligne key={i} cols={c} />
      ))}
    </div>
    <p data-anim className="mt-2.5 text-[9px] md:text-[10px] text-ms-ink/45 leading-snug">
      Plan comptable SCF, états fiscaux et liasse aux normes IAS/IFRS.
    </p>
  </>
);

const Production = () => (
  <>
    <Titre note="Atelier connecté">Production</Titre>
    <div className="grid grid-cols-3 gap-2 mb-3">
      <Kpi valeur="87 %" libelle="Taux de rendement" ton="blue" i={0} />
      <Kpi valeur="12" libelle="OF en cours" i={1} />
      <Kpi valeur="1,8 %" libelle="Rebuts" ton="green" i={2} />
    </div>
    <div className="rounded-lg bg-white border border-black/5 overflow-hidden">
      <Ligne entete cols={["Ordre", "Ligne", "Avancement"]} />
      {[
        ["OF-2026-0341", "Ligne 1", <Barre key="a" pct={94} ton="green" />],
        ["OF-2026-0342", "Ligne 2", <Barre key="b" pct={61} />],
        ["OF-2026-0343", "Ligne 1", <Barre key="c" pct={28} />],
        ["OF-2026-0344", "Ligne 3", <Barre key="d" pct={7} ton="pink" />],
      ].map((c, i) => (
        <Ligne key={i} cols={c as (string | JSX.Element)[]} />
      ))}
    </div>
  </>
);

const Paie = () => (
  <>
    <Titre note="Période close">Paie & ressources humaines</Titre>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      <Kpi valeur="342" libelle="Bulletins" ton="blue" i={0} />
      <Kpi valeur="18,7 M" libelle="Masse salariale" i={1} />
      <Kpi valeur="100 %" libelle="Déclarations" ton="green" i={2} />
      <Kpi valeur="0" libelle="Rejets" ton="green" />
    </div>
    <div className="rounded-lg bg-white border border-black/5 overflow-hidden">
      <Ligne entete cols={["Matricule", "Service", "Statut"]} />
      {[
        ["MAT-1042", "Production", <Etat key="a" texte="Validé" ton="ok" />],
        ["MAT-1156", "Commercial", <Etat key="b" texte="Validé" ton="ok" />],
        ["MAT-1207", "Administration", <Etat key="c" texte="À valider" ton="attente" />],
        ["MAT-1288", "Logistique", <Etat key="d" texte="Validé" ton="ok" />],
      ].map((c, i) => (
        <Ligne key={i} cols={c as (string | JSX.Element)[]} />
      ))}
    </div>
  </>
);

/* ---------- Le catalogue ---------- */

export const MODULES: Module[] = [
  {
    cle: "tableau",
    nom: "Tableau de bord",
    argument: "Vos indicateurs consolidés en temps réel, sans export ni tableur intermédiaire.",
    Icone: () => (
      <I>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
      </I>
    ),
    Ecran: Tableau,
  },
  {
    cle: "commercial",
    nom: "Commercial",
    argument: "Du devis au règlement : chaque pièce engendre la suivante, sans une seule ressaisie.",
    Icone: () => (
      <I>
        <path d="M3 5h2l2.2 10.5h10.4L20 8H6.4" />
        <circle cx="9.5" cy="19" r="1.4" />
        <circle cx="17.5" cy="19" r="1.4" />
      </I>
    ),
    Ecran: Commercial,
  },
  {
    cle: "stocks",
    nom: "Stocks",
    argument: "Niveaux, seuils et couverture par dépôt — l'alerte tombe avant la rupture.",
    Icone: () => (
      <I>
        <path d="M12 2.8l8.5 4.4v9.6L12 21.2 3.5 16.8V7.2z" />
        <path d="M3.5 7.2L12 11.6l8.5-4.4M12 11.6v9.6" />
      </I>
    ),
    Ecran: Stocks,
  },
  {
    cle: "compta",
    nom: "Comptabilité",
    argument: "Plan comptable SCF, états fiscaux et liasse aux normes IAS/IFRS, générés depuis vos écritures.",
    Icone: () => (
      <I>
        <rect x="4" y="2.8" width="16" height="18.4" rx="2.2" />
        <path d="M8 7.5h8M8 11.5h8M8 15.5h4.5" />
      </I>
    ),
    Ecran: Comptabilite,
  },
  {
    cle: "production",
    nom: "Production",
    argument: "L'atelier remonte ce qu'il fait vraiment : rendement, aléas et rebuts deviennent mesurables.",
    Icone: () => (
      <I>
        <path d="M3 20.2V10l5.5 3.6V10L14 13.6V10l7 4.4v5.8z" />
        <path d="M3 20.2h18" />
      </I>
    ),
    Ecran: Production,
  },
  {
    cle: "paie",
    nom: "Paie & RH",
    argument: "Bulletins, déclarations périodiques et suivi des carrières, pour le privé comme pour le public.",
    Icone: () => (
      <I>
        <circle cx="9" cy="8" r="3.4" />
        <path d="M2.8 20.2a6.2 6.2 0 0 1 12.4 0" />
        <path d="M16.2 5.2a3.4 3.4 0 0 1 0 5.6M17.6 20.2a6.2 6.2 0 0 0-2.2-4.8" />
      </I>
    ),
    Ecran: Paie,
  },
];
