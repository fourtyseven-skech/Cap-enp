import { useMemo, useState } from "react";
import { formatDate, tousLesArticles, type Post } from "@/lib/blog";
import { FORMATS, type Format } from "@/lib/formats";
import { Anneau, Bouton, Jauge, Liste, Onglets, Panneau, Pastille, Saisie, Tuile } from "./ui";
import { relatif } from "./dates";

/**
 * Diagnostic éditorial et référencement.
 *
 * Tout est calculé à partir des articles eux-mêmes, sans outil externe ni
 * serveur. L'intérêt : ces défauts sont invisibles article par article et ne se
 * voient qu'à l'échelle du blog — un article orphelin, une cadence qui
 * s'effondre, deux textes qui se disputent le même mot-clé.
 *
 * L'écran est organisé comme une console de suivi et non comme un rapport :
 * un score, ce qui l'entame, et pour chaque défaut la liste exacte des pages
 * concernées. Un diagnostic qui énonce un problème sans dire OÙ il se trouve
 * oblige à refaire l'enquête à la main — c'est ce qui les fait abandonner.
 */

const JOUR = 24 * 3600 * 1000;
const MOIS = 30 * JOUR;

type Gravite = "bloquant" | "corriger" | "conseil";

type Controle = { libelle: string; ok: boolean; detail?: string; poids: number };

/* ---------------------------------------------------------------------------
 * Contrôles par article
 * ------------------------------------------------------------------------- */

