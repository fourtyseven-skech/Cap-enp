import { useEffect, useMemo, useRef, useState } from "react";
import {
  articles,
  journal,
  MODE_STOCKAGE,
  redirections,
  sauvegarde,
  surChangement,
  utilisateurs,
  type Role,
  type Utilisateur,
} from "./depot";
import { versMarkdown } from "./brouillon";
import { ChangerMotDePasse } from "./MotDePasse";
import type { CompteCree } from "./depot";
import { listerMedias, quota, type Media } from "./sourceMedias";
import {
  Bouton,
  Champ,
  Liste,
  MenuActions,
  Onglets,
  Panneau,
  Pastille,
  Saisie,
  SelecteurDate,
  Tuile,
  Zone,
} from "./ui";
import { relatif } from "./dates";

/**
 * Outils d'exploitation.
 *
 * Ce sont les fonctions qu'on ne prévoit jamais au départ et qui surgissent
 * toujours : corriger une information présente dans tous les articles, revenir
 * sur une suppression, rediriger une adresse qu'on a dû changer, et surtout
 * emporter une copie du travail. Tant qu'il n'y a pas de serveur, ce navigateur
 * est le seul endroit où vivent les modifications — un profil effacé et tout
 * disparaît, sans avertissement et sans recours.
 */

/**
 * L'ÉTAT DE L'ÉQUIPE, ET LA RECOMMANDATION QUI VA AVEC.
 *
 * Trois règles, et ce ne sont pas des préférences de style :
 *
 *   · DEUX ADMINISTRATEURS AU MOINS. Avec un seul, une absence, un départ ou
 *     un mot de passe perdu ferme l'administration jusqu'à une intervention
 *     dans la base. Le serveur empêche déjà de supprimer le dernier — mais
 *     « un seul » est une situation qu'on ne devrait jamais atteindre.
 *   · UN COMPTE PAR PERSONNE. Un compte partagé rend le journal muet : on sait
 *     qu'une page a été modifiée, jamais par qui. C'est précisément ce que ce
 *     journal existe pour dire.
 *   · PAS PLUS DE COMPTES QUE DE PERSONNES QUI ÉCRIVENT VRAIMENT. Chaque
 *     compte actif est une porte ouverte ; celles qui ne servent pas se
 *     désactivent (elles ne se suppriment pas : l'historique doit rester
 *     rattachable à son auteur).
 *
 * Pour ce site : deux administrateurs et une personne chargée du contenu
 * suffisent. Au-delà de six comptes actifs, le panel le signale — sans rien
 * interdire : c'est à la Direction de savoir qui doit entrer chez elle.
 */
const EFFECTIF_CONSEILLE = 6;

const Effectif = ({ comptes }: { comptes: Utilisateur[] }) => {
  const actifs = comptes.filter((u) => u.actif);
  const admins = actifs.filter((u) => u.role === "administrateur");

  const alerte =
    admins.length < 2
      ? {
          ton: "alerte" as const,
          texte:
            admins.length === 0
              ? "Aucun administrateur actif. L'administration ne peut plus être gérée depuis le panel."
              : "Un seul administrateur actif. Une absence ou un mot de passe perdu fermerait l'administration : nommez-en un second.",
        }
      : actifs.length > EFFECTIF_CONSEILLE
        ? {
            ton: "alerte" as const,
            texte: `${actifs.length} comptes actifs. Chacun est un accès à part entière : désactivez ceux qui ne servent plus.`,
          }
        : null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Pastille ton={admins.length >= 2 ? "ok" : "alerte"}>
          {admins.length} administrateur{admins.length > 1 ? "s" : ""}
        </Pastille>
        <Pastille ton="neutre">{actifs.length} compte{actifs.length > 1 ? "s" : ""} actif{actifs.length > 1 ? "s" : ""}</Pastille>
        {comptes.length > actifs.length && (
          <Pastille ton="neutre">{comptes.length - actifs.length} désactivé(s)</Pastille>
        )}
      </div>

      {alerte && (
        <div className="p-2 rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-[10.5px] leading-snug text-amber-900">{alerte.texte}</p>
        </div>
      )}

      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Recommandé : <strong>deux administrateurs</strong> — pour qu'une absence ne ferme jamais
        l'administration — et <strong>un compte par personne</strong>, jamais partagé : c'est ce qui
        permet au journal de dire qui a fait quoi. Un compte qui ne sert plus se désactive plutôt
        qu'il ne se supprime, pour que l'historique reste rattaché à son auteur.
      </p>
    </div>
  );
};

