import { HelpCircle } from "lucide-react";
import { questions } from "@/data/faq";

/**
 * Accordéon en `<details>` natifs, et non en composant à état.
 *
 * Le contenu d'un accordéon JavaScript n'existe pas tant qu'il n'est pas
 * ouvert : un robot n'en lit rien. Avec `<details>`, les réponses sont dans le
 * document dès la première ligne, dépliables sans une ligne de script, et
 * accessibles au clavier sans qu'on ait à câbler quoi que ce soit.
 */
const Faq = () => (
  <section id="faq" className="py-24 md:py-32 relative scroll-mt-24 overflow-hidden">
    {/* Même trame de points que les sections voisines, pour que la FAQ ne
        paraisse pas rapportée. */}
    <div
      className="absolute inset-0 opacity-40 pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black,transparent)]"
      style={{
        backgroundImage: "radial-gradient(hsl(var(--ms-blue)/0.15) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />

    <div className="container mx-auto px-4 relative">
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span className="inline-block px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider text-ms-ink/60 mb-6">
          Questions fréquentes
        </span>
        <h2 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-4">
          Les questions qu'on nous pose
        </h2>
        <p className="text-ms-ink/60">
          Conformité, déploiement, périmètre : les réponses en clair. Si la vôtre n'y est pas,
          écrivez-nous.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {questions.map((q) => (
          <details
            key={q.question}
            className="group rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden transition-shadow"
          >
            <summary className="flex items-start gap-4 p-5 md:p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="w-9 h-9 rounded-full bg-ms-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <HelpCircle className="w-[18px] h-[18px] text-ms-blue" />
              </span>
              <h3 className="flex-1 font-bold text-ms-ink text-[15px] md:text-base leading-snug">
                {q.question}
              </h3>
              {/* Chevron en CSS pur : il pivote à l'ouverture sans état React. */}
              <span className="flex-shrink-0 mt-1.5 w-2.5 h-2.5 border-r-2 border-b-2 border-ms-ink/30 rotate-45 group-open:rotate-[225deg] transition-transform duration-300" />
            </summary>
            <p className="px-5 md:px-6 pb-5 md:pb-6 pl-[4.25rem] md:pl-[4.5rem] text-[14px] text-ms-ink/70 leading-relaxed">
              {q.reponse}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export default Faq;
