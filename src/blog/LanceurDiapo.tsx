import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { lireDepuisPage } from "./deck/depuisArticle";
import type { Document } from "./deck/modele";

/**
 * ---------------------------------------------------------------------------
 * ENTRÉE DANS LE MODE DIAPOSITIVES
 * ---------------------------------------------------------------------------
 *
 * Îlot interactif, au même titre que l'en-tête et le pied de page : la page de
 * l'article est du HTML pré-généré, ce composant ne fait que l'augmenter.
 *
 * Le bouton est rendu par le JavaScript et non par le générateur statique, et
 * c'est volontaire : sans JavaScript, le mode diapo n'existe pas, et un bouton
 * mort est pire que pas de bouton. La hauteur est en revanche réservée dans la
 * page pour que son apparition ne décale rien.
 *
 * Le document n'est pas reconstruit ici : il est lu dans le bloc JSON déposé
 * par le générateur — l'idée gardée de `nyblnet/bento`, le document voyage avec
 * la page et se lit à l'œil nu dans la source. Cela évite surtout d'embarquer
 * l'analyseur Markdown et le contenu de tous les articles dans le script de
 * chaque page du blog.
 */

/**
 * Le présentateur est chargé à la demande : il ne sert qu'au moment où
 * quelqu'un décide de projeter. Le lier statiquement le ferait télécharger sur
 * chaque page du blog — index et pages de catégorie comprises, où il n'a même
 * pas de bouton pour être déclenché.
 */
const Presentateur = lazy(() => import("./deck/Presentateur"));

export const LanceurDiapo = ({ doc: fourni }: { doc?: Document }) => {
  const [doc, setDoc] = useState<Document | null>(fourni ?? null);
  const [ouvert, setOuvert] = useState(false);
  const [depart, setDepart] = useState(0);

  useEffect(() => {
    if (fourni) return;
    setDoc(lireDepuisPage());
  }, [fourni]);

  /**
   * Ouverture directe. Deux chemins : `?diapo` (un lien partagé, un QR code
   * projeté en salle) et `#diapo-<n>` (une diapositive précise). Le second
   * ouvre AU BON ENDROIT — c'est ce qui rend une adresse de diapositive
   * réellement partageable, et pas seulement décorative.
   */
  useEffect(() => {
    if (!doc || typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.startsWith("#diapo-")) {
      const n = parseInt(hash.slice("#diapo-".length), 10);
      setDepart(Number.isFinite(n) ? Math.max(0, n - 1) : 0);
      setOuvert(true);
      return;
    }
    if (new URLSearchParams(window.location.search).has("diapo")) setOuvert(true);
  }, [doc]);

  /**
   * Le défilement de l'article est bloqué pendant la présentation. Sans cela,
   * une molette ou un balayage vertical fait défiler le texte derrière la
   * scène : à la fermeture, on se retrouve à un endroit qu'on n'a pas choisi.
   */
  useEffect(() => {
    if (typeof document === "undefined" || !ouvert) return;
    const avant = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = avant;
    };
  }, [ouvert]);

  const fermer = useCallback(() => setOuvert(false), []);

  if (!doc) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDepart(0);
          setOuvert(true);
        }}
        className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-black/10 bg-white/70 text-[11px] font-bold uppercase tracking-[0.15em] text-ms-ink/55 hover:text-ms-ink hover:border-black/25 transition-colors"
      >
        <span className="flex items-center gap-[3px]" aria-hidden>
          <span className="w-1.5 h-3 rounded-[1px] bg-ms-blue" />
          <span className="w-1.5 h-3 rounded-[1px] bg-ms-pink" />
          <span className="w-1.5 h-3 rounded-[1px] bg-ms-green" />
        </span>
        Voir en diaporama
        <span className="text-ms-ink/25 group-hover:text-ms-ink/40 normal-case tracking-normal font-semibold">
          {doc.diapositives.length} vues
        </span>
      </button>

      {ouvert && (
        // Voile pendant le chargement : sur une connexion lente, un clic sans
        // réaction visible passe pour une panne et on reclique.
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[120] bg-[#0B1120] flex items-center justify-center">
              <span className="flex items-center gap-1.5" aria-label="Chargement de la présentation">
                <span className="w-7 h-[3px] bg-ms-blue animate-pulse" />
                <span className="w-7 h-[3px] bg-ms-pink animate-pulse" />
                <span className="w-7 h-[3px] bg-ms-green animate-pulse" />
              </span>
            </div>
          }
        >
          <Presentateur doc={doc} depart={depart} onFermer={fermer} />
        </Suspense>
      )}
    </>
  );
};

export default LanceurDiapo;
