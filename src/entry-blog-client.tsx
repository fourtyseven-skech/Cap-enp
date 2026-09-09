import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { BrowserRouter } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LanceurDiapo from "@/blog/LanceurDiapo";

/**
 * Îlots interactifs des pages du blog.
 *
 * Les pages du blog sont du HTML pré-généré : tout le texte des articles est
 * déjà dans le document et ne dépend pas de ce script. Celui-ci ne fait que
 * réactiver l'en-tête et le pied de page du site — état au défilement, menu
 * mobile, effet de survol — pour qu'ils soient exactement ceux de la page
 * d'accueil, et non une imitation.
 *
 * Conséquence volontaire : si ce script ne se charge pas, l'article reste
 * intégralement lisible et indexable. C'est le principe des îlots — on
 * n'hydrate que ce qui a réellement besoin de l'être.
 *
 * `createRoot` plutôt que `hydrateRoot` : ces deux blocs sont petits, les
 * reconstruire est instantané et cela supprime tout risque d'écart entre le
 * rendu serveur et le rendu client.
 *
 * `flushSync` est en revanche indispensable. Sans lui, React 18 planifie le
 * rendu de façon concurrente : le conteneur est vidé, le navigateur peint une
 * frame vide, puis le contenu réapparaît — soit un clignotement de l'en-tête à
 * chaque arrivée sur une page, qui ruinait la transition. Forcé en synchrone,
 * l'échange se fait dans la même tâche : rien n'est peint entre les deux.
 */
const monter = (id: string, contenu: React.ReactElement) => {
  const hote = document.getElementById(id);
  if (!hote) return;
  const racine = createRoot(hote);
  flushSync(() => racine.render(contenu));
};

monter(
  "ms-header",
  // Header lit `useLocation` : il lui faut un routeur, même si la navigation
  // reste en chargement de page complet (`staticNav`).
  <BrowserRouter>
    <Header staticNav />
  </BrowserRouter>
);

monter("ms-footer", <Footer />);

/**
 * Mode diaporama — présent sur les pages d'article uniquement, où le
 * générateur a déposé le deck et son point de montage. `monter` ne fait rien
 * si le conteneur est absent : l'index et les pages de catégorie ne paient donc
 * rien pour cet îlot.
 *
 * `flushSync` n'a pas de raison d'être ici : contrairement à l'en-tête, ce
 * conteneur est vide dans le HTML pré-généré — il n'y a aucun contenu à
 * échanger, donc aucun clignotement possible.
 */
monter("ms-diapo-lanceur", <LanceurDiapo />);