const ROLES: { v: Role; nom: string; note: string }[] = [
  { v: "administrateur", nom: "Administrateur", note: "Publie, supprime, gère les comptes." },
  { v: "redacteur", nom: "Rédacteur", note: "Écrit et propose, ne publie pas." },
  { v: "relecteur", nom: "Relecteur", note: "Lit et commente, ne modifie pas." },
];

type Section = "sauvegarde" | "contenu" | "adresses" | "comptes";

const ko = (o: number) => `${Math.round(o / 1024)} Ko`;

const telechargerFichier = (contenu: string, nom: string, type = "text/plain;charset=utf-8") => {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(lien.href);
};

/* ------------------------------------------------------------------------- */

const Outils = ({ acteur }: { acteur: string }) => {
  const [, forcer] = useState(0);
  useEffect(() => surChangement(() => forcer((n) => n + 1)), []);
  const [section, setSection] = useState<Section>("sauvegarde");
  const [medias, setMedias] = useState<Media[]>([]);
  const [espace, setEspace] = useState<{ utiliseMo: number; disponibleMo: number } | null>(null);

  useEffect(() => {
    listerMedias()
      .then(setMedias)
      .catch(() => setMedias([]));
    quota().then(setEspace);
  }, []);

  const liste = articles.lister();
  const corbeille = articles.corbeille();

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="ms-cascade grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tuile libelle="Articles gérés" valeur={liste.length} detail={`${corbeille.length} à la corbeille`} />
        <Tuile libelle="Images" valeur={medias.length} detail="Médiathèque du navigateur" />
        <Tuile libelle="Redirections" valeur={redirections.lister().length} detail="Anciennes adresses conservées" />
        <Tuile
          libelle="Données du panel"
          valeur={ko(sauvegarde.poids())}
          ton={sauvegarde.poids() > 4_000_000 ? "alerte" : "neutre"}
          detail={espace ? `${espace.utiliseMo} Mo utilisés au total` : "Texte des articles et journal"}
        />
      </div>

      <div className="ms-carte px-2 pt-1">
        <Onglets
          valeur={section}
          onChange={(v) => setSection(v)}
          variante="souligne"
          items={[
            ["sauvegarde", "Sauvegarde"],
            ["contenu", "Contenu"],
            ["adresses", "Adresses"],
            ["comptes", "Comptes"],
          ]}
        />
      </div>

      <div key={section} className="ms-entre-vue space-y-4">
        {section === "sauvegarde" && <Sauvegarde acteur={acteur} liste={liste} medias={medias} />}
        {section === "contenu" && <Contenu acteur={acteur} />}
        {section === "adresses" && <Adresses acteur={acteur} />}
        {section === "comptes" && <Comptes acteur={acteur} />}
      </div>
    </div>
  );
};

/* ===========================================================================
   SAUVEGARDE
   ========================================================================= */

