import { useEffect, useState } from "react";
import PourquoiNousBureau from "@/components/PourquoiNousBureau";
import PourquoiNousTelephone from "@/components/PourquoiNousTelephone";

/**
 * « Pourquoi nous » — l'aiguillage entre les deux variantes de la section.
 *
 * POURQUOI DEUX VARIANTES, ET NON UNE SEULE RESPONSIVE
 * ----------------------------------------------------
 * La section a été refaite sur le gabarit du projet MyExoBrain : en-tête
 * accroché à gauche, quatre cartes qui s'empilent en éventail à droite, montée
 * liée au défilement et retenue par un ressort. Tout cela suppose deux colonnes
 * et une hauteur d'écran confortable.
 *
 * Sur un téléphone, la mise en page retombe en une seule colonne, et les deux
 * mécaniques se marchent dessus : l'en-tête collé à 164 px et les cartes collées
 * à 164-260 px se disputent la même bande, la pile passe par-dessus le titre.
 * Les seuils de la montée, eux, ont été relevés sur une page où les quatre
 * cartes tiennent dans un même écran — en colonne elles s'étalent sur plusieurs,
 * et la dernière serait déjà posée à son arrivée.
 *
 * On aurait pu cribler le portage d'exceptions pour le téléphone. Le choix
 * retenu est plus net : le téléphone reçoit la version Megasoft d'origine, celle
 * qui avait été conçue pour ce format, avec sa propre chorégraphie. Chaque
 * variante reste ainsi lisible et cohérente avec elle-même.
 *
 * LE SEUIL
 * --------
 * 810 px, la même borne que celle de `PourquoiNousBureau.module.css`. Au-dessus,
 * le portage assure lui-même son repli tablette (une colonne, sans épinglage) ;
 * en dessous, on change de composant.
 *
 * RENDU SERVEUR
 * -------------
 * Sans fenêtre, `telephone` vaut `false` : c'est la variante bureau qui part
 * dans le HTML pré-généré. C'est le bon défaut — le contenu n'y figure qu'une
 * fois, et les deux variantes disent la même chose.
 */
const TELEPHONE = "(max-width: 809.98px)";

const PourquoiNous = () => {
  /*
   * L'initialisateur est une fonction : côté navigateur, le tout premier rendu
   * connaît déjà le bon palier. Sans cela, un téléphone monterait d'abord la
   * variante bureau — donc sa boucle d'animation et ses mesures — avant de la
   * jeter à l'effet suivant.
   */
  const [telephone, setTelephone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(TELEPHONE).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(TELEPHONE);
    const suivre = () => setTelephone(mq.matches);
    // Relu au montage : entre le premier rendu et cet effet, l'orientation a pu
    // changer (rotation pendant le chargement).
    suivre();
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  return telephone ? <PourquoiNousTelephone /> : <PourquoiNousBureau />;
};

export default PourquoiNous;
