import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ---------------------------------------------------------------------------
 * CONFIGURATION
 * ---------------------------------------------------------------------------
 *
 * Lue une fois au démarrage, et VÉRIFIÉE. Un réglage absent ou aberrant doit
 * empêcher le serveur de démarrer, pas se manifester trois heures plus tard
 * sur une requête d'un utilisateur.
 *
 * C'est particulièrement vrai pour `SECRET_SESSION` : sans contrôle, un
 * serveur démarré avec la valeur d'exemple accepterait les connexions et
 * signerait les sessions avec un secret public. Il refuse de démarrer.
 */

/* ------------------------------------------------------------------ .env */

/*
 * Lecture maison plutôt qu'une bibliothèque.
 *
 * Node 20 sait charger un `.env` avec l'option `--env-file`, mais elle doit
 * être passée à la ligne de commande — ce qui n'est pas toujours possible sur
 * un hébergement mutualisé, où le lancement est fait par le panneau de
 * l'hébergeur. Vingt lignes ici évitent d'en dépendre.
 */
const chargerEnv = () => {
  try {
    const brut = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const ligne of brut.split("\n")) {
      const t = ligne.trim();
      if (!t || t.startsWith("#")) continue;
      const coupe = t.indexOf("=");
      if (coupe === -1) continue;
      const cle = t.slice(0, coupe).trim();
      // On retire les guillemets éventuels, sans toucher au reste : un mot de
      // passe peut légitimement contenir des espaces ou des symboles.
      const valeur = t.slice(coupe + 1).trim().replace(/^["']|["']$/g, "");
      if (!(cle in process.env)) process.env[cle] = valeur;
    }
  } catch {
    // Pas de fichier : les variables viennent alors de l'environnement du
    // système, ce qui est le cas normal sur beaucoup d'hébergements.
  }
};

chargerEnv();

/* -------------------------------------------------------------- lecture */

const manquants: string[] = [];

const requis = (cle: string): string => {
  const v = process.env[cle];
  if (!v) {
    manquants.push(cle);
    return "";
  }
  return v;
};

const nombre = (cle: string, defaut: number): number => {
  const v = process.env[cle];
  if (!v) return defaut;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

/** Valeurs d'exemple qui ne doivent JAMAIS servir en production. */
const VALEURS_INTERDITES = new Set([
  "a_generer_avant_la_mise_en_service",
  "mot_de_passe_a_definir",
  "a_remplacer",
]);

export const config = {
  environnement: (process.env.ENVIRONNEMENT ?? "developpement") as
    | "developpement"
    | "production",

  port: nombre("PORT", 3000),

  bd: {
    url: requis("DATABASE_URL"),
    /* `require` chiffre la connexion ; `disable` ne convient qu'en local. */
    ssl: (process.env.PGSSLMODE ?? "require") !== "disable",
  },

  session: {
    secret: requis("SECRET_SESSION"),
    dureeH: nombre("DUREE_SESSION_H", 12),
    coutBcrypt: nombre("COUT_BCRYPT", 12),
  },

  origineAutorisee: requis("ORIGINE_AUTORISEE"),

  medias: {
    mode: (process.env.STOCKAGE_MEDIAS ?? "disque") as "disque" | "s3",
    chemin: process.env.CHEMIN_MEDIAS ?? resolve(process.cwd(), "medias"),
    poidsMaxOctets: nombre("POIDS_MAX_MO", 25) * 1024 * 1024,
  },

  reconstruction: {
    /**
     * La commande qui reconstruit le site, lancée sur la machine.
     *
     * Le site est hébergé chez PlanetHoster, sur le serveur du client. Le
     * panneau N0C donne un accès SSH avec Node et npm : la reconstruction se
     * fait sur place, dans le dossier du site.
     *
     * Une première version prévoyait aussi un « crochet » à appeler chez un
     * hébergeur tiers (Netlify, Cloudflare Pages). Il a été retiré : ces
     * plateformes ne sont pas utilisées, et un réglage qui ne peut jamais
     * servir finit par égarer celui qui le lit.
     *
     * Non configurée, la publication est enregistrée mais aucune
     * reconstruction n'est déclenchée, et le panel le dit clairement. Mieux
     * vaut l'annoncer que de laisser croire à une mise en ligne.
     */
    commande: process.env.COMMANDE_RECONSTRUCTION ?? "",
    repertoire: process.env.REPERTOIRE_SITE ?? "",
    delaiMs: nombre("DELAI_RECONSTRUCTION_MIN", 10) * 60 * 1000,
  },

  /**
   * Le service d'envoi de courriels.
   *
   * FACULTATIF, et c'est délibéré. Sans `SMTP_HOTE`, le panel fonctionne
   * entièrement : la création de compte affiche le mot de passe provisoire à
   * l'écran, à charge pour l'administrateur de le transmettre. Le client n'a
   * donc pas à trouver un service de messagerie avant de mettre son site en
   * ligne — il l'ajoutera quand il voudra.
   *
   * `adressePanel` sert aux liens contenus dans les messages. Elle ne peut pas
   * se déduire : le panel est servi sous un sous-domaine ou un chemin selon
   * l'installation, et une adresse fausse dans un courriel de
   * réinitialisation rend le lien inutilisable.
   */
  smtp: {
    hote: process.env.SMTP_HOTE ?? "",
    port: nombre("SMTP_PORT", 587),
    utilisateur: process.env.SMTP_UTILISATEUR ?? "",
    motDePasse: process.env.SMTP_MOTDEPASSE ?? "",
    expediteur: process.env.SMTP_EXPEDITEUR ?? "",
    adressePanel: process.env.ADRESSE_PANEL ?? "",
  },
} as const;

/* ------------------------------------------------------------- contrôles */

export const verifierConfig = () => {
  const erreurs: string[] = [];

  if (manquants.length) {
    erreurs.push(`Variables absentes : ${manquants.join(", ")}`);
  }

  if (VALEURS_INTERDITES.has(config.session.secret)) {
    erreurs.push(
      "SECRET_SESSION porte encore la valeur d'exemple. Générez-en une :\n" +
        '      node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }

  if (config.session.secret && config.session.secret.length < 32) {
    erreurs.push("SECRET_SESSION doit faire au moins 32 caractères.");
  }

  if (config.bd.url.includes("mot_de_passe_a_definir")) {
    erreurs.push("DATABASE_URL porte encore le mot de passe d'exemple.");
  }

  if (config.origineAutorisee === "*") {
    erreurs.push(
      "ORIGINE_AUTORISEE ne peut pas valoir « * » : le cookie de session partirait\n" +
        "      vers n'importe quel site qui en ferait la demande."
    );
  }

  if (config.environnement === "production") {
    if (!config.bd.ssl) {
      erreurs.push("PGSSLMODE=disable en production : les identifiants circuleraient en clair.");
    }
    if (config.origineAutorisee.startsWith("http://")) {
      erreurs.push(
        "ORIGINE_AUTORISEE est en http:// : le cookie de session est posé avec\n" +
          "      l'attribut Secure et ne serait jamais envoyé."
      );
    }
  }

  if (erreurs.length) {
    console.error("\n✖ Configuration incomplète — le serveur ne démarre pas.\n");
    erreurs.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`));
    console.error("  Modèle commenté : serveur/.env.example\n");
    process.exit(1);
  }
};
