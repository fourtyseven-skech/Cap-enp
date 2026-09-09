import { useState } from "react";
import { Bouton, Pastille } from "./ui";
import { relatif } from "./dates";

/**
 * ---------------------------------------------------------------------------
 * DEUX VERSIONS, ET IL FAUT CHOISIR
 * ---------------------------------------------------------------------------
 *
 * Le serveur refuse une écriture dont la version de départ n'est plus à jour
 * (`If-Match`, CONTRAT.md § 6). C'est ce qui empêche deux personnes d'écraser
 * mutuellement leur travail, et ce refus est indispensable.
 *
 * Mais un refus n'est pas une solution : jusqu'ici, l'écran affichait « cet
 * élément a été modifié entre-temps » et s'arrêtait là. La personne se
 * retrouvait avec son texte à l'écran, impossible à enregistrer, et aucun moyen
 * de savoir ce que l'autre avait changé. La seule issue praticable était de
 * copier son travail ailleurs, recharger, et recoller — en espérant n'avoir
 * rien oublié.
 *
 * CE QUE CET ÉCRAN MONTRE
 * -----------------------
 * Uniquement les champs qui DIFFÈRENT. Un article a une trentaine de champs ;
 * en afficher trente pour en signaler deux revient à ne rien signaler.
 *
 * CE QU'IL NE FAIT PAS : FUSIONNER TOUT SEUL
 * ------------------------------------------
 * Aucune fusion automatique. Prendre le titre de l'un et le corps de l'autre
 * produit des textes incohérents que personne ne relit — un chapeau qui annonce
 * un contenu qui n'est plus là. Sur un texte rédigé, seul un humain sait ce
 * qu'il faut garder. Le panel montre, et laisse décider.
 *
 * Les deux issues sont explicites, et toutes deux perdent quelque chose. C'est
 * la nature d'un conflit : le rôle de cet écran est que la perte soit choisie
 * en connaissance de cause, pas subie.
 */

/** Les champs comparés, et leur nom lisible. Le reste est ignoré. */
const LIBELLES: Record<string, string> = {
  titre: "Titre",
  chapeau: "Chapeau",
  corps: "Corps de l'article",
  categorie: "Catégorie",
  statut: "Statut",
  publie_le: "Date de parution",
  meta_description: "Description pour les moteurs",
  auteur: "Auteur",
  image: "Vignette",
  exergue: "Exergue",
  reponse: "Réponse",
  titre_fantome: "Titre fantôme",
};

const enTexte = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/** Un aperçu court : un corps d'article ne tient pas dans un tableau. */
const extrait = (v: unknown, max = 220): string => {
  const t = enTexte(v);
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

type Proprietes = {
  /** Ce que la personne a sous les yeux. */
  mien: Record<string, unknown>;
  /** Ce que le serveur détient — joint au refus 409. */
  distant: unknown;
  /** Reprendre la version du serveur : le travail en cours est abandonné. */
  onReprendre: (distant: Record<string, unknown>) => void;
  /** Réécrire par-dessus : la version du serveur est remplacée. */
  onEcraser: () => void | Promise<void>;
  onFermer: () => void;
};

const Conflit = ({ mien, distant, onReprendre, onEcraser, onFermer }: Proprietes) => {
  const [envoi, setEnvoi] = useState(false);

  if (!distant || typeof distant !== "object") return null;
  const autre = distant as Record<string, unknown>;

  const differences = Object.keys(LIBELLES).filter(
    (cle) => enTexte(mien[cle]) !== enTexte(autre[cle])
  );

  const quand = autre.maj_le ? relatif(String(autre.maj_le)) : null;

  return (
    <div className="ms-insere mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Pastille ton="alerte">Modifications croisées</Pastille>
        <span className="text-[11.5px] text-amber-900">
          Quelqu'un a enregistré cet article {quand ? quand : "entre-temps"}. Rien n'a été écrasé
          — votre texte est toujours à l'écran.
        </span>
      </div>

      {differences.length === 0 ? (
        <p className="text-[11.5px] leading-snug text-amber-900">
          Aucun champ ne diffère réellement : la version du serveur est simplement plus récente que
          la vôtre. « Écraser » enregistrera votre texte sans rien perdre.
        </p>
      ) : (
        <div className="tw overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-amber-800">
                <th className="py-1 pr-2 font-bold">Champ</th>
                <th className="py-1 pr-2 font-bold">Votre version</th>
                <th className="py-1 font-bold">Sur le serveur</th>
              </tr>
            </thead>
            <tbody>
              {differences.map((cle) => (
                <tr key={cle} className="align-top border-t border-amber-200">
                  <td className="py-1.5 pr-2 font-semibold text-amber-900 whitespace-nowrap">
                    {LIBELLES[cle]}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-800 break-words">{extrait(mien[cle])}</td>
                  <td className="py-1.5 text-slate-800 break-words">{extrait(autre[cle])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Bouton
          variante="principal"
          disabled={envoi}
          onClick={async () => {
            setEnvoi(true);
            try {
              await onEcraser();
            } finally {
              setEnvoi(false);
            }
          }}
        >
          {envoi ? "Enregistrement…" : "Garder ma version"}
        </Bouton>
        <Bouton variante="neutre" disabled={envoi} onClick={() => onReprendre(autre)}>
          Reprendre celle du serveur
        </Bouton>
        <Bouton variante="neutre" disabled={envoi} onClick={onFermer}>
          Ne rien faire pour l'instant
        </Bouton>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-amber-800">
        <strong>Garder ma version</strong> remplace le texte du serveur par le vôtre : ce que
        l'autre personne a écrit est perdu. <strong>Reprendre celle du serveur</strong> abandonne
        vos modifications en cours. Copiez ce qui doit survivre avant de trancher.
      </p>
    </div>
  );
};

export default Conflit;
