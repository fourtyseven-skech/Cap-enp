import { useCallback, useEffect, useRef, useState } from "react";
import { serveurConfigure } from "./serveur/client";
import { ErreurApi } from "./serveur/contrat";
import { medias as apiMedias } from "./serveur/depotHttp";
import { Bouton, Pastille } from "./ui";
import {
  avertissement,
  enPoids,
  niveauDePoids,
  phraseAssumee,
  type GenreMedia,
} from "@/contenu/poids";

/**
 * Ce qu'un champ accepte. `tout` est le cas du gabarit « Annonce » : une image
 * ou une vidéo, au choix de qui écrit — c'est le seul endroit du modèle où la
 * question se pose, et le sélecteur propose alors les deux bibliothèques dans
 * la même grille.
 */
type Accepte = GenreMedia | "tout";

/** Le genre réel d'un fichier, lu sur son type — jamais sur le champ. */
const genreDuType = (typeMime: string): GenreMedia =>
  typeMime.startsWith("video/") ? "video" : "image";

/** Le genre réel d'une adresse déjà enregistrée. */
const genreDeLUrl = (url: string): GenreMedia =>
  /\.(mp4|webm)$/i.test(url) || url.startsWith("/videos/") ? "video" : "image";

/**
 * ---------------------------------------------------------------------------
 * CHOISIR UN FICHIER — ON LE VOIT, ON NE L'ÉCRIT PAS
 * ---------------------------------------------------------------------------
 *
 * Le sélecteur posé à l'endroit où le fichier sert : la vignette de ce qui est
 * choisi, la bibliothèque de ce qui existe déjà, un bouton d'envoi.
 *
 * CE QU'IL REMPLACE
 * -----------------
 * Une zone de saisie où il fallait taper « /videos/hero-tms » ou
 * « /medias/9f3a1c72-….webp ». Deux défauts, et le second est le pire :
 *
 *   · on choisissait un fichier sans le voir — un logo client se reconnaît à
 *     l'œil, pas à son nom de fichier ;
 *   · une faute de frappe passait la validation du panel et ne se voyait qu'au
 *     build, ou pire, sur le site en ligne, en image cassée.
 *
 * ESSAYER SANS DÉTRUIRE
 * ---------------------
 * Choisir un autre fichier ne supprime rien : cela change la valeur du champ,
 * l'aperçu se met à jour, et le fichier précédent reste dans la bibliothèque.
 * On peut donc essayer, regarder, revenir.
 *
 * La SUPPRESSION définitive est un geste séparé, avec un avertissement explicite
 * — et le serveur refuse (409) de supprimer un fichier encore utilisé quelque
 * part. Ce n'est pas de la politesse : rien ne restaure un fichier effacé.
 *
 * LE POIDS
 * --------
 * Les seuils sont dans `src/contenu/poids.ts`. Ici on prévient et on propose la
 * case à cocher ; c'est le serveur qui refuse réellement — un contrôle qui vit
 * dans le navigateur ne contrôle rien.
 */

type Fichier = {
  id: string;
  url: string;
  nom: string;
  taille: number;
  type_mime: string;
};

/** Ce que le champ d'envoi accepte, selon le genre attendu. */
const IMAGES = "image/png,image/jpeg,image/webp,image/avif,image/gif";
const VIDEOS = "video/mp4,video/webm";

const ACCEPTE: Record<Accepte, string> = {
  image: IMAGES,
  video: VIDEOS,
  tout: `${IMAGES},${VIDEOS}`,
};

const estDuGenre = (f: Fichier, accepte: Accepte) =>
  accepte === "tout" || genreDuType(f.type_mime) === accepte;

/* ------------------------------------------------------------- transport */

/**
 * Deux modes, une seule interface.
 *
 *   · SERVEUR — l'API convertit, range et JOURNALISE ;
 *   · LOCAL   — le serveur de développement écrit dans `content/medias/`.
 *
 * Le composant ne sait pas lequel il utilise : les deux répondent une adresse
 * en `/medias/…`. Seule différence assumée, dite à l'écran : le mode local n'a
 * pas de journal.
 */
