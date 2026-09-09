import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

/**
 * Retrait du squelette de chargement (voir index.html).
 *
 * `render()` programme le rendu, il ne le termine pas : retirer le squelette
 * dans la foulée découvrirait un écran vide pendant les quelques millisecondes
 * où React monte encore son arbre — un clignotement qui annule précisément ce
 * que le squelette apporte. On attend donc DEUX images : la première tombe
 * pendant le rendu, la seconde une fois qu'il est peint.
 *
 * Le squelette s'efface ensuite en fondu plutôt que de disparaître d'un coup.
 * La différence est courte mais elle change la lecture : une disparition nette
 * ressemble à un rechargement, un fondu ressemble à un remplissage.
 *
 * Si quoi que ce soit échoue avant d'arriver ici — bundle absent, erreur au
 * chargement — le minuteur d'index.html finit par révéler le squelette, qui
 * reste alors à l'écran. C'est délibéré : mieux vaut une page qui a l'air
 * d'attendre qu'une page figée. Mais il ne se montre QUE dans ce cas : sur une
 * connexion normale, il est annulé avant d'avoir paru.
 */
const squelette = document.getElementById("ms-squelette");
if (squelette) {
  /*
   * On annule d'abord le minuteur qui devait révéler le squelette (voir
   * index.html). C'est LUI qui fait que, sur une connexion normale, le visiteur
   * ne voit jamais d'écran de chargement : React a peint avant l'échéance, le
   * squelette part sans avoir été affiché une seule image.
   *
   * Sans cette annulation, le minuteur se déclencherait pendant le fondu de
   * sortie et rallumerait brièvement le squelette — exactement le clignotement
   * qu'on cherche à supprimer.
   */
  clearTimeout((window as unknown as { __msSqueletteDelai?: number }).__msSqueletteDelai);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      squelette.classList.add("ms-squelette--parti");
      // Le retrait suit la transition. Un minuteur plutôt que
      // `transitionend` : cet évènement ne se déclenche pas si l'élément est
      // masqué entre-temps (onglet en arrière-plan), et le squelette resterait
      // alors dans le document, à intercepter les clics.
      setTimeout(() => squelette.remove(), 400);
    })
  );
}
