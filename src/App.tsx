import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// Components
import IntroAnimation from "./components/IntroAnimation";
import Layout from "./components/Layout"; 

// Pages
import Index from "./pages/Index";
import Structure from "./pages/Structure"; 
import Contact from "./pages/Contact";     
import Projets from "./pages/Projets"; // <-- IMPORT AJOUTÉ
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem("hasSeenIntro");
    if (hasSeenIntro) {
      setShowIntro(false);
    }
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
    sessionStorage.setItem("hasSeenIntro", "true");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <AnimatePresence mode="wait">
          {showIntro ? (
            <IntroAnimation key="intro" onComplete={handleIntroComplete} />
          ) : (
            <motion.div
              key="main-app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              // AJOUT DE bg-transparent pour voir les particules
              className="w-full min-h-screen bg-transparent"
            >
              <BrowserRouter>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/structure" element={<Structure />} />
                    <Route path="/contact" element={<Contact />} />
                    
                    {/* ROUTE AJOUTÉE */}
                    <Route path="/projets" element={<Projets />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </BrowserRouter>
            </motion.div>
          )}
        </AnimatePresence>
        
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;