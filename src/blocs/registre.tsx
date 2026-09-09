import { Edt } from "./edition";
import { type Accent, type Bloc, type DefinitionBloc, type TypeBloc } from "./types";

/**
 * Registre des blocs — source unique de vérité.
 *
 * Chaque type de bloc est déclaré ici une seule fois : son rendu, ses champs
 * éditables et ses valeurs de départ. L'éditeur lit ce registre pour construire
 * sa bibliothèque et ses formulaires ; le rendu de l'article lit le même
 * registre pour afficher. Ajouter un bloc au catalogue, c'est ajouter une entrée
 * ici — et rien d'autre, nulle part ailleurs.
 */

const texteAccent: Record<Accent, string> = {
  office: "text-ms-blue",
  digital: "text-ms-pink",
  service: "text-ms-green",
};
const fondAccent: Record<Accent, string> = {
  office: "bg-ms-blue",
  digital: "bg-ms-pink",
  service: "bg-ms-green",
};
const bordAccent: Record<Accent, string> = {
  office: "border-ms-blue",
  digital: "border-ms-pink",
  service: "border-ms-green",
};

/** Récupère un champ texte en tolérant l'absence de valeur. */
const t = (b: Bloc, cle: string, defaut = "") => (b.donnees[cle] as string) ?? defaut;
const l = (b: Bloc, cle: string) => (b.donnees[cle] as string[]) ?? [];
const p = (b: Bloc, cle: string) => (b.donnees[cle] as { a: string; b: string }[]) ?? [];

/* =========================================================================
 * RENDUS
 * ======================================================================= */

const Accroche = ({ b }: { b: Bloc }) => (
  <header className="mb-10">
    <div className="flex items-center gap-3 mb-4">
      <span className={`inline-block w-10 h-[3px] ${fondAccent[b.style.accent]}`} />
      <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${texteAccent[b.style.accent]}`}>
        <Edt blocId={b.id} cle="surtitre" valeur={t(b, "surtitre")} exemple="Sur-titre" />
      </span>
    </div>
    <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight leading-[1.1] mb-4">
      <Edt blocId={b.id} cle="titre" valeur={t(b, "titre")} exemple="Un titre qui accroche" />
    </h2>
    <p className="text-base text-ms-ink/55 leading-relaxed font-medium max-w-2xl">
      <Edt blocId={b.id} cle="chapeau" valeur={t(b, "chapeau")} exemple="Une phrase d'introduction." />
    </p>
  </header>
);

const Texte = ({ b }: { b: Bloc }) => (
  <p className="text-[15px] text-ms-ink/75 leading-[1.75] mb-5">
    <Edt blocId={b.id} cle="texte" valeur={t(b, "texte")} exemple="Votre texte…" />
  </p>
);

const Citation = ({ b }: { b: Bloc }) => (
  <figure className={`my-10 border-l-[3px] ${bordAccent[b.style.accent]} pl-6 md:pl-8`}>
    <blockquote className="text-lg md:text-2xl font-extrabold text-ms-ink tracking-tight leading-snug">
      <Edt blocId={b.id} cle="texte" valeur={t(b, "texte")} exemple="Une phrase forte." />
    </blockquote>
    {(t(b, "auteur") || t(b, "role")) && (
      <figcaption className="mt-3 text-[12px] font-semibold text-ms-ink/45">
        <Edt blocId={b.id} cle="auteur" valeur={t(b, "auteur")} exemple="Auteur" />
        <span className="text-ms-ink/30"> — <Edt blocId={b.id} cle="role" valeur={t(b, "role")} exemple="Fonction" /></span>
      </figcaption>
    )}
  </figure>
);

const Chiffre = ({ b }: { b: Bloc }) => (
  <div className="my-10 flex flex-wrap gap-4">
    {(l(b, "valeurs").length ? l(b, "valeurs") : ["300+|Clients", "35+|Années"]).map((v, i) => {
      const [nombre, legende] = v.split("|");
      return (
        <div key={i} className="flex-1 min-w-[140px] rounded-2xl bg-white border border-black/5 shadow-sm p-5">
          <div className={`text-3xl md:text-4xl font-black tracking-tight ${texteAccent[b.style.accent]}`}>
            <Edt blocId={b.id} cle={`valeurs.${i}.nombre`} valeur={nombre ?? ""} exemple="300+" />
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ms-ink/45">{legende}</p>
        </div>
      );
    })}
  </div>
);

const Retenir = ({ b }: { b: Bloc }) => (
  <aside className="my-10 rounded-2xl bg-ms-paper/80 border border-black/5 p-6">
    <div className="flex items-center gap-2.5 mb-4">
      <span className={`inline-block w-6 h-[3px] ${fondAccent[b.style.accent]}`} />
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ms-ink/45">
        <Edt blocId={b.id} cle="titre" valeur={t(b, "titre")} exemple="À retenir" />
      </p>
    </div>
    <ul className="space-y-2.5">
      {(l(b, "points").length ? l(b, "points") : ["Premier point clé", "Deuxième point clé"]).map((pt, i) => (
        <li key={i} className="flex gap-3 text-[14px] text-ms-ink/75 leading-relaxed">
          <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${fondAccent[b.style.accent]}`} />
          <Edt blocId={b.id} cle={`points.${i}`} valeur={pt} exemple="Un point clé" />
        </li>
      ))}
    </ul>
  </aside>
);

