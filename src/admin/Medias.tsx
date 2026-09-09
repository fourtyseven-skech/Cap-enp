import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { articles, journal } from "./depot";
import {
  PLAFONDS,
  REGLES,
  importer,
  listerMedias,
  majMedia,
  quota,
  referencesDe,
  supprimerMedia,
  urlMedia,
  versHtml,
  versMarkdown,
  type Media,
} from "./sourceMedias";
import { Bouton, Champ, Liste, MenuActions, Panneau, Pastille, Saisie, Tuile, Zone } from "./ui";

/**
 * Médiathèque.
 *
 * Les plafonds sont appliqués à l'import, jamais rappelés dans une consigne :
 * c'est la seule façon d'éviter la dérive lente qui rend un blog illisible au
 * bout d'un an. Le précédent dans ce projet même : un logo client livré en
 * 3016 × 1332 pixels, soit plus de 15 Mo une fois décodé en mémoire, affiché
 * dans une vignette de 56 pixels de haut.
 *
 * Ce qui manquait pour en faire un outil utilisable au quotidien, et qui est
 * ajouté ici : voir OÙ une image est employée avant de la supprimer, retrouver
 * une image parmi deux cents, corriger un texte alternatif après coup, et
 * poser l'image dans un article sans passer par le presse-papiers.
 */

const ko = (n: number) => `${n} Ko`;
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type Tri = "recent" | "ancien" | "lourd" | "nom" | "emplois";

/* ---------------------------------------------------------------------------
 * Emplois — quels articles citent quelle image
 * ---------------------------------------------------------------------------
 * C'est le garde-fou qui manquait le plus : sans lui, supprimer une image
 * casse silencieusement des articles publiés, et on ne s'en aperçoit que
 * lorsqu'un lecteur tombe sur un cadre vide.
 * ------------------------------------------------------------------------- */
const useEmplois = () => {
  const liste = articles.lister();
  return useMemo(() => {
    const par = new Map<string, { slug: string; titre: string; statut: string }[]>();
    liste.forEach((a) => {
      referencesDe(a.corps).forEach((id) => {
        par.set(id, [...(par.get(id) ?? []), { slug: a.slug, titre: a.titre, statut: a.statut }]);
      });
    });
    return par;
  }, [liste]);
};

/* ------------------------------------------------------------------------- */

