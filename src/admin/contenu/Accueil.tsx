import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS, type CleSection } from "@/contenu/schemas";
import { champsDe, ecrireValeur, lireValeur, type Champ } from "@/contenu/champs";
import { Bouton, Champ as Etiquette, Liste, Panneau, Pastille, Saisie, Zone } from "../ui";
import { ICONES } from "@/contenu/icones";
import { type CleIcone } from "@/contenu/clesIcones";
import { AVEC_BROUILLON, MODE_CONTENU, contenu, type Section } from "./depot";
import ChoixMedia from "../ChoixMedia";
import Presents from "../Presents";

/**
 * ---------------------------------------------------------------------------
 * ÉDITEUR DE LA PAGE D'ACCUEIL
 * ---------------------------------------------------------------------------
 *
 * Trois colonnes : les sections dans l'ordre réel de la page, les champs de
 * celle qu'on a choisie, et l'aperçu.
 *
 * LES CHAMPS NE SONT PAS ÉCRITS ICI
 * ---------------------------------
 * Ils sont déduits du schéma Zod de chaque section (`contenu/champs.ts`).
 * Ajouter un champ au modèle le fait apparaître dans le panel, sans toucher à
 * ce fichier. L'alternative — une description de formulaire à côté de chaque
 * schéma — demandait de tenir deux fichiers d'accord, et un oubli d'un côté ou
 * de l'autre passe inaperçu.
 *
 * CE QUE L'ÉDITEUR NE PERMET PAS, VOLONTAIREMENT
 * ----------------------------------------------
 * Ni ajouter ni supprimer une section : elles sont douze, et le site ne compile
 * pas sans elles. Ni changer le nombre d'éléments d'une liste dont le schéma
 * impose la longueur — quatre chiffres, trois pôles, trois avis : la mise en
 * page est construite sur ces comptes.
 *
 * Ce ne sont pas des restrictions de confort. Ce sont les seules choses qu'un
 * éditeur peut casser sans s'en apercevoir.
 */

/* ========================================================================= */
/* Contrôles                                                                 */
/* ========================================================================= */

/**
 * La valeur de départ d'un champ vide.
 *
 * Récursive, et c'est indispensable : un gabarit contient une liste dont le
 * schéma impose la longueur — trois points forts. Ajouter le gabarit avec une
 * liste vide affichait « 0 — nombre imposé » et AUCUN bouton pour la remplir,
 * puisqu'une liste de longueur fixe n'en propose pas. Le client se retrouvait
 * devant un bloc impossible à compléter.
 *
 * Les éléments imposés sont donc créés d'emblée, vides, prêts à être remplis.
 */
const valeurVierge = (champ: Champ): unknown => {
  switch (champ.genre) {
    case "nombre":
      return champ.min ?? 0;
    case "booleen":
      return false;
    case "liste":
      return champ.valeurs[0] ?? "";
    case "texteMultiple":
      return Array.from({ length: champ.mini }, () => "");
    case "objets":
      return Array.from({ length: champ.mini }, () =>
        Object.fromEntries(champ.champs.map((c) => [c.cle, valeurVierge(c)]))
      );
    case "variantes":
      return [];
    default:
      return "";
  }
};

type ProprietesChamp = {
  champ: Champ;
  valeur: unknown;
  onChange: (v: unknown) => void;
};