const Sauvegarde = ({
  acteur,
  liste,
  medias,
}: {
  acteur: string;
  liste: ReturnType<typeof articles.lister>;
  medias: Media[];
}) => {
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [mode, setMode] = useState<"fusion" | "remplacement">("fusion");
  const [confirmeReset, setConfirmeReset] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  const exporterMarkdown = () => {
    const bloc = liste
      .map((a) => `${"=".repeat(70)}\nFICHIER : content/blog/${a.slug}.md\n${"=".repeat(70)}\n\n${versMarkdown(a, medias)}`)
      .join("\n\n");
    telechargerFichier(bloc, `blog-megasoft-${new Date().toISOString().slice(0, 10)}.txt`);
    journal.ecrire(acteur, "export", `${liste.length} article(s)`, "Markdown");
  };

  const exporterSauvegarde = () => {
    telechargerFichier(
      JSON.stringify(sauvegarde.exporter(), null, 2),
      `sauvegarde-megasoft-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json"
    );
    journal.ecrire(acteur, "export", "sauvegarde complète", "JSON");
  };

  const restaurer = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = sauvegarde.importer(JSON.parse(await f.text()), mode, acteur);
      setMessage({ ok: r.ok, texte: r.message });
    } catch {
      setMessage({ ok: false, texte: "Fichier illisible : ce n'est pas du JSON valide." });
    }
    if (fichier.current) fichier.current.value = "";
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panneau titre="Sauvegarde complète" action={<Pastille ton="alerte">Recommandé chaque semaine</Pastille>}>
        <p className="text-[11px] leading-relaxed text-slate-600 mb-3">
          Emporte l'état complet du panel — articles, historique des versions, comptes, redirections et journal —
          dans un seul fichier. C'est la <strong>seule</strong> sauvegarde qui sache être réinstallée : l'export
          Markdown, lui, sert à déposer les fichiers dans le dépôt et ne permet pas de revenir en arrière.
        </p>
        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 mb-3">
          <p className="text-[10.5px] leading-snug text-amber-900">
            Les images de la médiathèque ne sont pas incluses : elles vivent dans une autre base du navigateur et
            pèsent plusieurs mégaoctets. Elles restent en place tant que ce profil n'est pas effacé.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="principal" onClick={exporterSauvegarde}>
            Télécharger la sauvegarde
          </Bouton>
          <Bouton onClick={exporterMarkdown}>Exporter les {liste.length} articles en Markdown</Bouton>
        </div>
      </Panneau>

      <Panneau titre="Restaurer une sauvegarde">
        <Champ
          label="Mode de restauration"
          aide={
            mode === "fusion"
              ? "Conserve tout ce qui existe et n'ajoute que ce qui manque. Aucun risque de perdre un article écrit depuis la sauvegarde."
              : "Efface l'état actuel et le remplace intégralement par celui du fichier. À réserver à un poste vierge."
          }
        >
          <Liste value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="fusion">Fusionner — n'ajoute que l'absent</option>
            <option value="remplacement">Remplacer tout</option>
          </Liste>
        </Champ>

        <input
          ref={fichier}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => restaurer(e.target.files?.[0])}
        />
        <Bouton
          variante={mode === "remplacement" ? "principal" : "neutre"}
          onClick={() => fichier.current?.click()}
        >
          Choisir un fichier de sauvegarde
        </Bouton>

        {message && (
          <p
            className={`ms-insere mt-3 p-2 rounded-lg border text-[11px] leading-snug ${
              message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.texte}
          </p>
        )}

        {/* ---- Zone sensible ---- */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1.5">Zone sensible</p>
          <p className="text-[10.5px] leading-snug text-slate-500 mb-2">
            Efface toutes les données locales du panel. Les fichiers Markdown déjà présents dans le dépôt ne sont
            pas touchés : le blog en ligne reste identique. Le journal est conservé — c'est la seule trace de
            l'opération.
          </p>
          {confirmeReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-red-700">Confirmer l'effacement ?</span>
              <Bouton
                variante="principal"
                onClick={() => {
                  sauvegarde.reinitialiser(acteur);
                  setConfirmeReset(false);
                  setMessage({ ok: true, texte: "Données locales effacées." });
                }}
              >
                Oui, tout effacer
              </Bouton>
              <Bouton variante="discret" onClick={() => setConfirmeReset(false)}>
                Annuler
              </Bouton>
            </div>
          ) : (
            <Bouton variante="neutre" onClick={() => setConfirmeReset(true)}>
              Effacer les données locales
            </Bouton>
          )}
        </div>
      </Panneau>
    </div>
  );
};

