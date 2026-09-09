import { Suspense, lazy, useEffect, useState } from "react";
import MegasoftLogo from "@/components/brand/MegasoftLogo";


// Ces deux vues chargent tout le contenu du blog (gray-matter, marked, les
// articles eux-mêmes) : on ne les met dans le chunk que si on les ouvre.
// Toutes les vues sont différées : la coquille et l'écran de connexion ne
// doivent embarquer ni le contenu du blog, ni les bibliothèques de calques.
const Editeur = lazy(() => import("./Editeur"));
const Constructeur = lazy(() => import("./Constructeur"));
const Presentations = lazy(() => import("./deck/Presentations"));
const Articles = lazy(() => import("./Articles"));
const Accueil = lazy(() => import("./contenu/Accueil"));
const Diagnostic = lazy(() => import("./Diagnostic"));
const Journal = lazy(() => import("./Journal"));
const Medias = lazy(() => import("./Medias"));
const Outils = lazy(() => import("./Outils"));
import { authConfiguree, connexion, deconnexion, FOURNISSEUR, useSession, verifierSession } from "./auth";
import { Attente, Bouton, Champ, Onglets, Panneau, Pastille, Saisie } from "./ui";
import { journal as journalDepot, MODE_STOCKAGE } from "./depot";
import { demarrer, surErreur } from "./serveur/adaptateur";
import type { ErreurApi } from "./serveur/contrat";
import "./admin.css";

/**
 * Panel d'administration — /admin
 *
 * Adresse volontairement non liée depuis le site et interdite d'indexation
 * (robots.txt + balise noindex posée ci-dessous). Ce n'est PAS une mesure de
 * sécurité — une URL non listée finit toujours par être découverte — mais une
 * mesure d'hygiène : elle évite que le panel apparaisse dans les résultats de
 * recherche. La sécurité réelle repose entièrement sur l'authentification.
 */

/** Empêche l'indexation du panel, quoi qu'il arrive. */
const useNoIndex = () => {
  useEffect(() => {
    document.title = "Administration — Megasoft";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow, noarchive";
    document.head.appendChild(m);
    return () => {
      m.remove();
    };
  }, []);
};