const ChampSimple = ({ champ, valeur, onChange }: ProprietesChamp) => {
  const aide = champ.genre === "texte" && champ.max ? `${String(valeur ?? "").length} / ${champ.max}` : undefined;

  /*
   * UN FICHIER SE CHOISIT À L'ŒIL.
   *
   * Ce champ affichait une zone de saisie où il fallait taper
   * « /medias/9f3a1c72-….webp » ou « /videos/hero-tms ». Le client voyait un
   * chemin, jamais l'image — et une faute de frappe ne se découvrait qu'au
   * build, ou sur le site en ligne.
   *
   * Le genre `media` est déduit du schéma lui-même (`contenu/champs.ts`), pas
   * du nom de la clé : un champ renommé reste reconnu, et un champ nommé
   * `image` qui contiendrait autre chose ne le serait pas.
   */
  if (champ.genre === "media") {
    return (
      <ChoixMedia
        valeur={String(valeur ?? "")}
        onChange={onChange}
        accepte={champ.accepte}
        libelle={champ.libelle}
        aide={
          champ.accepte === "video"
            ? "MP4 ou WebM. Les vidéos livrées avec le site existent en 480p et 720p ; une vidéo envoyée ici est servie telle quelle, d'où l'attention au poids."
            : "JPEG, PNG, WebP, AVIF ou GIF. La conversion en WebP est faite pour vous."
        }
      />
    );
  }

  if (champ.genre === "texte") {
    return (
      <Etiquette label={champ.libelle} aide={aide}>
        {champ.long ? (
          <Zone
            rows={3}
            maxLength={champ.max}
            value={String(valeur ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Saisie
            maxLength={champ.max}
            value={String(valeur ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Etiquette>
    );
  }

  if (champ.genre === "nombre") {
    return (
      <Etiquette label={champ.libelle}>
        <Saisie
          type="number"
          min={champ.min}
          max={champ.max}
          value={String(valeur ?? "")}
          /* `Number("")` vaut 0 : sans ce contrôle, vider le champ écrirait un
             zéro au lieu de laisser la saisie en cours. */
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </Etiquette>
    );
  }

  if (champ.genre === "liste") {
    /*
     * Une liste d'ICÔNES se choisit à l'œil, pas au nom de code.
     *
     * Elle passait par la liste déroulante ordinaire, qui affichait « serveur »,
     * « puzzle », « cartons » en toutes lettres : il fallait choisir un
     * pictogramme sans le voir, puis regarder l'aperçu pour savoir ce qu'on
     * avait pris.
     *
     * Une grille montre les quinze d'un coup — moins de place qu'un menu
     * déroulant de quinze lignes, et aucun geste pour l'ouvrir.
     */
    if (champ.icones) {
      const choisie = String(valeur ?? "");
      return (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              {champ.libelle}
            </span>
            <span className="text-[10.5px] text-slate-400">{choisie || "aucune"}</span>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {champ.valeurs.map((v) => {
              const Dessin = ICONES[v as CleIcone];
              const active = v === choisie;
              return (
                <button
                  key={v}
                  type="button"
                  title={v}
                  aria-label={v}
                  aria-pressed={active}
                  onClick={() => onChange(v)}
                  className={`aspect-square flex items-center justify-center rounded-md border transition-colors ${
                    active
                      ? "border-ms-blue bg-ms-blue/[0.07] text-ms-blue"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {Dessin ? <Dessin className="w-4 h-4" aria-hidden /> : <span>?</span>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <Etiquette label={champ.libelle}>
        <Liste value={String(valeur ?? "")} onChange={(e) => onChange(e.target.value)}>
          {champ.facultatif && <option value="">—</option>}
          {champ.valeurs.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Liste>
      </Etiquette>
    );
  }

  if (champ.genre === "booleen") {
    return (
      <label className="flex items-center gap-2 mb-3 text-[12px] text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(valeur)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {champ.libelle}
      </label>
    );
  }

  return null;
};

/** Une liste de textes simples : secteurs d'activité, tailles d'entreprise. */
const ListeDeTextes = ({ champ, valeur, onChange }: ProprietesChamp) => {
  if (champ.genre !== "texteMultiple") return null;
  const items = Array.isArray(valeur) ? (valeur as string[]) : [];

  const poser = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          {champ.libelle}
        </span>
        <span className="text-[10.5px] text-slate-400">
          {items.length} / {champ.maxi}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <Saisie
              maxLength={champ.max}
              value={item}
              onChange={(e) => poser(i, e.target.value)}
            />
            <Bouton
              variante="neutre"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              disabled={items.length <= champ.mini}
            >
              −
            </Bouton>
          </div>
        ))}
      </div>
      <Bouton
        variante="neutre"
        className="mt-2"
        onClick={() => onChange([...items, ""])}
        disabled={items.length >= champ.maxi}
      >
        Ajouter
      </Bouton>
    </div>
  );
};

/**
 * Une liste dont chaque élément suit l'un de plusieurs GABARITS.
 *
 * Le premier contrôle est la liste déroulante du gabarit ; les champs qui
 * suivent sont ceux du gabarit choisi. Changer de gabarit REMPLACE le contenu
 * de l'élément : les deux modèles n'ont pas les mêmes champs, et tenter de les
 * faire correspondre produirait des restes invisibles dans le fichier.
 *
 * C'est ce qui permet d'offrir deux modèles de section soignés plutôt qu'un
 * formulaire fourre-tout où la moitié des champs ne s'applique pas.
 */
const ListeDeGabarits = ({ champ, valeur, onChange }: ProprietesChamp) => {
  if (champ.genre !== "variantes") return null;
  const items = Array.isArray(valeur) ? (valeur as Record<string, unknown>[]) : [];

  const vierge = (v: (typeof champ.variantes)[number]) => ({
    [champ.discriminant]: v.valeur,
    ...Object.fromEntries(v.champs.map((c) => [c.cle, valeurVierge(c)])),
  });

  const poser = (i: number, cle: string, v: unknown) =>
    onChange(items.map((x, j) => (j === i ? ecrireValeur(x, cle, v) : x)));

  const deplacer = (i: number, pas: number) => {
    const j = i + pas;
    if (j < 0 || j >= items.length) return;
    const copie = [...items];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    onChange(copie);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          {champ.libelle}
        </span>
        <span className="text-[10.5px] text-slate-400">
          {items.length} / {champ.maxi}
        </span>
      </div>

      {!items.length && (
        <p className="text-[11.5px] text-slate-500 mb-2">
          Aucune section ajoutée. La page reste exactement telle qu'elle est.
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const choisi = String(item[champ.discriminant] ?? "");
          const variante = champ.variantes.find((v) => v.valeur === choisi) ?? champ.variantes[0];

          return (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono text-slate-400">#{i + 1}</span>
                <div className="flex items-center gap-1">
                  <Bouton variante="neutre" onClick={() => deplacer(i, -1)} disabled={i === 0}>
                    ↑
                  </Bouton>
                  <Bouton
                    variante="neutre"
                    onClick={() => deplacer(i, 1)}
                    disabled={i === items.length - 1}
                  >
                    ↓
                  </Bouton>
                  <Bouton
                    variante="neutre"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    Retirer
                  </Bouton>
                </div>
              </div>

              <Etiquette label="Modèle">
                <Liste
                  value={choisi}
                  onChange={(e) => {
                    const v = champ.variantes.find((x) => x.valeur === e.target.value);
                    if (v) onChange(items.map((x, j) => (j === i ? vierge(v) : x)));
                  }}
                >
                  {champ.variantes.map((v) => (
                    <option key={v.valeur} value={v.valeur}>
                      {v.libelle}
                    </option>
                  ))}
                </Liste>
              </Etiquette>

              {variante?.champs.map((sous) =>
                sous.genre === "objets" ? (
                  <ListeDObjets
                    key={sous.cle}
                    champ={sous}
                    valeur={item[sous.cle]}
                    onChange={(v) => poser(i, sous.cle, v)}
                    profondeur={1}
                  />
                ) : sous.genre === "texteMultiple" ? (
                  <ListeDeTextes
                    key={sous.cle}
                    champ={sous}
                    valeur={item[sous.cle]}
                    onChange={(v) => poser(i, sous.cle, v)}
                  />
                ) : (
                  <ChampSimple
                    key={sous.cle}
                    champ={sous}
                    valeur={lireValeur(item, sous.cle)}
                    onChange={(v) => poser(i, sous.cle, v)}
                  />
                )
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {champ.variantes.map((v) => (
          <Bouton
            key={v.valeur}
            variante="neutre"
            onClick={() => onChange([...items, vierge(v)])}
            disabled={items.length >= champ.maxi}
          >
            + {v.libelle}
          </Bouton>
        ))}
      </div>
    </div>
  );
};

/**
 * Une liste d'objets : les colonnes, les pôles, les avis…
 *
 * `profondeur` limite l'imbrication à deux niveaux — un pôle contient ses
 * entrées, et cela s'arrête là. Le modèle ne va pas plus loin, et une troisième
 * imbrication deviendrait illisible dans une colonne de formulaire.
 */
const ListeDObjets = ({
  champ,
  valeur,
  onChange,
  profondeur = 0,
}: ProprietesChamp & { profondeur?: number }) => {
  if (champ.genre !== "objets") return null;
  const items = Array.isArray(valeur) ? (valeur as Record<string, unknown>[]) : [];

  const poser = (i: number, cle: string, v: unknown) =>
    onChange(items.map((x, j) => (j === i ? ecrireValeur(x, cle, v) : x)));

  const vierge = () => Object.fromEntries(champ.champs.map((c) => [c.cle, valeurVierge(c)]));

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          {champ.libelle}
        </span>
        <span className="text-[10.5px] text-slate-400">
          {champ.fige ? `${items.length} — nombre imposé` : `${items.length} / ${champ.maxi}`}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-lg border border-slate-200 bg-white p-3 ${profondeur ? "" : "shadow-sm"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-400">#{i + 1}</span>
              {!champ.fige && (
                <Bouton
                  variante="neutre"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  disabled={items.length <= champ.mini}
                >
                  Retirer
                </Bouton>
              )}
            </div>

            {champ.champs.map((sous) =>
              sous.genre === "objets" ? (
                profondeur < 1 ? (
                  <ListeDObjets
                    key={sous.cle}
                    champ={sous}
                    valeur={item[sous.cle]}
                    onChange={(v) => poser(i, sous.cle, v)}
                    profondeur={profondeur + 1}
                  />
                ) : null
              ) : sous.genre === "texteMultiple" ? (
                <ListeDeTextes
                  key={sous.cle}
                  champ={sous}
                  valeur={item[sous.cle]}
                  onChange={(v) => poser(i, sous.cle, v)}
                />
              ) : (
                <ChampSimple
                  key={sous.cle}
                  champ={sous}
                  valeur={lireValeur(item, sous.cle)}
                  onChange={(v) => poser(i, sous.cle, v)}
                />
              )
            )}
          </div>
        ))}
      </div>

      {!champ.fige && (
        <Bouton
          variante="neutre"
          className="mt-2"
          onClick={() => onChange([...items, vierge()])}
          disabled={items.length >= champ.maxi}
        >
          Ajouter
        </Bouton>
      )}
    </div>
  );
};

/* ========================================================================= */
/* La vue                                                                    */
/* ========================================================================= */

const Accueil = () => {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [choisie, setChoisie] = useState<CleSection>("hero");
  const [travail, setTravail] = useState<Record<string, unknown>>({});
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const apercu = useRef<HTMLIFrameElement>(null);

  const recharger = useCallback(async () => {
    try {
      setSections(await contenu.lister());
    } catch (e) {
      setMessage({ ton: "erreur", texte: e instanceof Error ? e.message : "Lecture impossible." });
      setSections([]);
    }
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const section = sections?.find((s) => s.cle === choisie) ?? null;

  /* Le brouillon prime sur le publié : c'est là qu'on s'était arrêté. */
  useEffect(() => {
    if (!section) return;
    setTravail(structuredClone(section.brouillon ?? section.donnees));
    setModifie(false);
    setMessage(null);
  }, [section?.cle, section?.etiquette]); // eslint-disable-line react-hooks/exhaustive-deps

  const champs = useMemo(
    () => (section ? champsDe(SECTIONS[section.cle]) : []),
    [section?.cle] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Valide la section avec LE MÊME SCHÉMA QUE LA CONSTRUCTION DU SITE.
   *
   * ⚠️ C'est la correction du défaut le plus coûteux trouvé en test.
   *
   * Le panel n'utilisait les schémas que pour DESSINER ses champs, jamais pour
   * vérifier ce qu'on y saisissait. Une section libre publiée avec une
   * description d'image vide partait donc en base, le journal enregistrait
   * « publication », l'écran affichait « Publié » — et la reconstruction, elle,
   * refusait :
   *
   *     content/accueil/sections-libres.json · blocs.0.alt :
   *       La description de l'image ne peut pas être vide.
   *
   * Résultat : le site ne changeait jamais, et rien à l'écran ne l'expliquait.
   *
   * Le contrôle a désormais lieu ICI, avant l'envoi, avec le schéma exact que
   * `greffon.ts` applique au build. Il ne peut donc plus y avoir de contenu que
   * le panel accepte et que la construction rejette.
   */
  const fautes = (donnees: unknown): string[] => {
    if (!section) return [];
    const r = SECTIONS[section.cle].safeParse(donnees);
    if (r.success) return [];
    return r.error.issues.map((i) => {
      const ou = i.path.join(".");
      return ou ? `${ou} — ${i.message}` : i.message;
    });
  };

  const poser = (cle: string, v: unknown) => {
    setTravail((t) => ecrireValeur(t, cle, v));
    setModifie(true);
    setMessage(null);
  };

  const enregistrer = async () => {
    if (!section) return;

    const mauvais = fautes(travail);
    if (mauvais.length) {
      setMessage({
        ton: "erreur",
        texte:
          `${mauvais.length} champ(s) à corriger avant d'enregistrer — ` +
          `la construction du site les refuserait :\n· ${mauvais.join("\n· ")}`,
      });
      return;
    }

    setEnvoi(true);
    try {
      const maj = await contenu.enregistrer(section.cle, travail, section.etiquette);
      setSections((l) => (l ?? []).map((s) => (s.cle === maj.cle ? maj : s)));
      setModifie(false);
      setMessage({
        ton: "ok",
        texte: AVEC_BROUILLON
          ? "Brouillon enregistré. Cliquez sur Publier pour le mettre en ligne."
          : "Enregistré dans le dépôt.",
      });
      // L'aperçu recharge : en mode fichiers, Vite a déjà rechargé le module.
      apercu.current?.contentWindow?.location.reload();
    } catch (e) {
      setMessage({
        ton: "erreur",
        texte: e instanceof Error ? e.message : "Enregistrement refusé.",
      });
    } finally {
      setEnvoi(false);
    }
  };

  const publier = async () => {
    if (!section) return;

    const mauvais = fautes(travail);
    if (mauvais.length) {
      setMessage({
        ton: "erreur",
        texte:
          `Rien n'a été publié. ${mauvais.length} champ(s) empêcheraient ` +
          `le site de se reconstruire :\n· ${mauvais.join("\n· ")}`,
      });
      return;
    }

    setEnvoi(true);
    try {
      const p = await contenu.publier(section.cle);
      await recharger();
      /*
       * Une reconstruction en échec n'est PAS un succès, et le ton du message
       * doit le dire. Il était « ok » : le texte annonçait l'échec en vert, au
       * milieu d'un bandeau de réussite. Personne ne lit un texte vert.
       */
      setMessage(
        p.etat === "echouee"
          ? {
              ton: "erreur",
              texte:
                "Le contenu est enregistré, mais LE SITE N'A PAS ÉTÉ RECONSTRUIT : " +
                "vos modifications ne sont pas encore visibles des visiteurs.\n" +
                (p.message ?? "La reconstruction s'est arrêtée sans message."),
            }
          : { ton: "ok", texte: "Publié. Le site se reconstruit, comptez deux minutes." }
      );
    } catch (e) {
      setMessage({ ton: "erreur", texte: e instanceof Error ? e.message : "Publication refusée." });
    } finally {
      setEnvoi(false);
    }
  };

  if (!sections) {
    return <div className="p-6 text-[12px] text-slate-500">Chargement du contenu…</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-5">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[13px] font-bold text-slate-700">Page d'accueil</h2>
        {MODE_CONTENU === "fichiers" ? (
          <Pastille ton="alerte">Écriture dans les fichiers</Pastille>
        ) : (
          <Pastille ton="neutre">Brouillon puis publication</Pastille>
        )}
        <p className="text-[11px] text-slate-500">
          {MODE_CONTENU === "fichiers"
            ? "Enregistrer modifie directement le dépôt : il n'y a pas de brouillon."
            : "Enregistrer garde la modification de côté ; publier la met en ligne."}
        </p>
      </div>

      <div className="grid grid-cols-[190px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
        {/* -------------------------------------------------- les sections */}
        <Panneau titre="Sections">
          <nav className="space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.cle}
                onClick={() => setChoisie(s.cle)}
                className={`w-full text-left px-2 py-1.5 rounded text-[12.5px] flex items-center justify-between gap-2 transition-colors ${
                  s.cle === choisie
                    ? "bg-ms-blue/10 text-ms-blue font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {s.libelle}
                {s.brouillon && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                    title="Modification non publiée"
                  />
                )}
              </button>
            ))}
          </nav>
        </Panneau>

        {/* ---------------------------------------------------- les champs */}
        <Panneau titre={section?.libelle ?? "—"}>
          {/* Qui d'autre modifie CETTE section. La présence est suivie section
              par section : deux personnes sur deux sections différentes ne se
              gênent pas, chacune a sa ligne en base. */}
          <Presents ressource={`contenu:${choisie}`} />

          {!champs.length ? (
            <p className="text-[12px] text-slate-500">Cette section n'a aucun champ modifiable.</p>
          ) : (
            <>
              {champs.map((c) =>
                c.genre === "variantes" ? (
                  <ListeDeGabarits
                    key={c.cle}
                    champ={c}
                    valeur={lireValeur(travail, c.cle)}
                    onChange={(v) => poser(c.cle, v)}
                  />
                ) : c.genre === "objets" ? (
                  <ListeDObjets
                    key={c.cle}
                    champ={c}
                    valeur={lireValeur(travail, c.cle)}
                    onChange={(v) => poser(c.cle, v)}
                  />
                ) : c.genre === "texteMultiple" ? (
                  <ListeDeTextes
                    key={c.cle}
                    champ={c}
                    valeur={lireValeur(travail, c.cle)}
                    onChange={(v) => poser(c.cle, v)}
                  />
                ) : (
                  <ChampSimple
                    key={c.cle}
                    champ={c}
                    valeur={lireValeur(travail, c.cle)}
                    onChange={(v) => poser(c.cle, v)}
                  />
                )
              )}

              {message && (
                <p
                  /* `whitespace-pre-line` : la liste des champs fautifs est
                     séparée par des retours à la ligne, qui seraient sinon
                     repliés en un seul paragraphe illisible. */
                  className={`ms-insere mb-3 text-[11px] leading-snug rounded-lg p-2 border whitespace-pre-line ${
                    message.ton === "ok"
                      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                      : "text-red-700 bg-red-50 border-red-200"
                  }`}
                >
                  {message.texte}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <Bouton variante="principal" onClick={enregistrer} disabled={!modifie || envoi}>
                  {AVEC_BROUILLON ? "Enregistrer le brouillon" : "Enregistrer"}
                </Bouton>

                {AVEC_BROUILLON && (
                  <>
                    <Bouton
                      variante="neutre"
                      onClick={publier}
                      disabled={envoi || !section?.brouillon}
                    >
                      Publier
                    </Bouton>
                    {section?.brouillon && (
                      <Bouton
                        variante="neutre"
                        onClick={async () => {
                          await contenu.abandonner(section.cle);
                          await recharger();
                        }}
                        disabled={envoi}
                      >
                        Abandonner
                      </Bouton>
                    )}
                  </>
                )}

                {modifie && (
                  <span className="text-[11px] text-amber-700">Modifications non enregistrées</span>
                )}
              </div>
            </>
          )}
        </Panneau>

        {/* --------------------------------------------------- l'aperçu */}
        <Panneau titre="Aperçu">
          <p className="text-[11px] text-slate-500 mb-2">
            {MODE_CONTENU === "fichiers"
              ? "La page réelle. Elle se recharge après chaque enregistrement."
              : "La page en ligne. Elle ne montrera votre brouillon qu'une fois publié."}
          </p>
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
            <iframe
              ref={apercu}
              src="/"
              title="Aperçu de la page d'accueil"
              className="w-full h-[70vh] border-0"
            />
          </div>
        </Panneau>
      </div>
    </div>
  );
};

export default Accueil;
