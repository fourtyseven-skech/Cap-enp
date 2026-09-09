import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Aperçu rendu dans un cadre isolé.
 *
 * Les bascules responsives de Tailwind (`md:`, `lg:`) réagissent à la largeur
 * de la FENÊTRE, pas à celle du conteneur. Rendre l'aperçu directement dans la
 * page donnerait donc, en mode « mobile », la version bureau comprimée dans un
 * rectangle étroit — une confiance fausse, et le genre d'écart qu'on ne
 * découvre qu'une fois publié.
 *
 * Un <iframe> possède sa propre fenêtre : les bascules s'y déclenchent pour de
 * vrai. Les feuilles de style du document parent y sont recopiées, et
 * resynchronisées à chaque changement — indispensable en développement, où Vite
 * injecte et remplace les styles à chaud.
 */
const CadreApercu = ({
  largeur,
  children,
  surDocument,
}: {
  largeur: number | "100%";
  children: ReactNode;
  /**
   * Donne accès au document du cadre. Indispensable pour les raccourcis
   * clavier : un `keydown` produit dans un iframe ne remonte JAMAIS au document
   * parent. Sans cela, Ctrl+Z resterait sans effet dès que le curseur est posé
   * dans un texte de la page — c'est-à-dire précisément au moment où l'on
   * risque de vouloir annuler.
   */
  surDocument?: (doc: Document) => void;
}) => {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [corps, setCorps] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const doc = cadre.current?.contentDocument;
    if (!doc) return;
    surDocument?.(doc);

    const synchroniser = () => {
      doc.head.querySelectorAll("[data-copie]").forEach((n) => n.remove());
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
        const copie = n.cloneNode(true) as HTMLElement;
        copie.setAttribute("data-copie", "");
        doc.head.appendChild(copie);
      });
    };

    synchroniser();
    doc.documentElement.lang = "fr";
    doc.body.className = "bg-background";
    // Le cadre n'est qu'un miroir : rien n'y est cliquable.
    doc.body.style.pointerEvents = "none";
    setCorps(doc.body);

    const observateur = new MutationObserver(synchroniser);
    observateur.observe(document.head, { childList: true, subtree: true });
    return () => observateur.disconnect();
    // Monté une seule fois : recréer le cadre à chaque rendu du parent
    // rechargerait l'aperçu et ferait perdre la position de défilement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <iframe
        ref={cadre}
        title="Aperçu de l'article"
        className="bg-white border border-slate-300 rounded shadow-sm"
        style={{ width: largeur, height: "100%", transition: "width 160ms ease-out" }}
      />
      {corps && createPortal(children, corps)}
    </>
  );
};

export default CadreApercu;
