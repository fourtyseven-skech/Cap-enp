import ChoixMedia from "./ChoixMedia";

/**
 * ---------------------------------------------------------------------------
 * CHOISIR UNE IMAGE
 * ---------------------------------------------------------------------------
 *
 * Le sélecteur d'images des articles — la vignette de couverture.
 *
 * POURQUOI CE FICHIER NE FAIT PLUS QUE TROIS LIGNES
 * -------------------------------------------------
 * Il contenait sa propre bibliothèque, son propre envoi et ses deux transports.
 * L'éditeur de la page d'accueil avait besoin exactement de la même chose, plus
 * la vidéo, les seuils de poids et la suppression protégée.
 *
 * Deux composants qui envoient des fichiers, c'est deux endroits où corriger le
 * jour où l'envoi change — et un seul des deux qui sera corrigé. Le sélecteur
 * complet vit donc dans `ChoixMedia`, et ce fichier n'est plus que son nom
 * d'usage pour les articles : `accepte="image"` et un libellé.
 *
 * Il reste parce que les articles l'appellent ainsi et que le renommer partout
 * n'apporterait rien.
 */
const ChoixImage = (proprietes: {
  valeur: string;
  onChange: (url: string) => void;
  alt?: string;
  libelle?: string;
  aide?: string;
}) => (
  <ChoixMedia
    accepte="image"
    {...proprietes}
    /* Après l'étalement, et non avant : `libelle={undefined}` écraserait la
       valeur posée ici et le champ s'intitulerait « Fichier ». */
    libelle={proprietes.libelle ?? "Vignette"}
  />
);

export default ChoixImage;