const Medias = ({ acteur }: { acteur: string }) => {
  const [liste, setListe] = useState<Media[]>([]);
  const [alt, setAlt] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [survolDepot, setSurvolDepot] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("recent");
  const [espace, setEspace] = useState<{ utiliseMo: number; disponibleMo: number } | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  const emplois = useEmplois();

  const recharger = useCallback(() => {
    listerMedias()
      .then(setListe)
      .catch(() => setListe([]));
    quota().then(setEspace);
  }, []);
  useEffect(() => recharger(), [recharger]);

  /* ---------------- Import ---------------- */

  const deposer = async (fichiers: FileList | File[] | null) => {
    const tab = fichiers ? Array.from(fichiers) : [];
    if (!tab.length) return;
    if (!alt.trim() && tab.length === 1) {
      setErreur("Le texte alternatif est obligatoire.");
      return;
    }
    setErreur(null);
    setEncours(true);
    for (let i = 0; i < tab.length; i++) {
      setProgression({ fait: i, total: tab.length });
      // Sur un lot, le texte alternatif saisi sert de base et le nom du fichier
      // distingue les images entre elles : un alt identique sur douze images
      // ne rend service à personne.
      const f = tab[i];
      const texte = tab.length > 1 ? `${alt.trim() || "Illustration"} — ${f.name.replace(/\.[^.]+$/, "")}` : alt;
      const r = await importer(f, texte, acteur);
      if (!r.ok || !r.media) {
        setErreur(`${f.name} — ${r.raison ?? "import refusé"}`);
        break;
      }
      journal.ecrire(acteur, "media-ajout", r.media.nom, `${r.media.largeur} px · ${ko(r.media.poids)}`);
    }
    setProgression(null);
    setEncours(false);
    setAlt("");
    if (champ.current) champ.current.value = "";
    recharger();
  };

  /* ---------------- Actions ---------------- */

  const retirer = async (m: Media) => {
    await supprimerMedia(m.id);
    journal.ecrire(acteur, "media-suppression", m.nom);
    setSelection((s) => {
      const n = new Set(s);
      n.delete(m.id);
      return n;
    });
    if (detail === m.id) setDetail(null);
    recharger();
  };

  const copier = async (cle: string, texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(cle);
      setTimeout(() => setCopie((c) => (c === cle ? null : c)), 1800);
    } catch {
      /* presse-papiers refusé */
    }
  };

  const telecharger = (m: Media) => {
    const a = document.createElement("a");
    a.href = urlMedia(m);
    a.download = `${m.nom}.webp`;
    a.click();
  };

  const basculerSelection = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /* ---------------- Liste filtrée ---------------- */

  const affichee = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtree = liste.filter((m) => {
      if (!q) return true;
      return (
        m.nom.toLowerCase().includes(q) ||
        m.alt.toLowerCase().includes(q) ||
        (m.legende ?? "").toLowerCase().includes(q) ||
        (m.etiquettes ?? []).some((e) => e.toLowerCase().includes(q))
      );
    });
    const nb = (m: Media) => emplois.get(m.id)?.length ?? 0;
    const ordres: Record<Tri, (a: Media, b: Media) => number> = {
      recent: (a, b) => b.cree_le.localeCompare(a.cree_le),
      ancien: (a, b) => a.cree_le.localeCompare(b.cree_le),
      lourd: (a, b) => b.poids - a.poids,
      nom: (a, b) => a.nom.localeCompare(b.nom, "fr"),
      emplois: (a, b) => nb(b) - nb(a),
    };
    return [...filtree].sort(ordres[tri]);
  }, [liste, recherche, tri, emplois]);

  const total = liste.reduce((s, m) => s + m.poids, 0);
  const inutilises = liste.filter((m) => !(emplois.get(m.id)?.length ?? 0)).length;
  const sansLegende = liste.filter((m) => !m.legende?.trim()).length;
  const ouvert = liste.find((m) => m.id === detail) ?? null;

  return (
    <div className="max-w-[1500px] mx-auto p-4 space-y-4">
      {/* ---------- Chiffres-clés ---------- */}
      <div className="ms-cascade grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tuile libelle="Images" valeur={liste.length} detail={`${ko(total)} au total`} />
        <Tuile
          libelle="Jamais employées"
          valeur={inutilises}
          ton={inutilises > 0 ? "alerte" : "ok"}
          detail="Aucun article ne les cite"
        />
        <Tuile libelle="Sans légende" valeur={sansLegende} detail="La légende est facultative" />
        <Tuile
          libelle="Espace navigateur"
          valeur={espace ? `${espace.utiliseMo} Mo` : "—"}
          detail={espace ? `sur ${espace.disponibleMo} Mo alloués à ce site` : "Non communiqué par le navigateur"}
        />
      </div>

      {/* ---------- Import ---------- */}
      <Panneau titre="Importer des images">
        <div className="grid md:grid-cols-[1fr_290px] gap-4">
          <div>
            <Champ
              label="Texte alternatif — obligatoire"
              aide="Décrit l'image pour les lecteurs d'écran et les moteurs. L'import est refusé sans lui : c'est un contrôle bloquant, pas une bonne pratique optionnelle. Sur un lot, le nom du fichier est ajouté pour distinguer les images."
            >
              <Saisie
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Écran de saisie des écritures dans MEGA COMPTA SCF"
              />
            </Champ>

            {/* Zone de dépôt : glisser un fichier depuis le bureau est le geste
                attendu partout ailleurs, l'absence se remarquait immédiatement. */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setSurvolDepot(true);
              }}
              onDragLeave={() => setSurvolDepot(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSurvolDepot(false);
                if (!alt.trim()) {
                  setErreur("Renseignez le texte alternatif avant de déposer.");
                  return;
                }
                deposer(e.dataTransfer.files);
              }}
              data-actif={survolDepot ? "1" : "0"}
              className={`ms-depot rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                !alt.trim() ? "border-slate-200 opacity-60" : survolDepot ? "border-ms-blue" : "border-slate-300"
              }`}
            >
              <p className="text-[12px] font-semibold text-slate-600">
                Glissez vos images ici, ou
                <button
                  type="button"
                  disabled={!alt.trim() || encours}
                  onClick={() => champ.current?.click()}
                  className="ms-presse ml-1 text-ms-blue underline underline-offset-2 disabled:no-underline disabled:text-slate-400"
                >
                  parcourez vos fichiers
                </button>
              </p>
              <p className="mt-1 text-[10.5px] text-slate-400">
                PNG, JPEG, WebP ou AVIF — plusieurs à la fois
              </p>
              <input
                ref={champ}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                multiple
                className="hidden"
                onChange={(e) => deposer(e.target.files)}
              />
            </div>

            {!alt.trim() && (
              <p className="mt-1.5 text-[10.5px] text-amber-700">
                Renseignez le texte alternatif pour débloquer l'import.
              </p>
            )}
            {progression && (
              <div className="mt-2">
                <p className="text-[11px] text-slate-500 mb-1">
                  Traitement — {progression.fait + 1} sur {progression.total}
                </p>
                <div className="h-[3px] rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-ms-blue transition-[width] duration-300"
                    style={{ width: `${((progression.fait + 1) / progression.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {erreur && (
              <p className="ms-insere mt-2 p-2 rounded-lg border border-red-200 bg-red-50 text-[11px] text-red-700">
                {erreur}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Ce que l'outil impose
            </p>
            {/* Les règles viennent de la source active : elles diffèrent selon
                que le traitement a lieu dans le navigateur ou sur le serveur.
                Les écrire en dur ici annoncerait au rédacteur des contraintes
                que rien n'applique. */}
            <ul className="space-y-1 text-[10.5px] text-slate-600 leading-snug">
              {REGLES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panneau>

      {/* ---------- Bibliothèque ---------- */}
      <Panneau
        titre={`Médiathèque — ${affichee.length} sur ${liste.length}`}
        action={
          selection.size > 0 ? (
            <span className="flex items-center gap-2">
              <Pastille ton="neutre">{selection.size} sélectionnée{selection.size > 1 ? "s" : ""}</Pastille>
              <Bouton
                variante="discret"
                onClick={() =>
                  copier(
                    "lot",
                    liste
                      .filter((m) => selection.has(m.id))
                      .map((m) => versMarkdown(m))
                      .join("\n\n")
                  )
                }
              >
                {copie === "lot" ? "Copié" : "Copier le Markdown"}
              </Bouton>
              <Bouton
                variante="discret"
                onClick={async () => {
                  for (const m of liste.filter((x) => selection.has(x.id))) await retirer(m);
                  setSelection(new Set());
                }}
              >
                Supprimer
              </Bouton>
              <Bouton variante="discret" onClick={() => setSelection(new Set())}>
                Annuler
              </Bouton>
            </span>
          ) : (
            <Pastille ton="neutre">{ko(total)}</Pastille>
          )
        }
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <Saisie
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un nom, un texte alternatif, une étiquette…"
            className="flex-1 min-w-[220px]"
          />
          <Liste value={tri} onChange={(e) => setTri(e.target.value as Tri)} className="w-[190px]">
            <option value="recent">Les plus récentes</option>
            <option value="ancien">Les plus anciennes</option>
            <option value="lourd">Les plus lourdes</option>
            <option value="emplois">Les plus employées</option>
            <option value="nom">Par nom</option>
          </Liste>
        </div>

        {affichee.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-slate-400">
            {liste.length === 0 ? "Aucune image importée." : "Aucune image ne correspond."}
          </p>
        ) : (
          <div key={`${recherche}|${tri}`} className="ms-cascade grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {affichee.map((m) => {
              const usages = emplois.get(m.id) ?? [];
              const choisie = selection.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`ms-levier group relative rounded-lg border overflow-hidden bg-white ${
                    choisie ? "border-ms-blue ring-1 ring-ms-blue" : "border-slate-200"
                  }`}
                >
                  {/* La case de sélection ne s'affiche qu'au survol tant que
                      rien n'est sélectionné : sinon elle occupe l'écran en
                      permanence pour une action occasionnelle. */}
                  <button
                    type="button"
                    onClick={() => basculerSelection(m.id)}
                    title="Sélectionner"
                    className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-md border-2 text-[11px] font-bold leading-none transition-all duration-150 ${
                      choisie
                        ? "bg-ms-blue border-ms-blue text-white opacity-100"
                        : "bg-white/90 border-white text-transparent opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    ✓
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetail(m.id)}
                    className="block w-full text-left"
                    title="Voir le détail"
                  >
                    <img
                      src={urlMedia(m, PLAFONDS.tailles[0])}
                      alt={m.alt}
                      className="w-full h-24 object-cover bg-slate-100"
                      loading="lazy"
                    />
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-slate-800 truncate" title={m.nom}>
                        {m.nom}
                      </p>
                      <p className="text-[9.5px] text-slate-400 truncate" title={m.alt}>
                        {m.alt}
                      </p>
                      <p className="mt-1 text-[9.5px] font-mono text-slate-400">
                        {m.largeur}×{m.hauteur} · {ko(m.poids)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 px-2 pb-2">
                    {usages.length > 0 ? (
                      <Pastille ton="ok">{usages.length} emploi{usages.length > 1 ? "s" : ""}</Pastille>
                    ) : (
                      <Pastille ton="neutre">inutilisée</Pastille>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <Bouton variante="neutre" onClick={() => copier(m.id, versMarkdown(m))}>
                        {copie === m.id ? "Copié" : "Copier"}
                      </Bouton>
                      <MenuActions
                        actions={[
                          { libelle: "Voir le détail", onClick: () => setDetail(m.id) },
                          { libelle: "Copier le HTML", onClick: () => copier(`h${m.id}`, versHtml(m)) },
                          { libelle: "Télécharger", onClick: () => telecharger(m) },
                          {
                            libelle: usages.length ? `Employée ${usages.length}× — supprimer` : "Supprimer",
                            onClick: () => retirer(m),
                            danger: true,
                          },
                        ]}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panneau>

      {/* ---------- Détail ---------- */}
      {ouvert && (
        <DetailMedia
          media={ouvert}
          emplois={emplois.get(ouvert.id) ?? []}
          onFermer={() => setDetail(null)}
          onMaj={async (patch) => {
            await majMedia(ouvert.id, patch);
            recharger();
          }}
          onCopier={copier}
          copie={copie}
        />
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Fiche détaillée
 * ---------------------------------------------------------------------------
 * Le texte alternatif est exigé à l'import, mais il était ensuite figé — or
 * c'est justement le champ qu'on améliore après coup, une fois l'article écrit
 * et le contexte de l'image connu.
 * ------------------------------------------------------------------------- */

const DetailMedia = ({
  media,
  emplois,
  onFermer,
  onMaj,
  onCopier,
  copie,
}: {
  media: Media;
  emplois: { slug: string; titre: string; statut: string }[];
  onFermer: () => void;
  onMaj: (p: Partial<Pick<Media, "nom" | "alt" | "legende" | "etiquettes">>) => Promise<void>;
  onCopier: (cle: string, texte: string) => void;
  copie: string | null;
}) => {
  const [nom, setNom] = useState(media.nom);
  const [alt, setAlt] = useState(media.alt);
  const [legende, setLegende] = useState(media.legende ?? "");
  const [etiquettes, setEtiquettes] = useState((media.etiquettes ?? []).join(", "));
  const [enregistre, setEnregistre] = useState(false);

  // La fiche change de sujet quand on ouvre une autre image : les champs
  // doivent suivre, sinon on éditerait l'ancienne sans s'en rendre compte.
  useEffect(() => {
    setNom(media.nom);
    setAlt(media.alt);
    setLegende(media.legende ?? "");
    setEtiquettes((media.etiquettes ?? []).join(", "));
  }, [media.id, media.nom, media.alt, media.legende, media.etiquettes]);

  const modifie =
    nom !== media.nom ||
    alt !== media.alt ||
    legende !== (media.legende ?? "") ||
    etiquettes !== (media.etiquettes ?? []).join(", ");

  const gain = media.origine
    ? Math.max(0, Math.round((1 - media.poids / Math.max(media.origine.poids, 1)) * 100))
    : null;

  return (
    <Panneau
      titre={`Fiche — ${media.nom}`}
      action={<Bouton variante="discret" onClick={onFermer}>Fermer</Bouton>}
    >
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div>
          <img
            src={urlMedia(media)}
            alt={media.alt}
            className="w-full rounded-lg border border-slate-200 bg-slate-100"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Servie</p>
              <p className="font-mono text-slate-700">
                {media.largeur}×{media.hauteur} · {ko(media.poids)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Déposée</p>
              <p className="font-mono text-slate-700">
                {media.origine ? `${media.origine.largeur}×${media.origine.hauteur} · ${ko(media.origine.poids)}` : "—"}
              </p>
            </div>
          </div>
          {gain !== null && gain > 0 && (
            <p className="mt-1.5 text-[10.5px] text-emerald-700">
              <strong>{gain} % de poids en moins</strong> après conversion WebP et redimensionnement.
            </p>
          )}
          <p className="mt-2 text-[10px] text-slate-400">
            Importée le {DATE.format(new Date(media.cree_le))} par {media.par} ·{" "}
            {media.variantes.length} déclinaisons ({media.variantes.map((v) => v.largeur).join(", ")} px)
          </p>
        </div>

        <div>
          <div className="grid sm:grid-cols-2 gap-x-3">
            <Champ label="Nom" aide="Interne au panel. N'apparaît pas dans l'article.">
              <Saisie value={nom} onChange={(e) => setNom(e.target.value)} />
            </Champ>
            <Champ label="Étiquettes" aide="Séparées par des virgules. Sert à retrouver l'image.">
              <Saisie
                value={etiquettes}
                onChange={(e) => setEtiquettes(e.target.value)}
                placeholder="capture, MEGA COMPTA"
              />
            </Champ>
          </div>
          <Champ
            label="Texte alternatif"
            aide="Lu par les lecteurs d'écran et indexé par les moteurs. Décrivez ce que l'image montre, pas ce qu'elle est."
            compteur={{ valeur: alt.length, max: 125 }}
          >
            <Zone rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} />
          </Champ>
          <Champ label="Légende" aide="Affichée sous l'image dans l'article. Facultative.">
            <Saisie value={legende} onChange={(e) => setLegende(e.target.value)} />
          </Champ>

          <div className="flex gap-2 mb-4">
            <Bouton
              variante="principal"
              disabled={!modifie || !alt.trim()}
              onClick={async () => {
                await onMaj({
                  nom: nom.trim(),
                  alt: alt.trim(),
                  legende: legende.trim(),
                  etiquettes: etiquettes
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                });
                setEnregistre(true);
                setTimeout(() => setEnregistre(false), 1600);
              }}
            >
              {enregistre ? "Enregistré" : "Enregistrer"}
            </Bouton>
            <Bouton onClick={() => onCopier(`d${media.id}`, versMarkdown(media))}>
              {copie === `d${media.id}` ? "Copié" : "Copier la référence"}
            </Bouton>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <p className="ms-carte-entete px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Employée dans {emplois.length} article{emplois.length > 1 ? "s" : ""}
            </p>
            {emplois.length === 0 ? (
              <p className="p-2.5 text-[11px] leading-snug text-slate-500">
                Aucun article ne cite cette image. Elle peut être supprimée sans rien casser — c'est la seule
                situation où la suppression est sans conséquence.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {emplois.map((e) => (
                  <li key={e.slug} className="flex items-center gap-2 px-2.5 py-1.5">
                    <span className="flex-1 min-w-0 text-[11.5px] text-slate-700 truncate">{e.titre}</span>
                    <Pastille ton={e.statut === "publie" ? "ok" : "neutre"}>{e.statut}</Pastille>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
              Référence à coller dans un article
            </p>
            <code className="block text-[10.5px] font-mono text-slate-700 break-all">{versMarkdown(media)}</code>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
              Le corps de l'article ne porte que cette référence courte ; l'image réelle y est substituée à
              l'aperçu et à l'export. Un jour où les fichiers seront hébergés sur le serveur, la même référence
              pointera vers un chemin — sans qu'aucun article écrit aujourd'hui n'ait à être repris.
            </p>
          </div>
        </div>
      </div>
    </Panneau>
  );
};

export default Medias;
