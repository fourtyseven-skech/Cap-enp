import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { Vignette, type Accent, type Motif } from "@/blog/covers";
import { FORMATS } from "@/lib/formats";
import SelecteurFormat from "./SelecteurFormat";
import {
  brouillonVide,
  controler,
  minutes,
  relire,
  sauver,
  slugDepuisTitre,
  versMarkdown,
  type Brouillon,
} from "./brouillon";
import { Bouton, Champ, Liste, Panneau, Pastille, Saisie, SelecteurDate, Zone } from "./ui";
import Presents from "./Presents";
import Conflit from "./Conflit";
import { resynchroniserArticles } from "./serveur/adaptateur";
import { relatif } from "./dates";
import { articles } from "./depot";
import { enregistrerBrouillon, publierArticle } from "./publication";
import { listerMedias, resoudre, urlMedia, versMarkdown as refMedia, type Media } from "./sourceMedias";
import ChoixImage from "./ChoixImage";

const MOTIFS: { valeur: Motif; nom: string }[] = [
  { valeur: "question", nom: "Question" },
  { valeur: "grille", nom: "Registre" },
  { valeur: "atelier", nom: "Atelier" },
  { valeur: "routes", nom: "Réseau" },
  { valeur: "couches", nom: "Strates" },
  { valeur: "devises", nom: "Devises" },
  { valeur: "jalons", nom: "Jalons" },
];

const ACCENTS: { valeur: Accent; nom: string; classe: string }[] = [
  { valeur: "office", nom: "Bleu Office", classe: "bg-ms-blue" },
  { valeur: "digital", nom: "Rose Digital", classe: "bg-ms-pink" },
  { valeur: "service", nom: "Vert Service", classe: "bg-ms-green" },
];

/* ---------------------------------------------------------------------------
 * Choix d'une image de la médiathèque
 * ---------------------------------------------------------------------------
 * Sans cet écran, illustrer un article demandait d'ouvrir l'onglet Médias,
 * copier une référence, revenir, retrouver le bon paragraphe et coller. Cinq
 * gestes pour une image — en pratique, les articles restaient sans illustration.
 * ------------------------------------------------------------------------- */

