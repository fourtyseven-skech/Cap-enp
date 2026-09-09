import { createTransport, type Transporter } from "nodemailer";
import { config } from "./config.js";

/**
 * ---------------------------------------------------------------------------
 * L'ENVOI DE COURRIELS
 * ---------------------------------------------------------------------------
 *
 * UN SEUL courriel : l'INVITATION — un compte vient d'être créé, voici
 * l'adresse du panel et le mot de passe provisoire.
 *
 * Rien d'autre. Le panel n'envoie pas de lettre d'information, ne prévient
 * personne d'une publication, et n'a pas de « mot de passe oublié » : un panel
 * d'administration ne se récupère pas par courriel, il se reprend en main par
 * un administrateur. Aucune adresse n'est connue en dehors des comptes qui s'y
 * connectent.
 *
 * INERTE TANT QUE LE SMTP N'EST PAS FOURNI
 * ----------------------------------------
 * Sans `SMTP_HOTE`, ce module ne tente rien et le dit : `{ envoye: false }`.
 * C'est le même motif que `VITE_API_URL` pour le panel et `DATABASE_URL` pour
 * la construction — le code est écrit, testé, et attend une variable.
 *
 * L'appelant doit donc TOUJOURS prévoir le cas : la création de compte affiche
 * de toute façon le mot de passe provisoire à l'écran, à charge pour
 * l'administrateur de le transmettre lui-même.
 *
 * POURQUOI UN ÉCHEC N'INTERROMPT JAMAIS L'OPÉRATION
 * -------------------------------------------------
 * Un serveur SMTP indisponible ne doit pas empêcher de créer un compte. Le
 * compte existe, le mot de passe provisoire est affiché : la seule chose
 * perdue est la commodité du courriel. Refuser la création serait transformer
 * une panne de messagerie en panne d'administration.
 */

export type Resultat = { envoye: boolean; raison?: string };

export const smtpConfigure = Boolean(config.smtp.hote);

let transport: Transporter | null = null;

const obtenirTransport = (): Transporter | null => {
  if (!smtpConfigure) return null;
  /* Créé une seule fois : `nodemailer` garde la connexion ouverte entre deux
     envois, et rouvrir une session TLS à chaque courriel est autrement plus
     coûteux que de garder l'objet. */
  transport ??= createTransport({
    host: config.smtp.hote,
    port: config.smtp.port,
    /* Port 465 : TLS d'emblée. Ailleurs (587, 25) : connexion en clair puis
       STARTTLS, que `nodemailer` négocie tout seul. */
    secure: config.smtp.port === 465,
    auth: config.smtp.utilisateur
      ? { user: config.smtp.utilisateur, pass: config.smtp.motDePasse }
      : undefined,
  });
  return transport;
};

/**
 * Envoie un courriel. Ne lève jamais.
 *
 * Le texte est en clair, sans HTML : ce message contient une adresse et un mot
 * de passe. Une version HTML apporterait un risque d'affichage cassé
 * et des images distantes qui trahissent l'ouverture du message, pour aucun
 * gain de lisibilité.
 */
export const envoyer = async (
  destinataire: string,
  sujet: string,
  texte: string
): Promise<Resultat> => {
  const t = obtenirTransport();
  if (!t) return { envoye: false, raison: "Aucun service d'envoi n'est configuré (SMTP_HOTE)." };

  try {
    await t.sendMail({
      from: config.smtp.expediteur || config.smtp.utilisateur,
      to: destinataire,
      subject: sujet,
      text: texte,
    });
    return { envoye: true };
  } catch (e) {
    /* L'échec part dans la sortie du serveur, où la supervision le voit, et
       remonte à l'appelant — mais sous forme de valeur, pas d'exception. */
    const raison = e instanceof Error ? e.message : "envoi impossible";
    console.error(`✖ Courriel non envoyé à ${destinataire} : ${raison}`);
    return { envoye: false, raison };
  }
};

/* ========================================================================= */
/* Le message                                                                */
/* ========================================================================= */

/**
 * Le texte est ICI et non dans la route : ce sont les seuls mots que le client
 * recevra de la part du panel, et ils se relisent mieux à leur place qu'au
 * milieu d'une logique HTTP.
 */
export const envoyerInvitation = (
  destinataire: string,
  nom: string,
  motDePasse: string,
  adressePanel: string
): Promise<Resultat> =>
  envoyer(
    destinataire,
    "Votre accès à l'administration du site Megasoft",
    [
      `Bonjour ${nom},`,
      "",
      "Un accès à l'administration du site Megasoft vient d'être créé à votre nom.",
      "",
      `Adresse       : ${adressePanel}`,
      `Identifiant   : ${destinataire}`,
      `Mot de passe  : ${motDePasse}`,
      "",
      "Ce mot de passe est provisoire : changez-le à votre première connexion.",
      "",
      "Si vous n'attendiez pas ce message, prévenez la personne qui administre",
      "le site — le compte peut être retiré immédiatement.",
    ].join("\n")
  );
