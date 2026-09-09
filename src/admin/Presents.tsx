import { depuis, usePresence } from "./presence";

/**
 * ---------------------------------------------------------------------------
 * « QUELQU'UN D'AUTRE EST ICI »
 * ---------------------------------------------------------------------------
 *
 * Un bandeau discret, posé en haut d'un écran d'édition. Il ne s'affiche que
 * lorsqu'une autre personne a le même élément ouvert — le reste du temps, il
 * n'occupe pas une ligne.
 *
 * POURQUOI IL N'EMPÊCHE RIEN
 * --------------------------
 * On peut écrire malgré l'avertissement, et c'est voulu : il arrive qu'on
 * sache très bien que le collègue vient de fermer son onglet. Ce que ce bandeau
 * évite, c'est le cas où l'on ne savait pas — vingt minutes de rédaction
 * perdues à cause d'un refus d'enregistrement parfaitement légitime.
 *
 * Le refus, lui, reste en place : c'est `If-Match` côté serveur, et l'écran de
 * conflit qui l'accompagne (`Conflit.tsx`).
 */
const Presents = ({ ressource }: { ressource: string | null }) => {
  const autres = usePresence(ressource);
  if (autres.length === 0) return null;

  return (
    <div className="ms-insere flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"
        aria-hidden
      />
      <span className="text-[11.5px] leading-snug text-amber-900">
        {autres.length === 1 ? (
          <>
            <strong>{autres[0]!.nom}</strong> a cet élément ouvert {depuis(autres[0]!.depuisMs)}.
            Vos modifications risquent de se croiser.
          </>
        ) : (
          <>
            <strong>{autres.map((a) => a.nom).join(", ")}</strong> ont cet élément ouvert. Vos
            modifications risquent de se croiser.
          </>
        )}
      </span>
    </div>
  );
};

export default Presents;