const Action = ({ b }: { b: Bloc }) => (
  <aside className="relative my-12 rounded-[2rem] bg-ms-dark text-white p-8 md:p-10 overflow-hidden">
    <div className={`absolute -top-16 -right-16 w-56 h-56 rounded-full ${fondAccent[b.style.accent]} opacity-25 blur-3xl`} />
    <div className="relative">
      <h3 className="text-xl md:text-2xl font-extrabold tracking-tight mb-3 max-w-md">
        <Edt blocId={b.id} cle="titre" valeur={t(b, "titre")} exemple="Un besoin à cadrer ?" />
      </h3>
      <p className="text-[13px] text-white/55 leading-relaxed max-w-md mb-6">
        <Edt blocId={b.id} cle="texte" valeur={t(b, "texte")} exemple="Une phrase qui lève l'hésitation." />
      </p>
      <span className="inline-flex items-center px-6 py-3 rounded-full bg-white text-ms-ink font-bold text-sm">
        <Edt blocId={b.id} cle="libelle" valeur={t(b, "libelle")} exemple="Demander une démo" />
      </span>
    </div>
  </aside>
);

const Etapes = ({ b }: { b: Bloc }) => (
  <ol className="my-10 space-y-5">
    {(p(b, "etapes").length ? p(b, "etapes") : [{ a: "Auditer", b: "On part du terrain." }]).map((e, i) => (
      <li key={i} className="flex gap-4">
        <span
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black text-white ${fondAccent[b.style.accent]}`}
        >
          {i + 1}
        </span>
        <div className="pt-0.5">
          <h4 className="font-bold text-ms-ink text-[15px] mb-1">
            <Edt blocId={b.id} cle={`etapes.${i}.a`} valeur={e.a} exemple="Titre de l'étape" />
          </h4>
          <p className="text-[14px] text-ms-ink/65 leading-relaxed">
            <Edt blocId={b.id} cle={`etapes.${i}.b`} valeur={e.b} exemple="Ce qu'elle recouvre." />
          </p>
        </div>
      </li>
    ))}
  </ol>
);

const Comparatif = ({ b }: { b: Bloc }) => (
  <div className="my-10 grid sm:grid-cols-2 gap-4">
    {[
      { titre: t(b, "titreA", "Sans"), pts: l(b, "colonneA"), sombre: false },
      { titre: t(b, "titreB", "Avec"), pts: l(b, "colonneB"), sombre: true },
    ].map((col, i) => (
      <div
        key={i}
        className={`rounded-2xl p-6 border ${
          col.sombre ? `bg-white border-black/10 shadow-sm` : "bg-ms-paper/60 border-black/5"
        }`}
      >
        <h4
          className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-4 ${
            col.sombre ? texteAccent[b.style.accent] : "text-ms-ink/35"
          }`}
        >
          <Edt blocId={b.id} cle={i === 0 ? "titreA" : "titreB"} valeur={col.titre} exemple="Titre" />
        </h4>
        <ul className="space-y-2">
          {(col.pts.length ? col.pts : ["Un point"]).map((pt, j) => (
            <li key={j} className="text-[13.5px] text-ms-ink/70 leading-relaxed">
              <Edt blocId={b.id} cle={`${i === 0 ? "colonneA" : "colonneB"}.${j}`} valeur={pt} exemple="Un point" />
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

const Liste = ({ b }: { b: Bloc }) => (
  <ul className="my-8 grid sm:grid-cols-2 gap-3">
    {(l(b, "points").length ? l(b, "points") : ["Un bénéfice", "Un autre"]).map((pt, i) => (
      <li key={i} className="flex gap-3 items-start rounded-xl bg-white border border-black/5 p-3.5">
        <span
          className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-white text-[11px] font-black ${fondAccent[b.style.accent]}`}
        >
          ✓
        </span>
        <span className="text-[13.5px] text-ms-ink/75 leading-snug">
          <Edt blocId={b.id} cle={`points.${i}`} valeur={pt} exemple="Un bénéfice" />
        </span>
      </li>
    ))}
  </ul>
);

const Separateur = () => (
  <div className="my-12 flex items-center gap-2">
    <span className="w-10 h-[3px] bg-ms-blue" />
    <span className="w-10 h-[3px] bg-ms-pink" />
    <span className="w-10 h-[3px] bg-ms-green" />
  </div>
);

const RENDUS: Record<TypeBloc, (props: { b: Bloc }) => JSX.Element> = {
  accroche: Accroche,
  texte: Texte,
  citation: Citation,
  chiffre: Chiffre,
  retenir: Retenir,
  action: Action,
  etapes: Etapes,
  comparatif: Comparatif,
  liste: Liste,
  separateur: Separateur,
};

/* =========================================================================
 * DÉFINITIONS
 * ======================================================================= */

export const REGISTRE: Record<TypeBloc, DefinitionBloc> = {
  accroche: {
    nom: "Accroche",
    role: "Ouvre l'article et capte en deux secondes.",
    champs: [
      { cle: "surtitre", libelle: "Sur-titre", nature: "ligne", exemple: "Production & atelier" },
      { cle: "titre", libelle: "Titre", nature: "ligne" },
      { cle: "chapeau", libelle: "Chapeau", nature: "paragraphe" },
    ],
    defauts: () => ({
      donnees: {
        surtitre: "Sur-titre",
        titre: "Un titre qui accroche en deux secondes",
        chapeau: "Une phrase d'introduction qui donne envie de lire la suite.",
      },
      style: { accent: "office" },
    }),
  },
  texte: {
    nom: "Paragraphe",
    role: "Le fil du texte.",
    champs: [{ cle: "texte", libelle: "Texte", nature: "paragraphe" }],
    defauts: () => ({ donnees: { texte: "Votre texte…" }, style: { accent: "office" } }),
  },
  citation: {
    nom: "Citation",
    role: "Respiration forte et autorité.",
    champs: [
      { cle: "texte", libelle: "Citation", nature: "paragraphe" },
      { cle: "auteur", libelle: "Auteur", nature: "ligne", exemple: "Amel" },
      { cle: "role", libelle: "Fonction", nature: "ligne", exemple: "Direction" },
    ],
    defauts: () => ({
      donnees: { texte: "Une phrase forte, détachée du fil du texte.", auteur: "", role: "" },
      style: { accent: "digital" },
    }),
  },
  chiffre: {
    nom: "Chiffres clés",
    role: "Preuve chiffrée, très partageable.",
    champs: [{ cle: "valeurs", libelle: "Valeurs (nombre|légende)", nature: "liste" }],
    defauts: () => ({
      donnees: { valeurs: ["300+|Clients accompagnés", "35+|Années d'expertise"] },
      style: { accent: "service" },
    }),
  },
  retenir: {
    nom: "À retenir",
    role: "Résumé scannable en fin de section.",
    champs: [
      { cle: "titre", libelle: "Titre", nature: "ligne", exemple: "À retenir" },
      { cle: "points", libelle: "Points", nature: "liste" },
    ],
    defauts: () => ({
      donnees: { titre: "À retenir", points: ["Premier point clé", "Deuxième point clé"] },
      style: { accent: "office" },
    }),
  },
  action: {
    nom: "Appel à l'action",
    role: "Conversion — à placer en fin d'article.",
    champs: [
      { cle: "titre", libelle: "Titre", nature: "ligne" },
      { cle: "texte", libelle: "Texte", nature: "paragraphe" },
      { cle: "libelle", libelle: "Bouton", nature: "ligne" },
      { cle: "lien", libelle: "Lien", nature: "lien", exemple: "/#contact" },
    ],
    defauts: () => ({
      donnees: {
        titre: "Un besoin de gestion à cadrer ?",
        texte: "Chaque projet démarre par un audit de vos process réels.",
        libelle: "Demander une démo",
        lien: "/#contact",
      },
      style: { accent: "office" },
    }),
  },
  etapes: {
    nom: "Étapes numérotées",
    role: "Rend une méthode lisible d'un coup d'œil.",
    champs: [{ cle: "etapes", libelle: "Étapes", nature: "paires" }],
    defauts: () => ({
      donnees: {
        etapes: [
          { a: "Auditer", b: "On part de vos process réels." },
          { a: "Paramétrer", b: "L'outil s'adapte, pas l'inverse." },
        ],
      },
      style: { accent: "service" },
    }),
  },
  comparatif: {
    nom: "Comparatif",
    role: "Avant / après, ou eux / nous.",
    champs: [
      { cle: "titreA", libelle: "Titre colonne 1", nature: "ligne" },
      { cle: "colonneA", libelle: "Points colonne 1", nature: "liste" },
      { cle: "titreB", libelle: "Titre colonne 2", nature: "ligne" },
      { cle: "colonneB", libelle: "Points colonne 2", nature: "liste" },
    ],
    defauts: () => ({
      donnees: {
        titreA: "Sans",
        colonneA: ["Calcul annuel", "Chiffres invérifiables"],
        titreB: "Avec",
        colonneB: ["Suivi mensuel", "Écarts identifiés"],
      },
      style: { accent: "digital" },
    }),
  },
  liste: {
    nom: "Liste de bénéfices",
    role: "Format scannable, coché.",
    champs: [{ cle: "points", libelle: "Bénéfices", nature: "liste" }],
    defauts: () => ({
      donnees: { points: ["Un bénéfice concret", "Un deuxième", "Un troisième"] },
      style: { accent: "service" },
    }),
  },
  separateur: {
    nom: "Séparateur",
    role: "Respiration, signature de marque.",
    champs: [],
    defauts: () => ({ donnees: {}, style: { accent: "office" } }),
  },
};

/** Rend un bloc. Utilisé par l'aperçu de l'éditeur ET par la page publiée. */
export const RenduBloc = ({ bloc }: { bloc: Bloc }) => {
  const Composant = RENDUS[bloc.type];
  if (!Composant) return null;
  return <Composant b={bloc} />;
};

export const ORDRE_BIBLIOTHEQUE: TypeBloc[] = [
  "accroche",
  "texte",
  "citation",
  "chiffre",
  "retenir",
  "liste",
  "etapes",
  "comparatif",
  "action",
  "separateur",
];