/* ===========================================================================
   CONTENU — remplacement global et corbeille
   ========================================================================= */

const Contenu = ({ acteur }: { acteur: string }) => {
  const [cherche, setCherche] = useState("");
  const [par, setPar] = useState("");
  const [sensible, setSensible] = useState(false);
  const [motEntier, setMotEntier] = useState(false);
  const [fait, setFait] = useState<string | null>(null);
  const liste = articles.lister();
  const corbeille = articles.corbeille();

  /**
   * Aperçu avant action. Un remplacement global sans prévisualisation est la
   * fonction la plus dangereuse d'un panel : elle touche tous les articles à la
   * fois, y compris ceux déjà en ligne, et la faute de frappe ne se découvre
   * qu'après. Chaque occurrence est donc montrée dans son contexte.
   */
  const analyse = useMemo(() => {
    const motif = cherche.trim();
    if (!motif) return null;
    let rx: RegExp;
    try {
      const echappe = motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      rx = new RegExp(motEntier ? `\\b${echappe}\\b` : echappe, sensible ? "g" : "gi");
    } catch {
      return null;
    }
    const touches = liste
      .map((a) => {
        const trouves = [...a.corps.matchAll(rx)];
        return {
          a,
          n: trouves.length,
          extraits: trouves.slice(0, 3).map((m) => {
            const i = m.index ?? 0;
            return {
              avant: a.corps.slice(Math.max(0, i - 42), i),
              trouve: m[0],
              apres: a.corps.slice(i + m[0].length, i + m[0].length + 42),
            };
          }),
        };
      })
      .filter((x) => x.n > 0);
    return { rx, touches, total: touches.reduce((s, t) => s + t.n, 0) };
  }, [cherche, sensible, motEntier, liste]);

  /*
   * Le remplacement global touche plusieurs articles d'affilée.
   *
   * Les écritures partaient autrefois toutes ensemble, sans être attendues :
   * si la troisième était refusée, le compte-rendu annonçait quand même « 12
   * occurrences remplacées ». On les enchaîne donc une par une, et le
   * compte-rendu ne dit que ce qui a réellement abouti.
   *
   * En série plutôt qu'en parallèle : le serveur limite les écritures à 60 par
   * minute, et un remplacement sur trente articles les enverrait toutes dans
   * la même seconde.
   */
  const remplacer = async () => {
    if (!analyse?.touches.length) return;

    let reussis = 0;
    let occurrences = 0;
    const refuses: string[] = [];

    for (const { a, n } of analyse.touches) {
      try {
        await articles.enregistrer({ ...a, corps: a.corps.replace(analyse.rx, par) }, acteur);
        reussis += 1;
        occurrences += n;
      } catch {
        refuses.push(a.titre);
      }
    }

    if (reussis > 0) {
      journal.ecrire(
        acteur,
        "remplacement-global",
        `${reussis} article(s)`,
        `« ${cherche} » → « ${par} »`
      );
    }

    setFait(
      `${occurrences} occurrence(s) remplacée(s) dans ${reussis} article(s).` +
        (refuses.length ? ` ${refuses.length} article(s) refusé(s) : ${refuses.join(", ")}.` : "")
    );
    setCherche("");
    setPar("");
    setTimeout(() => setFait(null), 6000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panneau titre="Rechercher et remplacer partout">
        <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
          Le jour où un numéro de téléphone, une adresse ou un nom de module change, il faut le corriger dans
          tous les articles à la fois. Chaque modification crée une version : le retour arrière reste possible,
          article par article, depuis l'onglet Articles.
        </p>
        <Champ label="Rechercher">
          <Saisie value={cherche} onChange={(e) => setCherche(e.target.value)} placeholder="+213 (0)23 46 99 29" />
        </Champ>
        <Champ label="Remplacer par" aide="Laisser vide supprime le texte trouvé.">
          <Saisie value={par} onChange={(e) => setPar(e.target.value)} />
        </Champ>

        <div className="flex flex-wrap gap-3 mb-3">
          {[
            { c: sensible, f: setSensible, l: "Respecter la casse" },
            { c: motEntier, f: setMotEntier, l: "Mot entier uniquement" },
          ].map((o) => (
            <label key={o.l} className="flex items-center gap-1.5 cursor-pointer select-none">
              <span
                onClick={() => o.f(!o.c)}
                className={`w-8 h-[18px] rounded-full p-0.5 transition-colors duration-200 ${
                  o.c ? "bg-slate-900" : "bg-slate-300"
                }`}
              >
                <span
                  className="block w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ease-ressort"
                  style={{ transform: o.c ? "translateX(14px)" : "none" }}
                />
              </span>
              <span className="text-[11px] font-semibold text-slate-600">{o.l}</span>
            </label>
          ))}
        </div>

        {analyse && (
          <div className="ms-insere mb-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
            {analyse.touches.length === 0 ? (
              <p className="text-[11px] text-slate-500">Aucune occurrence.</p>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-slate-700 mb-1.5">
                  {analyse.total} occurrence(s) dans {analyse.touches.length} article(s)
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {analyse.touches.map(({ a, n, extraits }) => (
                    <div key={a.slug} className="rounded-md bg-white border border-slate-200 p-2">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {a.titre} <span className="font-mono text-slate-400">×{n}</span>
                      </p>
                      {extraits.map((e, i) => (
                        <p key={i} className="mt-0.5 text-[10px] font-mono leading-snug text-slate-500 truncate">
                          …{e.avant}
                          <mark className="bg-amber-200 text-slate-900 px-0.5 rounded-sm">{e.trouve}</mark>
                          {par && <span className="bg-emerald-100 text-emerald-800 px-0.5 rounded-sm">{par}</span>}
                          {e.apres}…
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <Bouton variante="principal" disabled={!analyse?.touches.length} onClick={() => void remplacer()}>
          Remplacer dans {analyse?.touches.length ?? 0} article(s)
        </Bouton>
        {fait && <p className="ms-insere mt-2 text-[11px] text-emerald-700">{fait}</p>}
      </Panneau>

      <Panneau
        titre={`Corbeille — ${corbeille.length}`}
        action={corbeille.length > 0 ? <Pastille ton="alerte">Réversible</Pastille> : undefined}
      >
        <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
          Rien n'est effacé définitivement depuis le panel. Une page déjà indexée qui disparaît fait perdre le
          référencement acquis et laisse des liens morts sur le web.
        </p>
        {corbeille.length === 0 ? (
          <p className="text-[12px] text-slate-400">Corbeille vide.</p>
        ) : (
          <div className="ms-cascade space-y-1.5">
            {corbeille.map((a) => (
              <div key={a.slug} className="ms-rang flex items-center gap-2 p-2 rounded-lg border border-slate-200">
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold text-slate-800 truncate">{a.titre}</span>
                  <span className="block text-[10px] font-mono text-slate-400 truncate">
                    /blog/{a.slug}/ · retiré {relatif(a.maj_le)}
                  </span>
                </span>
                <Bouton variante="neutre" className="shrink-0" onClick={() => void articles.restaurer(a.slug, acteur).catch(() => undefined)}>
                  Restaurer
                </Bouton>
              </div>
            ))}
          </div>
        )}
      </Panneau>
    </div>
  );
};

/* ===========================================================================
   ADRESSES — redirections et fichiers techniques
   ========================================================================= */

const Adresses = ({ acteur }: { acteur: string }) => {
  const [de, setDe] = useState("");
  const [vers, setVers] = useState("");
  const [code, setCode] = useState<"301" | "302">("301");
  const [depuis, setDepuis] = useState(new Date().toISOString().slice(0, 10));
  const liste = redirections.lister();
  const publies = articles.lister().filter((a) => a.statut === "publie");

  const valide = /^\//.test(de.trim()) && /^(\/|https?:\/\/)/.test(vers.trim()) && de.trim() !== vers.trim();

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...publies.map(
      (a) =>
        `  <url><loc>https://megasoft-office.com/blog/${a.slug}/</loc><lastmod>${a.maj_le ?? a.publie_le}</lastmod></url>`
    ),
    "</urlset>",
  ].join("\n");

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panneau titre={`Redirections — ${liste.length}`}>
        <p className="text-[11px] leading-relaxed text-slate-600 mb-3">
          Une adresse de page ne devrait jamais changer. Quand elle change quand même — faute de frappe repérée
          après coup, article renommé, rubrique réorganisée — la redirection est ce qui empêche les liens
          existants, les partages et les résultats de recherche de tomber sur une page introuvable.
        </p>
        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 mb-3">
          <p className="text-[10.5px] leading-snug text-slate-600">
            Le panel ne redirige pas lui-même : c'est l'hébergeur qui le fait. Il tient la liste et produit le
            bloc de règles à coller dans <code className="px-1 bg-white rounded font-mono text-[10px]">public/.htaccess</code>,
            lu par Apache et LiteSpeed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-3">
          <Champ label="Ancienne adresse" aide="Commence par une barre oblique.">
            <Saisie
              value={de}
              onChange={(e) => setDe(e.target.value)}
              placeholder="/blog/ancien-titre/"
              className="font-mono text-[12px]"
            />
          </Champ>
          <Champ label="Nouvelle adresse">
            <Saisie
              value={vers}
              onChange={(e) => setVers(e.target.value)}
              placeholder="/blog/nouveau-titre/"
              className="font-mono text-[12px]"
            />
          </Champ>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Champ
            label="Type"
            aide={
              code === "301"
                ? "Permanente : transmet le référencement acquis à la nouvelle page. C'est le choix normal."
                : "Temporaire : ne transmet rien. À réserver à une bascule que l'on compte annuler."
            }
          >
            <Liste value={code} onChange={(e) => setCode(e.target.value as typeof code)}>
              <option value="301">301 — permanente</option>
              <option value="302">302 — temporaire</option>
            </Liste>
          </Champ>
          <Champ label="En vigueur depuis" aide="Information de suivi, pour savoir quand la purge est possible.">
            <SelecteurDate value={depuis} onChange={(e) => setDepuis(e.target.value)} />
          </Champ>
        </div>

        <Bouton
          variante="principal"
          disabled={!valide}
          onClick={() => {
            redirections.ajouter(de.trim(), vers.trim(), Number(code) as 301 | 302, acteur);
            setDe("");
            setVers("");
          }}
        >
          Ajouter la redirection
        </Bouton>
        {de.trim() && !valide && (
          <p className="mt-2 text-[10.5px] text-amber-700">
            Les deux adresses doivent être différentes, et l'ancienne commencer par « / ».
          </p>
        )}

        {liste.length > 0 && (
          <div className="ms-cascade mt-4 space-y-1.5">
            {liste.map((r) => (
              <div key={r.id} className="ms-rang flex items-center gap-2 p-2 rounded-lg border border-slate-200">
                <Pastille ton={r.code === 301 ? "ok" : "alerte"}>{r.code}</Pastille>
                <span className="flex-1 min-w-0 text-[10.5px] font-mono text-slate-600 truncate">
                  {r.de} → {r.vers}
                </span>
                <MenuActions
                  actions={[
                    { libelle: "Copier la ligne", onClick: () => navigator.clipboard?.writeText(`${r.de}\t${r.vers}\t${r.code}`).catch(() => {}) },
                    { libelle: "Retirer", onClick: () => redirections.retirer(r.id, acteur), danger: true },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </Panneau>

      <Panneau titre="Fichiers techniques">
        <p className="text-[10.5px] leading-snug text-slate-500 mb-3">
          Générés à partir de l'état actuel du panel. À déposer à la racine du site publié.
        </p>

        <div className="space-y-2">
          {[
            {
              nom: "redirections.htaccess",
              detail: `${liste.length} redirection(s)`,
              contenu: redirections.versFichier(),
              vide: liste.length === 0,
              note: "À coller entre les marques du fichier public/.htaccess.",
            },
            {
              nom: "sitemap-blog.xml",
              detail: `${publies.length} article(s) publié(s)`,
              contenu: sitemap,
              vide: publies.length === 0,
              note: "Donne aux moteurs la liste des pages et leur date de dernière modification.",
            },
          ].map((f) => (
            <div key={f.nom} className="rounded-lg border border-slate-200 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-[11.5px] font-mono font-bold text-slate-800">{f.nom}</code>
                <span className="text-[10px] text-slate-400">{f.detail}</span>
                <span className="ml-auto">
                  <Bouton variante="neutre" disabled={f.vide} onClick={() => telechargerFichier(f.contenu, f.nom)}>
                    Télécharger
                  </Bouton>
                </span>
              </div>
              <p className="text-[10px] leading-snug text-slate-500">{f.note}</p>
              {!f.vide && (
                <Zone
                  readOnly
                  rows={4}
                  value={f.contenu}
                  className="mt-1.5 font-mono text-[10px] bg-slate-50"
                />
              )}
            </div>
          ))}
        </div>
      </Panneau>
    </div>
  );
};

/* ===========================================================================
   COMPTES
   ========================================================================= */

const Comptes = ({ acteur }: { acteur: string }) => {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("redacteur");
  /* Le compte qui vient d'être créé, avec son mot de passe provisoire. Affiché
     jusqu'à ce que l'administrateur l'écarte : c'est la SEULE fois où cette
     valeur existe en clair. */
  const [cree, setCree] = useState<CompteCree | null>(null);
  const [copie, setCopie] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const comptes: Utilisateur[] = utilisateurs.lister();

  const valide = nom.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const dejaPris = comptes.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panneau titre={`Comptes et rôles — ${comptes.length}`}>
        {MODE_STOCKAGE === "serveur" ? (
          <Effectif comptes={comptes} />
        ) : (
          <div className="p-2 mb-3 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-[10.5px] leading-snug text-amber-900">
              Mode atelier : ces rôles ne filtrent que l'affichage, et aucun mot de passe n'est vérifié.
              En mode serveur, chaque requête revérifie le rôle en base.
            </p>
          </div>
        )}

        <div className="ms-cascade space-y-1.5">
          {comptes.map((u) => (
            <div
              key={u.id}
              className={`ms-rang flex items-center gap-2 p-2 rounded-lg border border-slate-200 ${
                u.actif ? "" : "opacity-55"
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-slate-800 truncate">{u.nom}</span>
                  {!u.actif && <Pastille ton="neutre">désactivé</Pastille>}
                </span>
                <span className="block text-[10px] font-mono text-slate-400 truncate">{u.email}</span>
              </span>
              <Liste
                value={u.role}
                onChange={(e) => utilisateurs.majRole(u.id, e.target.value as Role, acteur)}
                className="w-[150px] shrink-0"
              >
                {ROLES.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.nom}
                  </option>
                ))}
              </Liste>
              <MenuActions
                actions={[
                  {
                    libelle: u.actif ? "Désactiver le compte" : "Réactiver le compte",
                    onClick: () => utilisateurs.basculerActif(u.id, acteur),
                    danger: u.actif,
                  },
                ]}
              />
            </div>
          ))}
        </div>
      </Panneau>

      <Panneau titre="Créer un compte">
        <div className="grid grid-cols-2 gap-x-3">
          <Champ label="Nom">
            <Saisie value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Amel" />
          </Champ>
          <Champ label="Adresse">
            <Saisie
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amel@megasoft-office.com"
            />
          </Champ>
        </div>
        <Champ label="Rôle" aide={ROLES.find((r) => r.v === role)?.note}>
          <Liste value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.nom}
              </option>
            ))}
          </Liste>
        </Champ>
        <Bouton
          variante="principal"
          disabled={!valide || dejaPris}
          onClick={async () => {
            setEchec(null);
            setCopie(false);
            try {
              /* On ATTEND, et on garde ce qui revient. L'appel était lancé sans
                 être attendu et son résultat jeté : le mot de passe provisoire
                 disparaissait à l'instant de sa création, et le compte restait
                 inutilisable. */
              const r = await utilisateurs.ajouter(nom.trim(), email.trim(), role, acteur);
              setCree(r);
              setNom("");
              setEmail("");
            } catch (e) {
              setEchec(e instanceof Error ? e.message : "La création a échoué.");
            }
          }}
        >
          Créer le compte
        </Bouton>
        {dejaPris && <p className="mt-2 text-[10.5px] text-amber-700">Cette adresse a déjà un compte.</p>}

        {echec && (
          <p className="ms-insere mt-2 text-[11px] leading-snug text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            {echec}
          </p>
        )}

        {cree && (
          <div className="ms-insere mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5">
            <p className="text-[11.5px] leading-snug text-emerald-900">
              <strong>Compte créé pour {cree.utilisateur.nom}</strong> — {cree.utilisateur.email}
            </p>

            {cree.motDePasseProvisoire ? (
              <>
                <p className="mt-2 text-[10.5px] uppercase tracking-wide font-bold text-emerald-800">
                  Mot de passe provisoire
                </p>
                {/* Sélectionnable et copiable : il ne sera plus JAMAIS affiché.
                    Le serveur n'en garde que l'empreinte. */}
                <code className="block mt-1 px-2 py-1.5 rounded bg-white border border-emerald-200 text-[12.5px] font-mono break-all select-all text-slate-800">
                  {cree.motDePasseProvisoire}
                </code>
                <div className="flex items-center gap-2 mt-2">
                  <Bouton
                    variante="neutre"
                    onClick={() => {
                      void navigator.clipboard.writeText(cree.motDePasseProvisoire ?? "");
                      setCopie(true);
                    }}
                  >
                    {copie ? "Copié" : "Copier"}
                  </Bouton>
                  {cree.courrielEnvoye ? (
                    <Pastille ton="ok">Envoyé aussi par courriel</Pastille>
                  ) : (
                    <Pastille ton="alerte">À transmettre vous-même</Pastille>
                  )}
                  <Bouton variante="neutre" onClick={() => setCree(null)}>
                    J'ai noté
                  </Bouton>
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-emerald-800">
                  Cette valeur ne réapparaîtra pas : le serveur n'en conserve qu'une empreinte.
                  {cree.courrielEnvoye
                    ? " Le message peut arriver dans les indésirables — d'où cet affichage."
                    : ` ${cree.courrielRaison ?? ""}`}{" "}
                  La personne le remplacera elle-même depuis « Mon mot de passe ».
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[10.5px] leading-snug text-emerald-800">
                Mode atelier : aucun mot de passe n'est vérifié, il n'y a donc rien à transmettre.
              </p>
            )}
          </div>
        )}

        <p className="mt-2 text-[10px] leading-snug text-slate-400">
          L'inscription libre n'existe pas : les comptes sont créés ici, et le rôle n'est jamais un champ que
          l'utilisateur renseigne lui-même.
        </p>
      </Panneau>

      {/* Le mot de passe de la personne connectée — pas ceux des autres. Un
          administrateur ne choisit jamais le mot de passe d'un tiers : il crée
          le compte, et son propriétaire prend la main dessus. */}
      <ChangerMotDePasse />
    </div>
  );
};

export default Outils;
