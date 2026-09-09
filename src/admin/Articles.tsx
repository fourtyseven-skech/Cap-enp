import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/blog";
import { FORMATS, type Format } from "@/lib/formats";
import { brouillonVide, controler, sauver } from "./brouillon";
import { reinitialiserComposition } from "./composition";
import { articles, surChangement, versions, type ArticleLocal } from "./depot";
import { depublierArticle, publierArticle } from "./publication";
import { Bouton, Liste, MenuActions, Panneau, Pastille, Saisie, Tuile } from "./ui";
import { relatif } from "./dates";

/**
 * Gestion des articles existants.
 *
 * Les articles sont des fichiers Markdown lus au build : le panel peut donc les
 * LIRE intégralement, mais pas les écrire — il n'y a pas de serveur. Le
 * circuit est donc : ouvrir un article ici, le modifier dans l'éditeur,
 * réexporter le .md, remplacer le fichier. Pour la suppression, le panel donne
 * le chemin exact du fichier à retirer.
 *
 * C'est volontairement explicite plutôt que de faire semblant : un bouton
 * « Supprimer » qui ne supprime rien serait pire qu'une instruction claire.
 */

const TONS: Record<string, "ok" | "alerte" | "bloc" | "neutre"> = {
  publie: "ok",
  relecture: "alerte",
  programme: "alerte",
  brouillon: "neutre",
  archive: "neutre",
};

/**
 * Gabarit des colonnes.
 *
 * Il est déclaré une seule fois et partagé par l'en-tête et les lignes : deux
 * listes de largeurs à maintenir en parallèle finissent toujours par diverger
 * d'une colonne. La piste d'actions est en largeur FIXE et son contenu est
 * `shrink-0` — sans cela le bouton se comprimait jusqu'à devenir une pastille
 * ronde illisible et débordait par-dessus la colonne Statut.
 */
const COLONNES = "grid grid-cols-[minmax(0,1fr)_104px_116px_104px_104px_96px_124px] gap-2 items-center";

type Tri = "recent" | "ancien" | "titre" | "maj" | "statut";

/** Les deux façons d'écrire un article, présentées au moment du choix. */
const VOIES = [
  {
    cle: "markdown" as const,
    nom: "Éditeur Markdown",
    argument: "Le plus rapide",
    description:
      "Une page blanche et le texte. Tous les champs de référencement, les questions fréquentes et les contrôles avant publication sont là.",
    pour: "À prendre par défaut, et pour toute reprise d'article existant.",
  },
  {
    cle: "constructeur" as const,
    nom: "Constructeur visuel",
    argument: "Le plus démonstratif",
    description:
      "On assemble des blocs — accroche, citation, chiffres, comparatif — et on voit la page se faire. Le texte se saisit directement dedans.",
    pour: "Pour un article très mis en page, ou quand on part d'un modèle.",
  },
];

