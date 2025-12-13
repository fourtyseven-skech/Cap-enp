import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    // "bg-transparent" permet de voir le fond du body ou de la page
    <div className="flex flex-col min-h-screen bg-transparent font-sans text-foreground">
      
      <Header />
      
      {/* "flex-grow" assure que le footer reste en bas si le contenu est court */}
      <main className="flex-grow pt-24 w-full">
        {children}
      </main>
      
      <Footer />
    </div>
  );
};

export default Layout;