const Connexion = () => {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const r = await connexion(email, mdp);
    setEnvoi(false);
    journalDepot.ecrire(email || "inconnu", r.ok ? "connexion" : "connexion-refusee", "panel");
    if (!r.ok) setErreur(r.message);
  };

  return (
    <div className="ms-panel ms-fond min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm ms-entre-vue">
        <div className="flex justify-center mb-6">
          <MegasoftLogo pole="office" className="text-[19px]" />
        </div>

        <Panneau titre="Administration">
          {!authConfiguree ? (
            /* Échec fermé : sans service d'identité, on n'ouvre rien. */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pastille ton="bloc">Accès fermé</Pastille>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">
                Aucun service d'authentification n'est configuré sur cet hébergement. Le panel refuse donc tout
                accès — c'est le comportement voulu : accorder l'entrée « en attendant » reviendrait à publier
                une administration ouverte à tous.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500 border-t border-slate-200 pt-3">
                La mise en service attend les accès du serveur et de la base de données, à communiquer par la
                Direction.
              </p>
            </div>
          ) : (
            <form onSubmit={soumettre}>
              {FOURNISSEUR === "atelier" && (
                /* `data-authentification` est le MARQUEUR que lit
                   `scripts/verifier-dist.mjs` pour refuser un site construit
                   avec le mode atelier. Il ne doit pas être renommé, et il ne
                   doit exister nulle part ailleurs : c'est ce qui le distingue
                   d'une phrase explicative comme « Mode atelier : aucun mot de
                   passe n'est vérifié », qui peut légitimement s'écrire dans
                   une branche inactive.

                   Quand `VITE_ADMIN_AUTH` ne vaut pas « atelier », la condition
                   est constante à la construction : ce bloc entier disparaît du
                   bundle, et le marqueur avec lui. */
                <div
                  data-authentification="MEGASOFT_AUTH_ATELIER_ACTIF"
                  className="mb-3 p-2 border border-amber-200 bg-amber-50 rounded"
                >
                  <Pastille ton="alerte">Mode atelier</Pastille>
                  {/* Le texte disait « absent du site construit ». C'est vrai
                      par défaut, mais plus dès que VITE_ADMIN_AUTH=atelier est
                      posé au build — c'est justement le cas ici. Un avertissement
                      qui décrit une situation autre que celle sous les yeux du
                      lecteur ne l'avertit de rien. */}
                  <p className="mt-1.5 text-[10.5px] leading-snug text-amber-800">
                    Aucune vérification réelle n'est effectuée : ce formulaire écarte un visiteur de passage,
                    rien de plus. À réserver à une adresse de test. N'y saisissez jamais un vrai mot de passe.
                  </p>
                </div>
              )}

              <Champ label="Identifiant">
                <Saisie
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@megasoft-office.com"
                  required
                />
              </Champ>
              <Champ label="Mot de passe">
                <Saisie
                  type="password"
                  autoComplete="current-password"
                  value={mdp}
                  onChange={(e) => setMdp(e.target.value)}
                  required
                />
              </Champ>

              {erreur && (
                <p className="ms-insere mb-3 text-[11px] leading-snug text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                  {erreur}
                </p>
              )}

              <Bouton variante="principal" type="submit" disabled={envoi} className="w-full justify-center">
                {/* Pendant la vérification, un point qui bat vaut mieux qu'un
                    libellé figé : on voit que la demande est partie. */}
                {envoi && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-ping" />
                )}
                {envoi ? "Vérification…" : "Se connecter"}
              </Bouton>
            </form>
          )}
        </Panneau>

        <p className="mt-4 text-center text-[10.5px] text-slate-400">
          Accès réservé — Megasoft Office
        </p>
      </div>
    </div>
  );
};

type Vue =
  | "articles"
  | "accueil"
  | "constructeur"
  | "markdown"
  | "presentations"
  | "medias"
  | "diagnostic"
  | "journal"
  | "outils";

/**
 * Remplit le cache au montage et remonte les échecs d'écriture.
 *
 * En mode navigateur, les deux sont sans objet : `demarrer()` n'est pas appelé
 * et aucune erreur réseau ne peut survenir. Le crochet est donc entièrement
 * inerte tant que `VITE_API_URL` n'est pas déclarée.
 */
const useStockageServeur = (connecte: boolean) => {
  const [erreur, setErreur] = useState<ErreurApi | null>(null);

  useEffect(() => {
    if (MODE_STOCKAGE !== "serveur" || !connecte) return;
    // Après la connexion seulement : remplir le cache avant d'avoir une session
    // ne produirait que des refus, et le bandeau d'erreur s'afficherait
    // par-dessus l'écran de connexion.
    void demarrer();
    return surErreur(setErreur);
  }, [connecte]);

  return { erreur, effacer: () => setErreur(null) };
};