const local = {
  lister: async (): Promise<Fichier[]> => {
    const r = await fetch("/__medias");
    if (!r.ok) throw new Error("Le serveur de développement n'a pas répondu.");
    return r.json();
  },

  envoyer: async (fichier: File, _alt: string, assume?: string): Promise<Fichier> => {
    const r = await fetch("/__medias", {
      method: "POST",
      /* Le corps est le fichier brut : l'acceptation n'a d'autre place qu'un
         en-tête. */
      headers: assume ? { "X-Poids-Assume": assume } : undefined,
      body: fichier,
    });
    if (!r.ok) {
      const corps = (await r.json().catch(() => ({}))) as { message?: string };
      throw new RefusDePoids(corps.message ?? "L'envoi a échoué.", r.status === 413);
    }
    return r.json();
  },

  supprimer: async (id: string): Promise<void> => {
    const r = await fetch(`/__medias/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const corps = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Error(corps.message ?? "La suppression a échoué.");
    }
  },
};

const distant = {
  lister: async (): Promise<Fichier[]> =>
    (await apiMedias.lister()).map((m) => ({
      id: m.id,
      url: m.url,
      nom: m.nom,
      taille: Number(m.taille),
      type_mime: m.type_mime,
    })),

  envoyer: async (fichier: File, alt: string, assume?: string): Promise<Fichier> => {
    try {
      const m = await apiMedias.envoyer(fichier, alt, assume);
      return {
        id: m.id,
        url: m.url,
        nom: m.nom,
        taille: Number(m.taille),
        type_mime: m.type_mime,
      };
    } catch (e) {
      if (e instanceof ErreurApi) throw new RefusDePoids(e.message, e.code === "fichier_trop_lourd");
      throw e;
    }
  },

  supprimer: (id: string) => apiMedias.supprimer(id),
};

/**
 * Un refus, et la seule chose qu'on ait besoin d'en savoir ici : était-ce à
 * cause du poids ? Si oui, le panel propose la case à cocher plutôt que de
 * laisser l'utilisateur devant un échec sans issue.
 */
class RefusDePoids extends Error {
  constructor(message: string, readonly pourLePoids: boolean) {
    super(message);
    this.name = "RefusDePoids";
  }
}

const source = serveurConfigure ? distant : local;

/* ========================================================================= */

const ChoixMedia = ({
  valeur,
  onChange,
  accepte = "image",
  alt = "",
  libelle = "Fichier",
  aide,
}: {
  /** L'adresse publique choisie, ou une chaîne vide. */
  valeur: string;
  onChange: (url: string) => void;
  accepte?: Accepte;
  /** Texte alternatif proposé à l'envoi — en général le titre voisin. */
  alt?: string;
  libelle?: string;
  aide?: string;
}) => {
  const [fichiers, setFichiers] = useState<Fichier[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  /** Le fichier refusé pour son poids, en attente de la case à cocher. */
  const [aAssumer, setAAssumer] = useState<{ fichier: File; message: string } | null>(null);
  const [coche, setCoche] = useState(false);
  /** La suppression demandée, en attente de confirmation. */
  const [aSupprimer, setASupprimer] = useState<Fichier | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  const recharger = useCallback(async () => {
    try {
      setFichiers((await source.lister()).filter((f) => estDuGenre(f, accepte)));
      setErreur(null);
    } catch (e) {
      setFichiers([]);
      setErreur(e instanceof Error ? e.message : "Lecture impossible.");
    }
  }, [accepte]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /** L'envoi, avec ou sans acceptation du poids. */
  const envoyer = async (fichier: File, assume?: string) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const media = await source.envoyer(fichier, alt || fichier.name, assume);
      // On sélectionne d'emblée ce qui vient d'être envoyé : personne n'envoie
      // un fichier pour ensuite aller le chercher dans la liste.
      onChange(media.url);
      setAAssumer(null);
      setCoche(false);
      await recharger();

      /* Le poids se juge sur le genre RÉEL du fichier — un champ « Annonce »
         accepte les deux, et une vidéo n'a pas les seuils d'une image. */
      const genre = genreDuType(media.type_mime);
      const niveau = niveauDePoids(genre, media.taille);
      setErreur(niveau === "orange" ? avertissement(genre, media.taille) : null);
    } catch (e) {
      if (e instanceof RefusDePoids && e.pourLePoids) {
        /* Refusé pour son poids : on garde le fichier sous la main et on
           affiche la case. Un second envoi partira avec l'acceptation. */
        setAAssumer({ fichier, message: e.message });
        setCoche(false);
      } else {
        setErreur(e instanceof Error ? e.message : "L'envoi a échoué.");
      }
    } finally {
      setEnvoi(false);
      if (champ.current) champ.current.value = "";
    }
  };

  const supprimer = async (f: Fichier) => {
    setErreur(null);
    try {
      await source.supprimer(f.id);
      if (f.url === valeur) onChange("");
      setASupprimer(null);
      await recharger();
    } catch (e) {
      setASupprimer(null);
      setErreur(e instanceof Error ? e.message : "La suppression a échoué.");
    }
  };

  /* Ce qui est actuellement choisi est une vidéo ou non — question distincte
     de ce que le champ accepte. */
  const estVideo = valeur ? genreDeLUrl(valeur) === "video" : accepte === "video";
  /* Une scène du hero s'écrit « /videos/nom » sans extension : ces vidéos-là
     vivent dans le dépôt et ne se remplacent pas depuis le panel. On le dit
     plutôt que d'afficher un aperçu qui ne chargerait jamais. */
  const duDepot = estVideo && valeur.startsWith("/videos/");

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          {libelle}
        </span>
        {valeur && (
          <Bouton variante="neutre" onClick={() => onChange("")}>
            Retirer
          </Bouton>
        )}
      </div>

      {aide && <p className="text-[10.5px] text-slate-500 mb-2 leading-snug">{aide}</p>}

      {/* Ce qui est choisi, en grand : c'est ce qui compte. */}
      {valeur && (
        <div className="mb-2 rounded-lg border border-ms-blue/30 bg-ms-blue/[0.04] p-2">
          {duDepot ? (
            <p className="text-[11.5px] text-slate-600 leading-snug">
              <strong>{valeur}</strong> — vidéo livrée avec le site, en deux résolutions
              (480p et 720p). Envoyez-en une autre pour la remplacer.
            </p>
          ) : estVideo ? (
            <video
              src={valeur}
              controls
              muted
              playsInline
              className="w-full max-h-48 rounded bg-black"
            />
          ) : (
            <img
              src={valeur}
              alt=""
              className="w-full max-h-40 object-contain rounded"
              onError={(e) => {
                // Un fichier choisi puis supprimé laisse une adresse morte. On
                // le montre plutôt que d'afficher un cadre vide inexpliqué.
                (e.currentTarget as HTMLImageElement).style.display = "none";
                setErreur("Ce fichier n'existe plus. Choisissez-en un autre.");
              }}
            />
          )}
        </div>
      )}

      {/* La bibliothèque. */}
      {fichiers === null ? (
        <p className="text-[11.5px] text-slate-500">Chargement…</p>
      ) : fichiers.length ? (
        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {fichiers.map((f) => (
            <div key={f.id} className="relative group">
              <button
                type="button"
                onClick={() => onChange(f.url)}
                title={`${f.nom} — ${enPoids(f.taille)}`}
                className={`w-full aspect-[4/3] rounded overflow-hidden border-2 transition-colors ${
                  f.url === valeur ? "border-ms-blue" : "border-transparent hover:border-slate-300"
                }`}
              >
                {estDuGenre(f, "video") ? (
                  <video
                    src={f.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover bg-black pointer-events-none"
                  />
                ) : (
                  <img
                    src={f.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
              <button
                type="button"
                title="Supprimer définitivement"
                aria-label={`Supprimer ${f.nom}`}
                onClick={() => setASupprimer(f)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-white/90 text-red-600
                           border border-red-200 text-[11px] leading-none opacity-0
                           group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11.5px] text-slate-500">
          Aucun fichier pour l'instant. Envoyez-en un ci-dessous.
        </p>
      )}

      {/* La suppression, qui ne se rattrape pas. */}
      {aSupprimer && (
        <div className="ms-insere mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
          <p className="text-[11.5px] leading-snug text-red-800">
            <strong>Supprimer « {aSupprimer.nom} » définitivement ?</strong> Le fichier est
            effacé du serveur : <strong>rien ne le restaure</strong>. Pour seulement changer
            l'illustration, choisissez-en une autre — celle-ci restera disponible.
          </p>
          <div className="flex items-center gap-2 mt-2">
            {/* Rouge et explicite : la seule action de cet écran qui ne se
                rattrape pas ne doit pas ressembler aux autres. */}
            <button
              type="button"
              onClick={() => void supprimer(aSupprimer)}
              className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[11.5px] font-semibold
                         hover:bg-red-700 transition-colors"
            >
              Supprimer définitivement
            </button>
            <Bouton variante="neutre" onClick={() => setASupprimer(null)}>
              Annuler
            </Bouton>
          </div>
        </div>
      )}

      {/* Le poids assumé. */}
      {aAssumer && (
        <div className="ms-insere mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
          <p className="text-[11.5px] leading-snug text-amber-900">{aAssumer.message}</p>
          <label className="flex items-start gap-2 mt-2 text-[11.5px] leading-snug text-amber-900">
            <input
              type="checkbox"
              checked={coche}
              onChange={(e) => setCoche(e.target.checked)}
              className="mt-0.5"
            />
            <span>{phraseAssumee(genreDuType(aAssumer.fichier.type), aAssumer.fichier.size)}</span>
          </label>
          <div className="flex items-center gap-2 mt-2">
            <Bouton
              variante="neutre"
              disabled={!coche || envoi}
              onClick={() =>
                void envoyer(
                  aAssumer.fichier,
                  phraseAssumee(genreDuType(aAssumer.fichier.type), aAssumer.fichier.size)
                )
              }
            >
              {envoi ? "Envoi…" : "Envoyer quand même"}
            </Bouton>
            <Bouton variante="neutre" onClick={() => setAAssumer(null)}>
              Annuler
            </Bouton>
            {serveurConfigure ? (
              <Pastille ton="alerte">Tracé au journal</Pastille>
            ) : (
              <Pastille ton="alerte">Mode local : aucun journal</Pastille>
            )}
          </div>
        </div>
      )}

      {erreur && (
        <p className="ms-insere mt-2 text-[11px] leading-snug text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          {erreur}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <Bouton variante="neutre" onClick={() => champ.current?.click()} disabled={envoi}>
          {envoi
            ? "Envoi…"
            : valeur
              ? "Remplacer"
              : accepte === "video"
                ? "Envoyer une vidéo"
                : accepte === "tout"
                  ? "Envoyer une image ou une vidéo"
                  : "Envoyer une image"}
        </Bouton>
        {!serveurConfigure && <Pastille ton="alerte">Écriture dans le dépôt</Pastille>}
        <input
          ref={champ}
          type="file"
          accept={ACCEPTE[accepte]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void envoyer(f);
          }}
        />
      </div>
    </div>
  );
};

export default ChoixMedia;