const controler = (p: Post): Controle[] => {
  const mots = (p.corps ?? "").trim().split(/\s+/).filter(Boolean).length;
  const min = Math.max(1, Math.round(mots / 200));
  const [ci, cx] = p.spec.minutes;
  const liensInternes = ((p.corps ?? "").match(/\]\(\/(?!\/)/g) ?? []).length;
  const images = ((p.corps ?? "").match(/!\[[^\]]*\]\(/g) ?? []).length;
  const intertitres = ((p.corps ?? "").match(/^##\s/gm) ?? []).length;

  const l: Controle[] = [
    { libelle: "Titre ≤ 60 caractères", ok: (p.titre?.length ?? 0) <= 60, detail: `${p.titre?.length ?? 0}`, poids: 2 },
    {
      libelle: "Description 120–160",
      ok: (p.meta_description?.length ?? 0) >= 120 && (p.meta_description?.length ?? 0) <= 160,
      detail: `${p.meta_description?.length ?? 0}`,
      poids: 3,
    },
    { libelle: "≥ 2 questions fréquentes", ok: (p.faq?.length ?? 0) >= 2, detail: `${p.faq?.length ?? 0}`, poids: 2 },
    { libelle: "≥ 1 lien interne", ok: liensInternes >= 1, detail: `${liensInternes}`, poids: 3 },
    { libelle: `Longueur ${ci}–${cx} min`, ok: min >= ci && min <= cx, detail: `${min} min`, poids: 2 },
    { libelle: "Mot en filigrane", ok: !!p.titre_fantome, poids: 1 },
    { libelle: "≥ 2 intertitres", ok: intertitres >= 2, detail: `${intertitres}`, poids: 2 },
    { libelle: "≥ 1 illustration", ok: images >= 1, detail: `${images}`, poids: 1 },
  ];

  if (p.spec.reponseRapide) {
    l.push({ libelle: "Encadré « En bref »", ok: (p.reponse?.trim().length ?? 0) >= 40, poids: 3 });
  }
  return l;
};

/** Note sur 100, pondérée : tous les manques ne coûtent pas la même chose. */
const noter = (c: Controle[]) => {
  const total = c.reduce((s, x) => s + x.poids, 0);
  const obtenu = c.reduce((s, x) => s + (x.ok ? x.poids : 0), 0);
  return total ? Math.round((obtenu / total) * 100) : 100;
};

/* ------------------------------------------------------------------------- */

const Diagnostic = () => {
  const [gravite, setGravite] = useState<Gravite | "tout">("tout");
  const [recherche, setRecherche] = useState("");
  const [triArticles, setTriArticles] = useState<"score" | "titre" | "date">("score");
  const [deplie, setDeplie] = useState<string | null>(null);

  const d = useMemo(() => {
    const publies = tousLesArticles.filter((p) => p.statut === "publie");
    const maintenant = Date.now();

    // Maillage : qui pointe vers qui.
    const entrants = new Map<string, number>();
    publies.forEach((p) => entrants.set(p.slug, 0));
    publies.forEach((p) => {
      publies.forEach((q) => {
        if (p.slug !== q.slug && (p.corps ?? "").includes(`/blog/${q.slug}/`)) {
          entrants.set(q.slug, (entrants.get(q.slug) ?? 0) + 1);
        }
      });
    });
    const orphelins = publies.filter((p) => (entrants.get(p.slug) ?? 0) === 0);

    const perimes = publies.filter((p) => maintenant - new Date(p.maj_le ?? p.publie_le).getTime() > 12 * MOIS);

    const parFormat = {} as Record<Format, number>;
    (Object.keys(FORMATS) as Format[]).forEach((f) => (parFormat[f] = 0));
    publies.forEach((p) => (parFormat[p.format] = (parFormat[p.format] ?? 0) + 1));

    // Cadence sur douze mois : six mois ne suffisent pas à distinguer un creux
    // saisonnier d'un décrochage réel.
    const cadence = Array.from({ length: 12 }, (_, i) => {
      const debut = new Date();
      debut.setMonth(debut.getMonth() - (11 - i), 1);
      debut.setHours(0, 0, 0, 0);
      const fin = new Date(debut);
      fin.setMonth(fin.getMonth() + 1);
      return {
        cle: `${debut.getFullYear()}-${debut.getMonth()}`,
        mois: debut.toLocaleDateString("fr-FR", { month: "narrow" }),
        infobulle: debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        n: publies.filter((p) => {
          const t = new Date(p.publie_le).getTime();
          return t >= debut.getTime() && t < fin.getTime();
        }).length,
      };
    });

    const etiquettes = new Map<string, string[]>();
    publies.forEach((p) =>
      (p.etiquettes ?? []).forEach((e) => etiquettes.set(e, [...(etiquettes.get(e) ?? []), p.slug]))
    );
    const doublons = [...etiquettes.entries()].filter(([, s]) => s.length >= 3);

    const parRubrique = new Map<string, number>();
    publies.forEach((p) => parRubrique.set(p.categorie, (parRubrique.get(p.categorie) ?? 0) + 1));
    const maigres = [...parRubrique.entries()].filter(([, n]) => n === 1);

    const maquettes = publies.filter((p) => p.maquette);

    // Adresses en double : deux articles à la même adresse se remplacent.
    const vus = new Set<string>();
    const collisions: string[] = [];
    publies.forEach((p) => {
      if (vus.has(p.slug)) collisions.push(p.slug);
      vus.add(p.slug);
    });

    const audits = publies.map((p) => {
      const c = controler(p);
      return { p, controles: c, score: noter(c), manques: c.filter((x) => !x.ok) };
    });

    const suggestions = orphelins.map((o) => {
      const candidats = publies
        .filter((c) => c.slug !== o.slug && !(c.corps ?? "").includes(`/blog/${o.slug}/`))
        .map((c) => {
          const communes = (c.etiquettes ?? []).filter((e) => (o.etiquettes ?? []).includes(e));
          return { c, score: communes.length * 2 + (c.categorie === o.categorie ? 1 : 0), communes };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
      return { orphelin: o, candidats };
    });

    /* --------- Défauts structurels, classés par gravité --------- */
    type Defaut = {
      cle: string;
      gravite: Gravite;
      titre: string;
      explication: string;
      correctif: string;
      pages: { slug: string; titre: string }[];
      cout: number;
    };

    const defauts: Defaut[] = [];
    const nommer = (s: string) => publies.find((p) => p.slug === s);

    if (collisions.length) {
      defauts.push({
        cle: "collisions",
        gravite: "bloquant",
        titre: "Adresses en double",
        explication:
          "Deux articles publiés partagent la même adresse. Le second écrase le premier à la construction du site : un article disparaît sans message d'erreur.",
        correctif: "Changez l'adresse de l'un des deux avant la prochaine mise en ligne.",
        pages: collisions.map((s) => ({ slug: s, titre: nommer(s)?.titre ?? s })),
        cout: 20,
      });
    }
    if (maquettes.length) {
      defauts.push({
        cle: "maquettes",
        gravite: "bloquant",
        titre: "Articles de maquette encore publiés",
        explication:
          "Leur contenu n'a pas été validé par la Direction. Ils sont pourtant visibles du public et indexables comme n'importe quelle autre page.",
        correctif: "Faites valider le texte, ou repassez-les en brouillon depuis l'onglet Articles.",
        pages: maquettes.map((p) => ({ slug: p.slug, titre: p.titre })),
        cout: 15,
      });
    }
    if (orphelins.length) {
      defauts.push({
        cle: "orphelins",
        gravite: "corriger",
        titre: "Articles orphelins",
        explication:
          "Aucun autre article ne pointe vers eux. Les moteurs les jugent secondaires, les explorent moins souvent, et leur accordent moins de poids qu'aux pages citées.",
        correctif: "Ajoutez un lien depuis un article proche — les correctifs prêts à coller sont plus bas.",
        pages: orphelins.map((p) => ({ slug: p.slug, titre: p.titre })),
        cout: 12,
      });
    }
    if (perimes.length) {
      defauts.push({
        cle: "perimes",
        gravite: "corriger",
        titre: "Contenus non mis à jour depuis plus d'un an",
        explication:
          "La fraîcheur est un critère de sélection direct pour les moteurs génératifs : à contenu égal, ils citent la page la plus récemment entretenue.",
        correctif: "Relisez, actualisez les chiffres, et réenregistrez : la date de modification suffit à relancer l'exploration.",
        pages: perimes.map((p) => ({ slug: p.slug, titre: p.titre })),
        cout: 10,
      });
    }
    if (doublons.length) {
      defauts.push({
        cle: "cannibalisation",
        gravite: "corriger",
        titre: "Risque de cannibalisation",
        explication: `Plusieurs articles visent les mêmes mots-clés (${doublons
          .map(([e]) => e)
          .join(", ")}) et se concurrencent entre eux : les moteurs en choisissent un et diluent les autres.`,
        correctif: "Fusionnez-en deux, ou différenciez nettement l'angle et les étiquettes.",
        pages: doublons.flatMap(([, slugs]) => slugs.map((s) => ({ slug: s, titre: nommer(s)?.titre ?? s }))),
        cout: 8,
      });
    }
    if (maigres.length) {
      defauts.push({
        cle: "rubriques",
        gravite: "conseil",
        titre: "Rubriques à un seul article",
        explication:
          "Une page de rubrique isolée n'a pas assez de matière pour se positionner, et donne au visiteur l'impression d'un blog inachevé.",
        correctif: `Visez trois articles minimum par rubrique : ${maigres.map(([r]) => r).join(", ")}.`,
        pages: [],
        cout: 5,
      });
    }

    const faibles = audits.filter((a) => a.score < 70);
    if (faibles.length) {
      defauts.push({
        cle: "qualite",
        gravite: "conseil",
        titre: "Articles sous 70 sur 100",
        explication:
          "Description absente ou hors gabarit, pas de questions fréquentes, pas d'intertitres : chacun de ces manques coûte peu isolément, mais ils s'additionnent sur la même page.",
        correctif: "Reprenez-les depuis l'audit détaillé, plus bas — les manques y sont listés un à un.",
        pages: faibles.map((a) => ({ slug: a.p.slug, titre: a.p.titre })),
        cout: 6,
      });
    }

    const moyenne = audits.length ? audits.reduce((s, a) => s + a.score, 0) / audits.length : 100;
    const penalite = defauts.reduce((s, x) => s + x.cout, 0);
    const score = Math.max(0, Math.min(100, Math.round(moyenne - penalite)));

    const dernier = publies
      .map((p) => new Date(p.publie_le).getTime())
      .sort((a, b) => b - a)[0];
    const depuisDernier = dernier ? Math.round((maintenant - dernier) / JOUR) : null;

    const motsMoyens = audits.length
      ? Math.round(
          publies.reduce((s, p) => s + (p.corps ?? "").trim().split(/\s+/).filter(Boolean).length, 0) /
            publies.length
        )
      : 0;

    const liensMoyens = publies.length
      ? Math.round(([...entrants.values()].reduce((s, n) => s + n, 0) / publies.length) * 10) / 10
      : 0;

    return {
      publies,
      audits,
      defauts,
      score,
      parFormat,
      cadence,
      suggestions,
      entrants,
      depuisDernier,
      motsMoyens,
      liensMoyens,
      orphelins,
      perimes,
    };
  }, []);

  const total = d.publies.length;
  const defautsVus = d.defauts.filter((x) => gravite === "tout" || x.gravite === gravite);

  const auditsAffiches = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtres = d.audits.filter(
      (a) => !q || a.p.titre.toLowerCase().includes(q) || a.p.slug.toLowerCase().includes(q)
    );
    const ordres = {
      score: (a: typeof filtres[number], b: typeof filtres[number]) => a.score - b.score,
      titre: (a: typeof filtres[number], b: typeof filtres[number]) => a.p.titre.localeCompare(b.p.titre, "fr"),
      date: (a: typeof filtres[number], b: typeof filtres[number]) =>
        (b.p.maj_le ?? b.p.publie_le).localeCompare(a.p.maj_le ?? a.p.publie_le),
    };
    return [...filtres].sort(ordres[triArticles]);
  }, [d.audits, recherche, triArticles]);

  const TONS: Record<Gravite, { pastille: "bloc" | "alerte" | "neutre"; bord: string; mot: string }> = {
    bloquant: { pastille: "bloc", bord: "border-red-200 bg-red-50/60", mot: "Bloquant" },
    corriger: { pastille: "alerte", bord: "border-amber-200 bg-amber-50/60", mot: "À corriger" },
    conseil: { pastille: "neutre", bord: "border-slate-200 bg-white", mot: "Conseil" },
  };

  const compter = (g: Gravite) => d.defauts.filter((x) => x.gravite === g).length;
  const maxCadence = Math.max(1, ...d.cadence.map((m) => m.n));

  return (
    <div className="max-w-[1500px] mx-auto p-4 space-y-4">
      {/* ---------- Bandeau de score ---------- */}
      <div className="ms-carte ms-entre p-4 flex flex-wrap items-center gap-5">
        <Anneau valeur={d.score} />
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-[15px] font-extrabold text-slate-900 leading-tight">
            {d.score >= 80
              ? "Le blog est en bon état."
              : d.score >= 55
                ? "Le blog tient, mais laisse des points au sol."
                : "Le blog perd de la visibilité sur des défauts évitables."}
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug text-slate-500 max-w-2xl">
            Note calculée sur la conformité moyenne des {total} articles publiés, diminuée des défauts
            structurels ci-dessous. Elle ne mesure pas la qualité de l'écriture — seulement ce qui,
            mécaniquement, empêche un bon article d'être trouvé et cité.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {compter("bloquant") > 0 && <Pastille ton="bloc">{compter("bloquant")} bloquant(s)</Pastille>}
            {compter("corriger") > 0 && <Pastille ton="alerte">{compter("corriger")} à corriger</Pastille>}
            {compter("conseil") > 0 && <Pastille ton="neutre">{compter("conseil")} conseil(s)</Pastille>}
            {d.defauts.length === 0 && <Pastille ton="ok">Aucun défaut structurel</Pastille>}
          </div>
        </div>
      </div>

      {/* ---------- Chiffres-clés ---------- */}
      <div className="ms-cascade grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tuile libelle="Articles publiés" valeur={total} detail={`${d.motsMoyens} mots en moyenne`} />
        <Tuile
          libelle="Dernière parution"
          valeur={d.depuisDernier === null ? "—" : `${d.depuisDernier} j`}
          ton={d.depuisDernier !== null && d.depuisDernier > 45 ? "alerte" : "ok"}
          detail="Un blog silencieux perd sa fréquence d'exploration"
        />
        <Tuile
          libelle="Liens entrants"
          valeur={d.liensMoyens}
          ton={d.liensMoyens < 1 ? "alerte" : "ok"}
          detail="Moyenne par article"
        />
        <Tuile
          libelle="Orphelins"
          valeur={d.orphelins.length}
          ton={d.orphelins.length > 0 ? "alerte" : "ok"}
          detail="Cités par aucun autre article"
        />
        <Tuile
          libelle="À rafraîchir"
          valeur={d.perimes.length}
          ton={d.perimes.length > 0 ? "alerte" : "ok"}
          detail="Sans mise à jour depuis un an"
        />
      </div>

      {/* ---------- Défauts ---------- */}
      <Panneau
        titre="Ce qui freine la visibilité"
        action={
          <Onglets
            valeur={gravite}
            onChange={(v) => setGravite(v)}
            items={[
              ["tout", `Tout (${d.defauts.length})`],
              ["bloquant", `Bloquant (${compter("bloquant")})`],
              ["corriger", `À corriger (${compter("corriger")})`],
              ["conseil", `Conseil (${compter("conseil")})`],
            ]}
          />
        }
      >
        {defautsVus.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-slate-400">
            {d.defauts.length === 0
              ? "Aucun défaut structurel détecté."
              : "Aucun défaut de cette gravité."}
          </p>
        ) : (
          <div key={gravite} className="ms-cascade space-y-2">
            {defautsVus.map((x) => {
              const t = TONS[x.gravite];
              const ouvert = deplie === x.cle;
              return (
                <div key={x.cle} className={`rounded-lg border ${t.bord}`}>
                  <button
                    onClick={() => setDeplie(ouvert ? null : x.cle)}
                    className="w-full flex items-center gap-2.5 p-2.5 text-left"
                  >
                    <Pastille ton={t.pastille}>{t.mot}</Pastille>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] font-bold text-slate-800">{x.titre}</span>
                      <span className="block text-[11px] leading-snug text-slate-600 mt-0.5">{x.explication}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-2">
                      {x.pages.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">{x.pages.length} page(s)</span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400">−{x.cout} pts</span>
                      <svg
                        viewBox="0 0 12 12"
                        aria-hidden
                        className="ms-chevron w-3 h-3 text-slate-400"
                        data-ouvert={ouvert ? "1" : "0"}
                      >
                        <path
                          d="M2.5 4.5 6 8l3.5-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  <div className="ms-repli" data-ouvert={ouvert ? "1" : "0"}>
                    <div>
                      <div className="px-2.5 pb-2.5">
                        <p className="text-[11px] leading-snug text-slate-700 mb-2 pt-2 border-t border-slate-200/70">
                          <strong>Correctif — </strong>
                          {x.correctif}
                        </p>
                        {x.pages.length > 0 && (
                          <ul className="grid sm:grid-cols-2 gap-1">
                            {x.pages.map((pg, i) => (
                              <li
                                key={`${pg.slug}-${i}`}
                                className="flex items-center gap-2 rounded-md bg-white/70 border border-slate-200 px-2 py-1"
                              >
                                <span className="flex-1 min-w-0 text-[11px] text-slate-700 truncate">{pg.titre}</span>
                                <code className="shrink-0 text-[9.5px] font-mono text-slate-400">{pg.slug}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panneau>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ---------- Cadence ---------- */}
        <Panneau titre="Cadence de publication — 12 mois">
          <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
            Ce n'est pas le volume qui compte mais la régularité : un blog qui publie deux fois par mois sans
            interruption est exploré bien plus souvent qu'un blog qui publie dix articles puis se tait six mois.
          </p>
          <div className="flex items-end gap-1 h-24">
            {d.cadence.map((m) => (
              <div key={m.cle} className="flex-1 flex flex-col items-center gap-1 group" title={`${m.infobulle} — ${m.n}`}>
                <span className="text-[9.5px] font-mono text-slate-400">{m.n || ""}</span>
                <span
                  className={`w-full rounded-t transition-all duration-500 ease-sortie group-hover:opacity-80 ${
                    m.n === 0 ? "bg-slate-200" : "bg-ms-blue"
                  }`}
                  style={{ height: `${Math.max((m.n / maxCadence) * 62, 3)}px` }}
                />
                <span className="text-[9px] uppercase text-slate-400">{m.mois}</span>
              </div>
            ))}
          </div>
        </Panneau>

        {/* ---------- Équilibre ---------- */}
        <Panneau titre="Équilibre éditorial">
          <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
            Le cadrage recommande trois infos rapides pour un article de fond : elles coûtent trois fois moins
            cher à produire et sont bien plus souvent citées telles quelles par les moteurs génératifs.
            Actuellement <strong>{d.parFormat.info ?? 0} pour {d.parFormat.fond ?? 0}</strong>.
          </p>
          <div className="space-y-1.5">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="w-[130px] shrink-0 text-[11px] text-slate-600 truncate">{FORMATS[f].nom}</span>
                <Jauge valeur={d.parFormat[f] ?? 0} total={Math.max(total, 1)} />
                <span className="w-6 text-right text-[10.5px] font-mono text-slate-400">{d.parFormat[f] ?? 0}</span>
              </div>
            ))}
          </div>
        </Panneau>
      </div>

      {/* ---------- Correctifs de maillage ---------- */}
      {d.suggestions.some((s) => s.candidats.length > 0) && (
        <Panneau titre="Liens internes à ajouter" action={<Pastille ton="alerte">Prêt à coller</Pastille>}>
          <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
            Articles à faire citer, avec l'article le plus proche par étiquettes et rubrique. Copiez le lien et
            collez-le dans le corps de l'article source.
          </p>
          <div className="ms-cascade space-y-2">
            {d.suggestions
              .filter((s) => s.candidats.length > 0)
              .map(({ orphelin, candidats }) => (
                <div key={orphelin.slug} className="border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[11.5px] font-semibold text-slate-800 mb-1.5 truncate">{orphelin.titre}</p>
                  {candidats.map(({ c, communes }) => (
                    <div key={c.slug} className="flex items-center gap-2 py-1">
                      <span className="text-[10.5px] text-slate-500 shrink-0">depuis</span>
                      <span className="text-[11px] text-slate-700 truncate flex-1">{c.titre}</span>
                      {communes.length > 0 && (
                        <span className="text-[9.5px] text-slate-400 shrink-0">{communes.join(", ")}</span>
                      )}
                      <Bouton
                        variante="neutre"
                        className="shrink-0"
                        onClick={() =>
                          navigator.clipboard
                            ?.writeText(`[${orphelin.titre}](/blog/${orphelin.slug}/)`)
                            .catch(() => {})
                        }
                      >
                        Copier le lien
                      </Bouton>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </Panneau>
      )}

      {/* ---------- Audit par article ---------- */}
      <Panneau
        titre={`Audit article par article — ${auditsAffiches.length} sur ${total}`}
        action={
          <span className="flex items-center gap-2">
            <Saisie
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Filtrer…"
              className="w-40 h-7 py-0"
            />
            <Liste
              value={triArticles}
              onChange={(e) => setTriArticles(e.target.value as typeof triArticles)}
              className="w-[168px]"
            >
              <option value="score">Les plus faibles d'abord</option>
              <option value="date">Les plus anciens d'abord</option>
              <option value="titre">Par titre</option>
            </Liste>
          </span>
        }
      >
        <div key={`${recherche}|${triArticles}`} className="ms-cascade space-y-2">
          {auditsAffiches.map(({ p, controles, score, manques }) => (
            <div key={p.slug} className="border border-slate-200 rounded-lg p-2.5">
              <div className="flex items-center gap-2.5 mb-2">
                {/* La note d'abord : c'est elle qui trie le regard sur une
                    liste de trente articles. */}
                <span
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-extrabold tabular-nums ${
                    score >= 80
                      ? "bg-emerald-50 text-emerald-700"
                      : score >= 60
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {score}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold text-slate-800 truncate">{p.titre}</span>
                  <span className="block text-[10px] text-slate-400">
                    {d.entrants.get(p.slug) ?? 0} lien{(d.entrants.get(p.slug) ?? 0) > 1 ? "s" : ""} entrant
                    {(d.entrants.get(p.slug) ?? 0) > 1 ? "s" : ""} · modifié {relatif(p.maj_le ?? p.publie_le)} (
                    {formatDate(p.maj_le ?? p.publie_le)})
                  </span>
                </span>
                {manques.length === 0 ? (
                  <Pastille ton="ok">Conforme</Pastille>
                ) : (
                  <Pastille ton="alerte">{manques.length} à corriger</Pastille>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {controles.map((x) => (
                  <span
                    key={x.libelle}
                    title={x.detail}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors duration-150 ${
                      x.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${x.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {x.libelle}
                    {x.detail && <span className="font-mono opacity-60">{x.detail}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {auditsAffiches.length === 0 && (
            <p className="py-6 text-center text-[12px] text-slate-400">Aucun article ne correspond.</p>
          )}
        </div>
      </Panneau>
    </div>
  );
};

export default Diagnostic;