const AdminApp = () => {
  useNoIndex();
  const session = useSession();
  const [vue, setVue] = useState<Vue>("articles");
  const { erreur, effacer } = useStockageServeur(!!session);

  // Une seule fois, au montage : « qui est connecté ? ». Sans effet hors du
  // mode serveur, où la réponse est déjà connue.
  useEffect(() => {
    void verifierSession();
  }, []);

  /*
   * `undefined` — la réponse du serveur n'est pas encore arrivée.
   *
   * Afficher l'écran de connexion pendant ce temps le ferait clignoter à chaque
   * rechargement pour une personne déjà connectée, et certaines commenceraient
   * à y taper leur mot de passe.
   */
  if (session === undefined) {
    return (
      <div className="ms-panel ms-fond min-h-screen flex items-center justify-center">
        <Attente />
      </div>
    );
  }

  if (!session) return <Connexion />;

  return (
    <div className="ms-panel ms-fond min-h-screen text-slate-800">
      {/* La barre est translucide et floute ce qui passe dessous : on garde le
          repère de défilement sans laisser le contenu traverser le titre. */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_0_rgba(15,23,42,0.03),0_6px_18px_-12px_rgba(15,23,42,0.28)]">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MegasoftLogo pole="office" className="text-[15px]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 border-l border-slate-200 pl-3">
              Administration
            </span>
            <nav className="ml-2">
              <Onglets
                valeur={vue}
                /* Passer `setVue` directement ferait déduire `T` depuis
                   `SetStateAction<Vue>` — une fonction, donc hors contrainte,
                   et l'onglet retomberait sur `string`. */
                onChange={(v) => setVue(v)}
                items={[
                  ["articles", "Articles"],
                  ["accueil", "Page d'accueil"],
                  ["constructeur", "Constructeur"],
                  ["markdown", "Markdown"],
                  ["presentations", "Présentations"],
                  ["medias", "Médias"],
                  ["diagnostic", "Diagnostic"],
                  ["journal", "Journal"],
                  ["outils", "Outils"],
                ]}
              />
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {FOURNISSEUR === "atelier" && <Pastille ton="alerte">Mode atelier</Pastille>}
            {/* Un rédacteur doit savoir si son travail quitte son navigateur.
                Tant que le serveur n'est pas branché, tout ce qu'il écrit vit
                sur son seul poste — le lui cacher serait un piège. */}
            {MODE_STOCKAGE === "navigateur" && (
              <Pastille ton="alerte">Stockage local</Pastille>
            )}
            <span className="text-[11.5px] text-slate-500">{session.email}</span>
            <Bouton
              variante="neutre"
              onClick={() => {
                journalDepot.ecrire(session.email, "deconnexion", "panel");
                // `deconnexion` prévient d'abord le serveur, qui supprime la
                // session en base ; elle rend donc une promesse.
                void deconnexion();
              }}
            >
              Se déconnecter
            </Bouton>
          </div>
        </div>
      </header>

      {/* `key` sur la vue : React démonte l'ancienne et remonte la nouvelle, ce
          qui rejoue l'animation d'entrée à chaque changement d'onglet. Sans
          elle, passer d'Articles à Journal remplacerait le contenu d'un coup,
          sans que rien n'indique que la page a changé. */}
      {/* Une écriture refusée par le serveur doit se voir. Elle survient après
          que la vue a rendu la main : impossible de la signaler à l'endroit du
          clic, d'où ce bandeau. Le pire des cas serait le silence — l'éditeur
          croirait avoir publié. */}
      {erreur && (
        <div className="ms-insere border-b border-red-200 bg-red-50">
          <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-start gap-3">
            <Pastille ton="bloc">Échec</Pastille>
            <p className="flex-1 text-[12px] leading-relaxed text-red-800">{erreur.message}</p>
            <Bouton variante="neutre" onClick={effacer}>
              Fermer
            </Bouton>
          </div>
        </div>
      )}

      <Suspense fallback={<Attente />}>
        <div key={vue} className="ms-entre-vue">
          {vue === "articles" && <Articles onEditer={(v) => setVue(v)} acteur={session.email} />}
          {vue === "accueil" && <Accueil />}
          {vue === "constructeur" && <Constructeur acteur={session.email} />}
          {vue === "markdown" && <Editeur acteur={session.email} />}
          {vue === "presentations" && <Presentations acteur={session.email} />}
          {vue === "medias" && <Medias acteur={session.email} />}
          {vue === "diagnostic" && <Diagnostic />}
          {vue === "journal" && <Journal />}
          {vue === "outils" && <Outils acteur={session.email} />}
        </div>
      </Suspense>
    </div>
  );
};

export default AdminApp;