const ChoixMedia = ({ medias, onChoisir }: { medias: Media[]; onChoisir: (m: Media) => void }) => {
  const [q, setQ] = useState("");
  const filtres = medias.filter((m) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      m.nom.toLowerCase().includes(t) ||
      m.alt.toLowerCase().includes(t) ||
      (m.etiquettes ?? []).some((e) => e.toLowerCase().includes(t))
    );
  });

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      {medias.length === 0 ? (
        <p className="text-[11px] leading-snug text-slate-500">
          La médiathèque est vide. Importez vos images depuis l'onglet <strong>Médias</strong> : elles y sont
          converties en WebP et déclinées en trois largeurs avant d'être utilisables ici.
        </p>
      ) : (
        <>
          <Saisie
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer les images…"
            className="mb-2"
          />
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto">
            {filtres.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChoisir(m)}
                title={`${m.nom} — ${m.alt}`}
                className="ms-levier rounded-md border border-slate-200 overflow-hidden bg-white text-left"
              >
                <img src={urlMedia(m, 400)} alt="" className="w-full h-14 object-cover bg-slate-100" loading="lazy" />
                <span className="block px-1.5 py-1 text-[9.5px] font-semibold text-slate-600 truncate">
                  {m.nom}
                </span>
              </button>
            ))}
            {filtres.length === 0 && (
              <p className="col-span-full py-3 text-center text-[11px] text-slate-400">Aucune image ne correspond.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const Editeur = ({ acteur = "Administrateur" }: { acteur?: string }) => {
  const [b, setB] = useState<Brouillon>(() => relire() ?? brouillonVide());
  /* Un brouillon rouvert porte déjà son adresse : elle est donc considérée
     comme fixée. Sans cela, corriger une virgule dans le titre d'un article
     publié réécrirait son adresse — et casserait la page en ligne ainsi que
     tous les liens qui pointent dessus. */
  const [slugManuel, setSlugManuel] = useState(() => (relire()?.slug ?? "").length > 0);
  const [copie, setCopie] = useState(false);
  const [enregistre, setEnregistre] = useState<"brouillon" | "publie" | null>(null);
  /* L'échec de la dernière tentative. Affiché à côté des boutons, là où l'on
     vient de cliquer — le bandeau général du panel passe inaperçu quand on a
     les yeux sur le bouton « Publier ». */
  const [echec, setEchec] = useState<{ message: string; bloquants?: string[] } | null>(null);
  /* La version détenue par le serveur, quand une écriture a été refusée pour
     modification concurrente — et le statut qu'on tentait d'écrire. */
  const [conflit, setConflit] = useState<{ distant: unknown; statut: Brouillon["statut"] } | null>(
    null
  );
  const [envoi, setEnvoi] = useState(false);
  const [medias, setMedias] = useState<Media[]>([]);
  const [slugDeverrouille, setSlugDeverrouille] = useState(false);
  const [choixMedia, setChoixMedia] = useState(false);
  const corpsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listerMedias()
      .then(setMedias)
      .catch(() => setMedias([]));
  }, []);

  /**
   * L'article existe-t-il déjà, et sous quel statut ? C'est ce qui distingue
   * une rédaction d'une REPRISE : sur un article publié, l'adresse ne doit plus
   * bouger et l'enregistrement écrase une page en ligne. L'écran doit le dire
   * avant, pas après.
   */
  const existant = useMemo(() => articles.obtenir(b.slug), [b.slug]);
  const dejaPublie = existant?.statut === "publie";

  const maj = <K extends keyof Brouillon>(cle: K, valeur: Brouillon[K]) =>
    setB((p) => ({ ...p, [cle]: valeur }));

  // Sauvegarde locale continue : fermer l'onglet par mégarde ne doit jamais
  // coûter une heure de rédaction.
  useEffect(() => {
    const t = setTimeout(() => sauver(b), 400);
    return () => clearTimeout(t);
  }, [b]);

  // L'adresse de page suit le titre tant que l'utilisateur ne l'a pas reprise
  // à la main — après quoi on n'y touche plus, car elle ne doit pas bouger.
  useEffect(() => {
    if (!slugManuel) setB((p) => ({ ...p, slug: slugDepuisTitre(p.titre) }));
  }, [b.titre, slugManuel]);

  const spec = FORMATS[b.format];
  const controles = useMemo(() => controler(b), [b]);
  const bloquants = controles.filter((c) => c.bloquant && !c.ok);
  const alertes = controles.filter((c) => !c.bloquant && !c.ok);
  const publiable = bloquants.length === 0;

  // L'aperçu résout les références de médiathèque : on juge l'article avec ses
  // images, pas avec des liens `media:m_abc` que rien ne rend.
  const corpsHtml = useMemo(() => {
    try {
      return marked.parse(resoudre(b.corps, medias), { async: false }) as string;
    } catch {
      return "";
    }
  }, [b.corps, medias]);

  /**
   * Insère du texte à l'endroit du curseur. Ajouter en fin de champ obligerait
   * à faire glisser l'image à la main jusqu'au bon paragraphe — sur un article
   * de deux mille mots, c'est le genre de détail qui fait renoncer à illustrer.
   */
  const inserer = (texte: string) => {
    const zone = corpsRef.current;
    if (!zone) {
      maj("corps", `${b.corps}\n\n${texte}\n`);
      return;
    }
    const { selectionStart: d, selectionEnd: f } = zone;
    const avant = b.corps.slice(0, d);
    const apres = b.corps.slice(f);
    // Une image posée au milieu d'un paragraphe casse la mise en page : on
    // garantit la ligne vide de part et d'autre.
    const bloc = `${avant.endsWith("\n\n") || !avant ? "" : avant.endsWith("\n") ? "\n" : "\n\n"}${texte}\n\n`;
    maj("corps", avant + bloc + apres.replace(/^\n+/, ""));
    requestAnimationFrame(() => {
      const pos = avant.length + bloc.length;
      zone.focus();
      zone.setSelectionRange(pos, pos);
    });
  };

  /**
   * Enregistre l'article sous le statut demandé.
   *
   * ⚠️ L'ORDRE DES GESTES A ÉTÉ CORRIGÉ, et c'est tout l'objet de ce code.
   *
   * Cette fonction écrivait autrefois le nouveau statut dans l'état local puis
   * affichait « Publié » sans attendre le dépôt. Un refus du serveur — date de
   * parution absente, conflit d'édition, session expirée — laissait donc un
   * bouton « Publié » sur un article resté brouillon.
   *
   * Le statut local n'est désormais posé QU'APRÈS confirmation. Tant que le
   * serveur n'a pas dit oui, l'écran continue d'afficher la vérité.
   */
  const enregistrer = async (statut: Brouillon["statut"]) => {
    setEchec(null);
    setEnvoi(true);
    try {
      const r =
        statut === "publie"
          ? await publierArticle(b, acteur)
          : await enregistrerBrouillon(b, acteur);

      if (!r.ok) {
        setEchec({ message: r.message, bloquants: r.bloquants });
        /* Refus pour modification concurrente : le serveur joint SA version.
           On la garde pour l'écran de comparaison, avec le statut demandé —
           « Garder ma version » doit refaire exactement le même geste. */
        setConflit(r.conflit ? { distant: r.conflit, statut } : null);
        return;
      }

      setConflit(null);

      setB((p) => ({ ...p, statut: r.statut }));
      setEnregistre(r.statut === "publie" ? "publie" : "brouillon");
      setTimeout(() => setEnregistre(null), 1800);
    } finally {
      setEnvoi(false);
    }
  };

  /**
   * « Garder ma version » — réenregistre par-dessus.
   *
   * On relit d'abord les articles : l'étiquette de version détenue par le
   * cache est périmée, c'est précisément pour cela que le serveur a refusé.
   * Une fois l'étiquette à jour, le même enregistrement passe.
   *
   * Ce n'est pas un contournement du contrôle : il a joué, la question a été
   * posée à l'écran, et la réponse est assumée par la personne qui clique.
   */
  const ecraser = async () => {
    if (!conflit) return;
    await resynchroniserArticles();
    await enregistrer(conflit.statut);
  };

  /** « Reprendre celle du serveur » — le travail en cours est abandonné. */
  const reprendre = (distant: Record<string, unknown>) => {
    setB((p) => ({ ...p, ...(distant as Partial<Brouillon>) }));
    setConflit(null);
    setEchec(null);
  };

  const telecharger = () => {
    const blob = new Blob([versMarkdown(b, medias)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${b.slug || "article"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(versMarkdown(b, medias));
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch {
      /* presse-papiers refusé — le téléchargement reste disponible */
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4">
      {/* Qui d'autre a cet article ouvert. N'apparaît que si quelqu'un y est,
          et n'empêche rien — voir Presents.tsx. La ressource n'est suivie que
          pour un article DÉJÀ enregistré : deux personnes qui rédigent chacune
          un nouvel article ne se gênent pas, leurs adresses diffèrent. */}
      <Presents ressource={existant ? `article:${existant.slug}` : null} />

      {/* ---------- Reprise d'un article existant ----------
          Rien ne distinguait la rédaction d'un nouvel article de la retouche
          d'une page en ligne : même écran, même bouton. C'est précisément la
          situation où l'on modifie l'adresse d'une page indexée sans y penser. */}
      {existant && (
        <div
          className={`ms-entre flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
            dejaPublie ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
          }`}
        >
          <Pastille ton={dejaPublie ? "ok" : "neutre"}>{dejaPublie ? "En ligne" : existant.statut}</Pastille>
          <span className="text-[11.5px] leading-snug text-slate-700">
            {dejaPublie ? (
              <>
                Vous modifiez un article <strong>déjà publié</strong>. L'adresse{" "}
                <code className="px-1 bg-white/70 rounded font-mono text-[10.5px]">/blog/{existant.slug}/</code>{" "}
                est verrouillée : la changer ferait perdre le référencement acquis et laisserait des liens
                morts.
              </>
            ) : (
              <>Reprise de l'article « {existant.titre} ».</>
            )}
          </span>
          <span className="ml-auto flex items-center gap-2 text-[10.5px] text-slate-500">
            <span>Modifié {relatif(existant.maj_le)}</span>
            {dejaPublie && (
              <a
                href={`/blog/${existant.slug}/`}
                target="_blank"
                rel="noreferrer"
                className="ms-presse inline-flex items-center h-7 px-2.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:border-slate-400 transition-colors"
              >
                Voir en ligne
              </a>
            )}
          </span>
        </div>
      )}

      {/* ---------- 1. L'intention, avant tout le reste ---------- */}
      <Panneau titre="1 · Type d'article">
        <SelecteurFormat
          valeur={b.format}
          onChange={(f, d) =>
            setB((p) => ({ ...p, format: f, motif: d.motif, accent: d.accent }))
          }
        />
      </Panneau>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        {/* ---------- 2. Rédaction + aperçu ---------- */}
        <div className="space-y-4 min-w-0">
          <Panneau titre="2 · Rédaction">
            <Champ label="Titre" compteur={{ valeur: b.titre.length, max: 60 }}>
              <Saisie
                value={b.titre}
                onChange={(e) => maj("titre", e.target.value)}
                placeholder="Ce que l'atelier sait et que l'ERP ignore"
              />
            </Champ>

            <Champ
              label="Adresse de la page"
              aide={
                dejaPublie
                  ? "Verrouillée : cet article est en ligne. Déverrouiller n'a de sens qu'accompagné d'une redirection, à poser dans Outils."
                  : "Ne doit plus changer une fois l'article publié."
              }
            >
              <div className="flex gap-1.5">
                <Saisie
                  value={b.slug}
                  disabled={dejaPublie && !slugDeverrouille}
                  onChange={(e) => {
                    setSlugManuel(true);
                    maj("slug", e.target.value);
                  }}
                  className="font-mono text-[12px] disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="atelier-sait-erp-ignore"
                />
                {dejaPublie && (
                  <Bouton
                    variante={slugDeverrouille ? "principal" : "neutre"}
                    className="shrink-0"
                    onClick={() => setSlugDeverrouille((v) => !v)}
                    title="Changer l'adresse d'une page publiée casse les liens existants"
                  >
                    {slugDeverrouille ? "Verrouiller" : "Déverrouiller"}
                  </Bouton>
                )}
              </div>
            </Champ>

            <Champ label="Chapeau" aide="Introduction affichée sous le titre et reprise sur la liste des articles.">
              <Zone rows={3} value={b.chapeau} onChange={(e) => maj("chapeau", e.target.value)} />
            </Champ>

            {spec.reponseRapide && (
              <Champ
                label="Encadré « En bref » — requis pour ce format"
                aide="Une à trois phrases. C'est le passage que les moteurs génératifs citent le plus volontiers : le champ le plus rentable du formulaire."
                compteur={{ valeur: b.reponse.length, min: 40, max: 400 }}
              >
                <Zone rows={3} value={b.reponse} onChange={(e) => maj("reponse", e.target.value)} />
              </Champ>
            )}

            {b.format === "nouveaute" && (
              <Champ label="Numéro de version">
                <Saisie value={b.version} onChange={(e) => maj("version", e.target.value)} placeholder="12.4" />
              </Champ>
            )}

            <Champ
              label="Corps de l'article"
              aide="Markdown : ## pour un intertitre, **gras**, - pour une puce, [texte](/#megaerp) pour un lien."
              compteur={{ valeur: minutes(b.corps), min: spec.minutes[0], max: spec.minutes[1] }}
            >
              {/* Barre d'insertion. Elle ne prétend pas remplacer le Markdown —
                  elle couvre les trois gestes qu'on ne veut pas taper de tête :
                  l'image, le lien interne et l'intertitre. */}
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <Bouton variante="neutre" onClick={() => setChoixMedia((v) => !v)}>
                  {choixMedia ? "Fermer la médiathèque" : "Insérer une image"}
                </Bouton>
                <Bouton variante="discret" onClick={() => inserer("## Intertitre")}>
                  Intertitre
                </Bouton>
                <Bouton variante="discret" onClick={() => inserer("[texte du lien](/#megaerp)")}>
                  Lien interne
                </Bouton>
                <Bouton variante="discret" onClick={() => inserer("> Citation")}>
                  Citation
                </Bouton>
                <span className="ml-auto text-[10px] text-slate-400">
                  {medias.length} image{medias.length > 1 ? "s" : ""} disponible{medias.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="ms-repli" data-ouvert={choixMedia ? "1" : "0"}>
                <div>
                  <ChoixMedia
                    medias={medias}
                    onChoisir={(m) => {
                      inserer(m.legende ? `${refMedia(m)}\n*${m.legende}*` : refMedia(m));
                      setChoixMedia(false);
                    }}
                  />
                </div>
              </div>

              <Zone
                ref={corpsRef}
                rows={20}
                value={b.corps}
                onChange={(e) => maj("corps", e.target.value)}
                className="font-mono text-[12.5px]"
              />
            </Champ>

            <Champ label="Phrase en exergue" aide="Détachée en grand au fil de l'article. Facultatif.">
              <Zone rows={2} value={b.exergue} onChange={(e) => maj("exergue", e.target.value)} />
            </Champ>
          </Panneau>

          <Panneau titre="Aperçu">
            <div className="border border-slate-200 rounded overflow-hidden">
              <Vignette
                image={b.image}
                motif={b.motif}
                accent={b.accent}
                titreFantome={b.titre_fantome}
                etiquette={b.categorie || spec.nom}
                className="w-full h-[150px] block"
              />
              <div className="p-5 bg-ms-paper/40">
                <h1 className="text-xl font-extrabold text-ms-ink tracking-tight leading-tight mb-2">
                  {b.titre || "Titre de l'article"}
                </h1>
                <p className="text-[13px] text-ms-ink/55 leading-relaxed mb-4">{b.chapeau}</p>
                {spec.reponseRapide && b.reponse && (
                  <aside className="mb-4 rounded border-l-[3px] border-ms-blue bg-white p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ms-ink/40 mb-1">En bref</p>
                    <p className="text-[13px] font-bold text-ms-ink leading-relaxed">{b.reponse}</p>
                  </aside>
                )}
                <div
                  className="prose prose-slate prose-sm max-w-none prose-headings:text-ms-ink prose-p:text-ms-ink/75"
                  dangerouslySetInnerHTML={{ __html: corpsHtml }}
                />
              </div>
            </div>
          </Panneau>
        </div>

        {/* ---------- 3. Métadonnées ---------- */}
        <div className="space-y-4">
          <Panneau titre="3 · Apparence">
            {/* La vignette D'ABORD : c'est le choix le plus structurant de ce
                panneau. Une image posée ici remplace la couverture vectorielle,
                et les réglages qui suivent — filigrane, couleur de pôle — n'ont
                alors plus d'effet visible. */}
            <ChoixImage
              valeur={b.image}
              onChange={(url) => maj("image", url)}
              alt={b.titre}
              libelle="Vignette de l'article"
              aide={
                b.image
                  ? "Cette image remplace la couverture vectorielle, dans la liste du blog, en tête de l'article et au partage."
                  : "Sans image, l'article garde sa couverture vectorielle — construite à partir du filigrane et de la couleur ci-dessous."
              }
            />

            <Champ label="Filigrane" aide={`Hérité du format « ${spec.nom} ». Remplaçable si le sujet le justifie.`}>
              <Liste value={b.motif} onChange={(e) => maj("motif", e.target.value as Motif)}>
                {MOTIFS.map((m) => (
                  <option key={m.valeur} value={m.valeur}>
                    {m.nom}
                  </option>
                ))}
              </Liste>
            </Champ>

            <Champ label="Couleur de pôle">
              <div className="flex gap-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a.valeur}
                    type="button"
                    onClick={() => maj("accent", a.valeur)}
                    aria-pressed={b.accent === a.valeur}
                    title={a.nom}
                    className={`flex-1 h-8 rounded border-2 ${a.classe} ${
                      b.accent === a.valeur ? "border-slate-900" : "border-transparent opacity-50 hover:opacity-80"
                    }`}
                  />
                ))}
              </div>
            </Champ>

            <Champ
              label="Mot en filigrane"
              aide="Tracé en très grand derrière le contenu. Six caractères maximum."
              compteur={{ valeur: b.titre_fantome.length, max: 6 }}
            >
              <Saisie
                value={b.titre_fantome}
                maxLength={6}
                onChange={(e) => maj("titre_fantome", e.target.value.toUpperCase())}
                className="font-mono uppercase"
                placeholder="MES"
              />
            </Champ>
          </Panneau>

          <Panneau titre="4 · Publication">
            <Champ label="Rubrique">
              <Saisie
                value={b.categorie}
                onChange={(e) => maj("categorie", e.target.value)}
                placeholder="Production & atelier"
              />
            </Champ>
            <Champ label="Auteur">
              <Saisie value={b.auteur} onChange={(e) => maj("auteur", e.target.value)} />
            </Champ>
            <Champ
              label="Date de publication"
              aide={
                b.statut === "programme"
                  ? "L'article n'apparaîtra qu'à partir de cette date."
                  : undefined
              }
            >
              <SelecteurDate value={b.publie_le} onChange={(e) => maj("publie_le", e.target.value)} />
            </Champ>
            <Champ label="Statut">
              <Liste value={b.statut} onChange={(e) => maj("statut", e.target.value as Brouillon["statut"])}>
                <option value="brouillon">Brouillon</option>
                <option value="relecture">En relecture</option>
                <option value="programme">Programmé</option>
                <option value="publie">Publié</option>
              </Liste>
            </Champ>
          </Panneau>

          <Panneau titre="5 · Référencement">
            <Champ
              label="Description"
              aide="Extrait affiché dans les résultats de recherche."
              compteur={{ valeur: b.meta_description.length, min: 120, max: 160 }}
            >
              <Zone rows={3} value={b.meta_description} onChange={(e) => maj("meta_description", e.target.value)} />
            </Champ>
            <Champ label="Étiquettes" aide="Séparées par des virgules.">
              <Saisie value={b.etiquettes} onChange={(e) => maj("etiquettes", e.target.value)} placeholder="MES, Production" />
            </Champ>

            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-600">Questions fréquentes</span>
                <Bouton variante="discret" onClick={() => maj("faq", [...b.faq, { q: "", r: "" }])}>
                  + Ajouter
                </Bouton>
              </div>
              {b.faq.length === 0 && (
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  Deux questions minimum recommandées : elles alimentent les données structurées et sont
                  reprises telles quelles par les moteurs génératifs.
                </p>
              )}
              {b.faq.map((f, i) => (
                <div key={i} className="mb-2 p-2 border border-slate-200 rounded bg-slate-50">
                  <Saisie
                    value={f.q}
                    placeholder="Question"
                    onChange={(e) => {
                      const n = [...b.faq];
                      n[i] = { ...n[i], q: e.target.value };
                      maj("faq", n);
                    }}
                    className="mb-1"
                  />
                  <Zone
                    rows={2}
                    value={f.r}
                    placeholder="Réponse"
                    onChange={(e) => {
                      const n = [...b.faq];
                      n[i] = { ...n[i], r: e.target.value };
                      maj("faq", n);
                    }}
                  />
                  <Bouton
                    variante="discret"
                    className="mt-1"
                    onClick={() => maj("faq", b.faq.filter((_, j) => j !== i))}
                  >
                    Retirer
                  </Bouton>
                </div>
              ))}
            </div>
          </Panneau>

          {/* ---------- Contrôles ---------- */}
          <Panneau
            titre="Contrôles avant publication"
            action={
              publiable ? (
                <Pastille ton="ok">Publiable</Pastille>
              ) : (
                <Pastille ton="bloc">{bloquants.length} bloquant{bloquants.length > 1 ? "s" : ""}</Pastille>
              )
            }
          >
            <ul className="space-y-1.5">
              {controles.map((c) => (
                <li key={c.libelle} className="flex items-start gap-2 text-[11.5px] leading-snug">
                  <span
                    className={`mt-[3px] w-3 h-3 shrink-0 rounded-full border ${
                      c.ok
                        ? "bg-emerald-500 border-emerald-500"
                        : c.bloquant
                          ? "bg-red-500 border-red-500"
                          : "bg-amber-400 border-amber-400"
                    }`}
                  />
                  <span className={c.ok ? "text-slate-400 line-through" : "text-slate-700"}>
                    {c.libelle}
                    {!c.ok && c.detail && (
                      <span className="block text-[10px] text-slate-400 no-underline">{c.detail}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {alertes.length > 0 && publiable && (
              <p className="mt-3 pt-2 border-t border-slate-200 text-[10.5px] text-amber-700">
                {alertes.length} avertissement{alertes.length > 1 ? "s" : ""} — la publication reste possible.
              </p>
            )}
          </Panneau>

          {/* Aperçu du rendu dans les résultats de recherche et en partage :
              c'est ce qui fait vraiment soigner un titre et une description. */}
          <Panneau titre="Aperçu du résultat">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
              Moteur de recherche
            </p>
            <div className="rounded border border-slate-200 p-2.5 bg-white mb-3">
              <p className="text-[10px] text-slate-500 truncate">
                megasoft-office.com › blog › {b.slug || "adresse"}
              </p>
              <p className="text-[13px] text-[#1a0dab] leading-snug truncate">
                {(b.titre || "Titre de l'article") + " | Megasoft"}
              </p>
              <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                {b.meta_description || b.chapeau || "La description apparaîtra ici."}
              </p>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
              Partage social
            </p>
            <div className="rounded border border-slate-200 overflow-hidden bg-white">
              <Vignette
                image={b.image}
                motif={b.motif}
                accent={b.accent}
                titreFantome={b.titre_fantome}
                etiquette={b.categorie || spec.nom}
                className="w-full h-20 block"
              />
              <div className="p-2 border-t border-slate-100">
                <p className="text-[9px] uppercase tracking-wide text-slate-400">megasoft-office.com</p>
                <p className="text-[11.5px] font-bold text-slate-800 leading-snug line-clamp-2">
                  {b.titre || "Titre de l'article"}
                </p>
                <p className="text-[10px] text-slate-500 leading-snug line-clamp-1">
                  {b.meta_description || b.chapeau}
                </p>
              </div>
            </div>
          </Panneau>

          {/* ---------- Mise en ligne ----------
              Deux gestes bien distincts. Le brouillon s'enregistre TOUJOURS,
              même incomplet : c'est précisément à quoi sert un brouillon, et
              l'ancien bouton unique — bloqué tant que les contrôles n'étaient
              pas levés — empêchait de mettre de côté un article commencé. Seule
              la publication reste conditionnée. */}
          <Panneau
            titre="Enregistrer ou publier"
            action={
              <Pastille ton={b.statut === "publie" ? "ok" : "neutre"}>
                {b.statut === "publie" ? "En ligne" : b.statut}
              </Pastille>
            }
          >
            <div className="flex gap-2 flex-wrap mb-3">
              <Bouton
                variante={b.statut === "publie" ? "neutre" : "principal"}
                disabled={envoi || !b.titre.trim() || !b.slug.trim()}
                onClick={() => void enregistrer("brouillon")}
              >
                {enregistre === "brouillon" ? "Mis de côté" : "Enregistrer le brouillon"}
              </Bouton>
              <Bouton
                variante={b.statut === "publie" ? "principal" : "neutre"}
                disabled={envoi || !publiable}
                onClick={() => void enregistrer("publie")}
              >
                {envoi
                  ? "Envoi…"
                  : enregistre === "publie"
                    ? "Publié"
                    : dejaPublie
                      ? "Mettre à jour l'article publié"
                      : "Publier"}
              </Bouton>
              {dejaPublie && (
                <Bouton
                  variante="discret"
                  disabled={envoi}
                  onClick={() => void enregistrer("brouillon")}
                >
                  Dépublier
                </Bouton>
              )}
            </div>

            {/* Le refus du serveur, à l'endroit exact où l'on a cliqué. Sans
                cela il ne restait que le bandeau général du panel — que
                personne ne regarde en visant le bouton « Publier ». */}
            {echec && (
              <div className="ms-insere mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                <p className="text-[11.5px] font-bold text-red-800 leading-snug">
                  Rien n'a été publié. {echec.message}
                </p>
                {echec.bloquants && echec.bloquants.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {echec.bloquants.map((m) => (
                      <li key={m} className="text-[11px] text-red-700 leading-snug">
                        — {m}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Modifications croisées : les deux versions, et le choix. Sans
                cet écran, le refus ci-dessus était un mur — le texte restait
                à l'écran, impossible à enregistrer, sans savoir ce que l'autre
                personne avait changé. */}
            {conflit && (
              <Conflit
                mien={b as unknown as Record<string, unknown>}
                distant={conflit.distant}
                onReprendre={reprendre}
                onEcraser={ecraser}
                onFermer={() => setConflit(null)}
              />
            )}

            {!b.titre.trim() || !b.slug.trim() ? (
              <p className="text-[10.5px] text-amber-700">
                Un titre et une adresse suffisent à mettre l'article de côté.
              </p>
            ) : !publiable ? (
              <p className="text-[10.5px] text-red-600">
                Publication bloquée : {bloquants.length} contrôle{bloquants.length > 1 ? "s" : ""} rouge
                {bloquants.length > 1 ? "s" : ""} à lever. Le brouillon, lui, s'enregistre dès maintenant.
              </p>
            ) : (
              <p className="text-[10.5px] text-emerald-700">Tous les contrôles bloquants sont levés.</p>
            )}

            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-[10.5px] text-slate-500 leading-snug mb-2">
                Le service de publication automatique arrive au lot 3.1, avec la migration de l'hébergement. En
                attendant, l'article publié s'exporte au format attendu : le fichier se dépose dans
                <code className="mx-1 px-1 bg-slate-100 rounded font-mono text-[10px]">content/blog/</code>
                et il est en ligne à la construction suivante.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Bouton onClick={telecharger} disabled={!publiable}>
                  Télécharger le .md
                </Bouton>
                <Bouton onClick={copier} disabled={!publiable}>
                  {copie ? "Copié" : "Copier"}
                </Bouton>
              </div>
            </div>
          </Panneau>
        </div>
      </div>
    </div>
  );
};

export default Editeur;