const Articles = ({
  onEditer,
  acteur,
}: {
  onEditer: (vue: "markdown" | "constructeur") => void;
  acteur: string;
}) => {
  const [choixVoie, setChoixVoie] = useState(false);

  /** Ouvre une page blanche : sans cette remise à zéro, « Nouvel article »
   *  rouvrirait le dernier brouillon travaillé — ou la dernière composition —
   *  et on écraserait un article existant en croyant en créer un. */
  const creer = (vue: "markdown" | "constructeur") => {
    sauver(brouillonVide());
    if (vue === "constructeur") reinitialiserComposition();
    setChoixVoie(false);
    onEditer(vue);
  };

  const [, forcer] = useState(0);
  useEffect(() => surChangement(() => forcer((n) => n + 1)), []);
  const [historique, setHistorique] = useState<string | null>(null);
  /* La ligne dont la fiche de gestion est ouverte. Une seule à la fois : deux
     fiches dépliées font perdre la liste de vue. */
  const [fiche, setFiche] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("tous");
  const [format, setFormat] = useState("tous");
  const [tri, setTri] = useState<Tri>("recent");
  const [aSupprimer, setASupprimer] = useState<ArticleLocal | null>(null);
  /* Le résultat de la dernière action, affiché en haut de la liste.
     Publier depuis le menu d'une ligne ne changeait auparavant rien de
     visible quand le serveur refusait : la ligne restait « brouillon » et
     rien n'expliquait pourquoi. */
  const [avis, setAvis] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const tous = articles.lister();

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtree = tous.filter((p) => {
      if (statut !== "tous" && p.statut !== statut) return false;
      if (format !== "tous" && p.format !== format) return false;
      if (!q) return true;
      return (
        p.titre.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q) ||
        p.etiquettes.toLowerCase().includes(q)
      );
    });
    const ordres: Record<Tri, (a: ArticleLocal, b: ArticleLocal) => number> = {
      recent: (a, b) => b.publie_le.localeCompare(a.publie_le),
      ancien: (a, b) => a.publie_le.localeCompare(b.publie_le),
      maj: (a, b) => (b.maj_le ?? b.publie_le).localeCompare(a.maj_le ?? a.publie_le),
      titre: (a, b) => a.titre.localeCompare(b.titre, "fr"),
      statut: (a, b) => a.statut.localeCompare(b.statut),
    };
    return [...filtree].sort(ordres[tri]);
  }, [recherche, statut, format, tri, tous]);

  const ouvrir = (p: ArticleLocal) => {
    sauver(p);
    onEditer("markdown");
  };

  const dupliquer = (p: ArticleLocal) => {
    sauver({
      ...p,
      titre: `${p.titre} (copie)`,
      slug: `${p.slug}-copie`,
      statut: "brouillon",
      publie_le: new Date().toISOString().slice(0, 10),
    });
    onEditer("markdown");
  };

  /**
   * Publication et dépublication depuis la liste. Publier passe par les mêmes
   * contrôles que l'éditeur : une porte dérobée qui les contourne rendrait les
   * contrôles décoratifs, et c'est toujours par là que passent les articles
   * sans description ni chapeau.
   */
  const publier = async (p: ArticleLocal) => {
    const r = await publierArticle(p, acteur);
    if (!r.ok) {
      setAvis({
        ton: "erreur",
        texte:
          `« ${p.titre} » n'a pas été publié. ${r.message}` +
          (r.bloquants?.length ? ` (${r.bloquants.join(" · ")})` : ""),
      });
      return;
    }
    setAvis({ ton: "ok", texte: `« ${p.titre} » est en ligne.` });
  };

  const depublier = async (p: ArticleLocal) => {
    const r = await depublierArticle(p, acteur);
    setAvis(
      r.ok
        ? { ton: "ok", texte: `« ${p.titre} » a été retiré du site.` }
        : { ton: "erreur", texte: `« ${p.titre} » n'a pas pu être dépublié. ${r.message}` }
    );
  };

  const retirer = async (p: ArticleLocal, geste: "archiver" | "jeter") => {
    setASupprimer(null);
    try {
      await (geste === "archiver"
        ? articles.archiver(p.slug, acteur)
        : articles.jeter(p.slug, acteur));
      setAvis({
        ton: "ok",
        texte:
          geste === "archiver"
            ? `« ${p.titre} » est archivé.`
            : `« ${p.titre} » est dans la corbeille.`,
      });
    } catch (e) {
      setAvis({
        ton: "erreur",
        texte: `« ${p.titre} » n'a pas pu être retiré. ${
          e && typeof e === "object" && "message" in e
            ? String((e as { message: unknown }).message)
            : "Le serveur n'a pas répondu."
        }`,
      });
    }
  };

  const compte = (s: string) => tous.filter((p) => p.statut === s).length;
  const enRetard = tous.filter(
    (p) => p.statut === "publie" && Date.now() - new Date(p.maj_le ?? p.publie_le).getTime() > 365 * 864e5
  ).length;

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-4">
      {avis && (
        <div
          className={`ms-insere flex items-start gap-2 rounded-lg border p-2.5 ${
            avis.ton === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="flex-1 text-[11.5px] leading-snug">{avis.texte}</p>
          <button
            type="button"
            onClick={() => setAvis(null)}
            className="shrink-0 text-[11px] underline opacity-70 hover:opacity-100"
          >
            Fermer
          </button>
        </div>
      )}

      <div className="ms-cascade grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tuile libelle="Articles" valeur={tous.length} detail={`${compte("publie")} en ligne`} />
        <Tuile libelle="Brouillons" valeur={compte("brouillon")} detail="Non visibles du public" />
        <Tuile
          libelle="En relecture"
          valeur={compte("relecture")}
          ton={compte("relecture") > 0 ? "alerte" : "neutre"}
          detail="En attente de validation"
        />
        <Tuile
          libelle="À rafraîchir"
          valeur={enRetard}
          ton={enRetard > 0 ? "alerte" : "ok"}
          detail="Publiés, pas retouchés depuis un an"
        />
      </div>

      {/* ---------- Création ----------
          Le choix de l'outil est posé AVANT d'ouvrir quoi que ce soit, et
          expliqué : les deux voies mènent au même article, mais l'une est plus
          rapide et l'autre plus visuelle. Ouvrir directement l'une des deux
          reviendrait à décider à la place du rédacteur. */}
      {choixVoie && (
        <Panneau
          titre="Nouvel article — par où commencer ?"
          action={
            <Bouton variante="discret" onClick={() => setChoixVoie(false)}>
              Annuler
            </Bouton>
          }
        >
          <div className="ms-cascade grid sm:grid-cols-2 gap-3">
            {VOIES.map((v) => (
              <button
                key={v.cle}
                onClick={() => creer(v.cle)}
                className="ms-levier text-left rounded-lg border border-slate-200 bg-white p-3.5 hover:border-ms-blue"
              >
                <span className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[13px] font-extrabold text-slate-900">{v.nom}</span>
                  <Pastille ton="neutre">{v.argument}</Pastille>
                </span>
                <span className="block text-[11.5px] leading-relaxed text-slate-600 mb-2">{v.description}</span>
                <span className="block text-[10.5px] leading-snug text-slate-400">{v.pour}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 pt-3 border-t border-slate-200 text-[10.5px] leading-snug text-slate-500">
            Dans les deux cas, l'article se met de côté en <strong>brouillon</strong> à tout moment, et se
            publie une fois les contrôles levés. Un brouillon n'est jamais visible du public.
          </p>
        </Panneau>
      )}

      <Panneau
        titre={`Articles — ${liste.length} sur ${tous.length}`}
        action={
          <span className="flex items-center gap-1.5">
            <Pastille ton="ok">{compte("publie")} publiés</Pastille>
            <Pastille ton="neutre">{compte("brouillon")} brouillons</Pastille>
            <Bouton variante="principal" onClick={() => setChoixVoie((v) => !v)} className="ml-1">
              <span className="text-[14px] leading-none">+</span>
              Nouvel article
            </Bouton>
          </span>
        }
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <Saisie
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un titre, une adresse, une rubrique, une étiquette…"
            className="flex-1 min-w-[220px]"
          />
          <Liste value={statut} onChange={(e) => setStatut(e.target.value)} className="w-[168px]">
            <option value="tous">Tous les statuts</option>
            <option value="publie">Publiés</option>
            <option value="brouillon">Brouillons</option>
            <option value="relecture">En relecture</option>
            <option value="programme">Programmés</option>
            <option value="archive">Archivés</option>
          </Liste>
          <Liste value={format} onChange={(e) => setFormat(e.target.value)} className="w-[168px]">
            <option value="tous">Tous les formats</option>
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].nom}
              </option>
            ))}
          </Liste>
          <Liste value={tri} onChange={(e) => setTri(e.target.value as Tri)} className="w-[178px]">
            <option value="recent">Publication ↓</option>
            <option value="ancien">Publication ↑</option>
            <option value="maj">Dernière modification</option>
            <option value="titre">Titre (A→Z)</option>
            <option value="statut">Statut</option>
          </Liste>
        </div>

        {/* Les sept colonnes réclament environ 800 px. En dessous, elles se
            comprimaient les unes sur les autres jusqu'à ce que le titre — la
            seule colonne élastique — disparaisse. Le tableau garde donc sa
            largeur et se fait balayer horizontalement : le panel n'est pas
            conçu pour le téléphone, mais il y reste au moins consultable. */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <div className="min-w-[820px]">
          <div className={`${COLONNES} ms-carte-entete px-3 py-2`}>
            {["Titre", "Format", "Rubrique", "Publié le", "Modifié le", "Statut", ""].map((t, i) => (
              <span key={i} className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t}
              </span>
            ))}
          </div>

          {liste.length === 0 && (
            <p className="px-3 py-6 text-[12px] text-slate-400 text-center">Aucun article ne correspond.</p>
          )}

          {/* La clé du conteneur inclut les filtres : changer de statut ou de
              tri rejoue la cascade, ce qui montre que la liste a été refaite et
              non simplement raccourcie. */}
          <div key={`${statut}|${format}|${recherche}|${tri}`} className="ms-cascade">
            {liste.map((p) => {
              const publiable = controler(p).every((c) => !c.bloquant || c.ok);
              const estPublie = p.statut === "publie";
              const ouverte = fiche === p.slug;
              return (
                <div key={p.slug} className="border-b border-slate-100 last:border-b-0">
                <div
                  className={`${COLONNES} ms-rang px-3 py-2 ${
                    ouverte ? "bg-slate-50" : "hover:bg-slate-50/80"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12.5px] font-semibold text-slate-800 truncate">{p.titre}</span>
                      {p.maquette && (
                        <span className="shrink-0 px-1 rounded bg-amber-100 text-[8.5px] font-bold text-amber-700 leading-4">
                          MAQUETTE
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400 truncate">/blog/{p.slug}/</span>
                  </span>

                  <span className="text-[11px] text-slate-600 truncate">{FORMATS[p.format].nom}</span>
                  <span className="text-[11px] text-slate-500 truncate">{p.categorie}</span>

                  {/* Les deux dates côte à côte : la date de publication seule
                      ne dit pas si le contenu a été entretenu depuis. */}
                  <span className="min-w-0">
                    <span className="block text-[10.5px] text-slate-600 tabular-nums truncate">
                      {formatDate(p.publie_le)}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10.5px] text-slate-600 tabular-nums truncate">
                      {formatDate(p.maj_le ?? p.publie_le)}
                    </span>
                    <span className="block text-[9.5px] text-slate-400 truncate">
                      {relatif(p.maj_le ?? p.publie_le)}
                    </span>
                  </span>

                  <span className="min-w-0">
                    <Pastille ton={TONS[p.statut] ?? "neutre"}>{p.statut}</Pastille>
                  </span>

                  {/* Une action principale toujours visible, le reste replié.
                      Les deux éléments sont `shrink-0` : la piste ne peut plus
                      pousser son contenu par-dessus la colonne d'à côté. */}
                  <span className="flex items-center gap-1 justify-end min-w-0">
                    {/* « Modifier » ouvre la FICHE DE GESTION, pas l'éditeur.
                        Le geste courant sur un article existant n'est pas d'en
                        réécrire le texte : c'est de le publier, le retirer, le
                        dupliquer ou consulter ses versions. Sauter directement
                        dans l'éditeur Markdown obligeait à en ressortir pour
                        toute autre action — et rouvrait un article assemblé au
                        Constructeur dans le mauvais outil.

                        Le contenu reste à un clic, depuis la fiche. */}
                    <Bouton
                      variante="neutre"
                      className="shrink-0"
                      onClick={() => setFiche(ouverte ? null : p.slug)}
                    >
                      {ouverte ? "Fermer" : "Modifier"}
                    </Bouton>
                    <MenuActions
                      actions={[
                        ...(estPublie
                          ? [
                              {
                                libelle: "Voir en ligne",
                                onClick: () => window.open(`/blog/${p.slug}/`, "_blank", "noopener"),
                              },
                              { libelle: "Dépublier", onClick: () => void depublier(p) },
                            ]
                          : [
                              {
                                libelle: publiable ? "Publier" : "Publier — contrôles à lever",
                                onClick: () => (publiable ? void publier(p) : ouvrir(p)),
                                desactivee: false,
                              },
                            ]),
                        { libelle: "Dupliquer", onClick: () => dupliquer(p) },
                        {
                          libelle: `Versions (${versions.lister(p.slug).length})`,
                          onClick: () => setHistorique(historique === p.slug ? null : p.slug),
                        },
                        { libelle: "Retirer", onClick: () => setASupprimer(p), danger: true },
                      ]}
                    />
                  </span>
                </div>

                {/* ---------- Fiche de gestion ----------
                    Tout ce qu'on fait couramment à un article existant, sans
                    quitter la liste : son statut, sa duplication, ses versions,
                    son retrait. Le contenu s'ouvre depuis ici, en dernier —
                    c'est le geste le moins fréquent, pas le premier. */}
                {ouverte && (
                  <div className="ms-insere px-3 pb-3 bg-slate-50 border-t border-slate-200">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Statut
                        </span>
                        <Pastille ton={TONS[p.statut] ?? "neutre"}>{p.statut}</Pastille>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Parution
                        </span>
                        <span className="text-[11.5px] text-slate-700 tabular-nums">
                          {formatDate(p.publie_le)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Adresse
                        </span>
                        <code className="text-[10.5px] font-mono text-slate-600">/blog/{p.slug}/</code>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {estPublie ? (
                        <>
                          <Bouton variante="neutre" onClick={() => void depublier(p)}>
                            Dépublier
                          </Bouton>
                          <Bouton
                            variante="neutre"
                            onClick={() => window.open(`/blog/${p.slug}/`, "_blank", "noopener")}
                          >
                            Voir en ligne
                          </Bouton>
                        </>
                      ) : (
                        /* Un article qui ne passe pas les contrôles ne se
                           publie pas d'ici : le bouton mène à l'éditeur, là où
                           se corrige ce qui manque. */
                        <Bouton
                          variante="principal"
                          onClick={() => (publiable ? void publier(p) : ouvrir(p))}
                        >
                          {publiable ? "Publier" : "Publier — contrôles à lever"}
                        </Bouton>
                      )}

                      <Bouton variante="neutre" onClick={() => dupliquer(p)}>
                        Dupliquer
                      </Bouton>
                      <Bouton
                        variante="neutre"
                        onClick={() => setHistorique(historique === p.slug ? null : p.slug)}
                      >
                        Versions ({versions.lister(p.slug).length})
                      </Bouton>
                      <Bouton variante="neutre" onClick={() => setASupprimer(p)}>
                        Retirer
                      </Bouton>

                      <span className="ml-auto">
                        <Bouton variante="principal" onClick={() => ouvrir(p)}>
                          Modifier le contenu →
                        </Bouton>
                      </span>
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </Panneau>

      {/* ---------- Historique de versions ---------- */}
      {historique && (
        <Panneau
          titre={`Versions — ${historique}`}
          action={<Bouton variante="discret" onClick={() => setHistorique(null)}>Fermer</Bouton>}
        >
          {versions.lister(historique).length === 0 ? (
            <p className="text-[12px] text-slate-400">
              Aucune version enregistrée. Une version est créée à chaque enregistrement depuis l'éditeur.
            </p>
          ) : (
            <div className="ms-cascade space-y-1.5">
              {versions.lister(historique).map((v, i) => (
                <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200">
                  <Pastille ton={i === 0 ? "ok" : "neutre"}>
                    {i === 0 ? "Actuelle" : `v${versions.lister(historique).length - i}`}
                  </Pastille>
                  <span className="flex-1 min-w-0 text-[11.5px] text-slate-600 truncate">
                    {new Date(v.date).toLocaleString("fr-FR")} — {v.acteur}
                  </span>
                  <span className="text-[10px] text-slate-400">{v.contenu.corps.length} car.</span>
                  {i > 0 && (
                    <Bouton
                      variante="neutre"
                      onClick={() => {
                        sauver(v.contenu);
                        onEditer("markdown");
                      }}
                    >
                      Restaurer
                    </Bouton>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panneau>
      )}

      {/* ---------- Retrait : corbeille réversible, pas suppression ---------- */}
      {aSupprimer && (
        <Panneau titre="Retirer un article" action={<Pastille ton="alerte">Réversible</Pastille>}>
          <p className="text-[12px] leading-relaxed text-slate-700 mb-3">
            L'article part à la corbeille et disparaît du blog à la reconstruction suivante. Rien n'est effacé :
            vous pouvez le restaurer depuis l'onglet Outils.
          </p>
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 mb-3">
            <p className="text-[11px] leading-snug text-amber-800">
              <strong>Pour un article déjà publié, préférez l'archivage.</strong> Une page indexée qui
              disparaît fait perdre le référencement acquis et laisse des liens morts sur le web ; archivée,
              elle conserve son adresse.
            </p>
          </div>
          <div className="flex gap-2">
            <Bouton
              variante="neutre"
              onClick={() => void retirer(aSupprimer, "archiver")}
            >
              Archiver
            </Bouton>
            <Bouton
              variante="principal"
              onClick={() => void retirer(aSupprimer, "jeter")}
            >
              Mettre à la corbeille
            </Bouton>
            <Bouton variante="discret" onClick={() => setASupprimer(null)}>
              Annuler
            </Bouton>
          </div>
        </Panneau>
      )}
    </div>
  );
};

export default Articles;
