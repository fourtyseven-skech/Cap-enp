import { useState } from "react";
import { serveurConfigure } from "./serveur/client";
import { session as apiSession } from "./serveur/depotHttp";
import { Bouton, Champ, Panneau, Pastille, Saisie } from "./ui";

/**
 * ---------------------------------------------------------------------------
 * LES MOTS DE PASSE, CÔTÉ PANEL
 * ---------------------------------------------------------------------------
 *
 * UN SEUL écran : changer SON PROPRE mot de passe, depuis le panel. Il
 * manquait, et c'était bloquant — un compte créé recevait un mot de passe
 * provisoire qu'il n'avait aucun moyen de remplacer.
 *
 * ⚠️ IL N'Y A PAS DE « MOT DE PASSE OUBLIÉ », ET IL NE DOIT PAS Y EN AVOIR.
 *
 * Décision du client, tenue pour définitive : un panel d'administration n'est
 * pas un site grand public. Un formulaire public de récupération ajoute une
 * surface d'attaque — envois de courriels déclenchables par un inconnu, jetons
 * qui traînent dans des boîtes aux lettres — pour un besoin qui se produit deux
 * fois par an chez trois personnes qui se connaissent. Un compte qui perd son
 * mot de passe est repris en main par un administrateur, directement en base.
 *
 * TOUT CECI N'EXISTE QU'EN MODE SERVEUR
 * -------------------------------------
 * En mode atelier, aucun mot de passe n'est vérifié : proposer d'en changer un
 * laisserait croire à une sécurité qui n'existe pas. Les composants renvoient
 * `null`.
 */

const MINIMUM = 12;

/* ========================================================================= */
/* Changement — depuis le panel, une fois connecté                           */
/* ========================================================================= */

export const ChangerMotDePasse = () => {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [avis, setAvis] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /* En mode atelier, aucun mot de passe n'est vérifié : un formulaire de
     changement laisserait croire à une protection inexistante. */
  if (!serveurConfigure) return null;

  const pret = actuel.length > 0 && nouveau.length >= MINIMUM && confirmation === nouveau;

  return (
    <Panneau titre="Mon mot de passe">
      <p className="text-[11px] leading-snug text-slate-500 mb-3">
        À faire dès la première connexion si vous avez reçu un mot de passe provisoire.
        Le changer ferme toutes les sessions ouvertes ailleurs.
      </p>

      <Champ label="Mot de passe actuel">
        <Saisie
          type="password"
          autoComplete="current-password"
          value={actuel}
          onChange={(e) => setActuel(e.target.value)}
        />
      </Champ>
      <Champ label="Nouveau mot de passe" aide={`${MINIMUM} caractères au minimum.`}>
        <Saisie
          type="password"
          autoComplete="new-password"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
        />
      </Champ>
      <Champ label="Répétez-le">
        <Saisie
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </Champ>

      {avis && (
        <p
          className={`ms-insere mb-3 text-[11px] leading-snug rounded-lg p-2 border ${
            avis.ton === "ok"
              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {avis.texte}
        </p>
      )}

      <Bouton
        variante="principal"
        disabled={!pret || envoi}
        onClick={async () => {
          setEnvoi(true);
          setAvis(null);
          try {
            await apiSession.changerMotDePasse(actuel, nouveau);
            setActuel("");
            setNouveau("");
            setConfirmation("");
            setAvis({ ton: "ok", texte: "Mot de passe changé." });
          } catch (e) {
            setAvis({
              ton: "erreur",
              texte: e instanceof Error ? e.message : "Changement impossible.",
            });
          } finally {
            setEnvoi(false);
          }
        }}
      >
        {envoi ? "Enregistrement…" : "Changer mon mot de passe"}
      </Bouton>
    </Panneau>
  );
};
