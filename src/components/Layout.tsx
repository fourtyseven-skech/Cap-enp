import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  // Sur la home, le hero vidéo passe sous le header (pas de padding),
  // pour que le header en verre flotte sur la vidéo et non sur du blanc.
  const isHome = useLocation().pathname === "/";

  return (
    // "bg-transparent" permet de voir le fond du body ou de la page
    <div className="flex flex-col min-h-screen bg-transparent font-sans text-foreground">

      {/* Les mêmes identifiants que sur les pages du blog (voir BlogShell).
          Ils ne servent pas à styler : ils permettent à la feuille de style de
          donner un `view-transition-name` à l'en-tête et au pied de page.

          Sans eux ici, l'en-tête portait un nom sur le blog et aucun sur
          l'accueil : d'un document à l'autre, le navigateur ne pouvait pas
          reconnaître qu'il s'agissait du MÊME élément. Il le traitait donc
          comme un élément neuf — la barre disparaissait avec l'ancienne page
          puis réapparaissait d'un coup, ce qui donnait toute son instabilité au
          passage vers le blog. Nommée des deux côtés, elle reste simplement
          immobile pendant que le contenu, lui, se croise. */}
      <div id="ms-header">
        <Header />
      </div>

      {/* "flex-grow" assure que le footer reste en bas si le contenu est court */}
      <main className={`flex-grow w-full ${isHome ? "" : "pt-24"}`}>
        {children}
      </main>

      <div id="ms-footer">
        <Footer />
      </div>
    </div>
  );
};

export default Layout;