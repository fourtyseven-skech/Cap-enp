import Cover, { type Accent, type Motif } from "@/blog/covers";
import { FORMATS, type Format } from "@/lib/formats";
import { Pastille } from "./ui";

/**
 * Choix du format éditorial.
 *
 * C'est la décision la plus structurante de tout le panel, et elle est
 * volontairement présentée AVANT le titre. Le rédacteur ne choisit pas une
 * apparence mais une INTENTION commerciale ; la mise en page, le filigrane, la
 * couleur et la longueur cible en découlent automatiquement.
 *
 * Chaque carte montre l'illustration réelle qui sera produite : on juge sur ce
 * qu'on obtiendra, pas sur une description.
 */

const ORDRE: Format[] = ["info", "fond", "nouveaute", "offre", "terrain"];

const ARGUMENT: Record<Format, string> = {
  info: "Le format le plus rentable : rapide à écrire, et le plus souvent cité tel quel par ChatGPT ou Perplexity.",
  fond: "Le format qui construit la réputation. Coûteux à produire — à réserver aux sujets où Megasoft a vraiment quelque chose à dire.",
  nouveaute: "Rassure les clients existants et prouve que la gamme vit. À publier à chaque sortie de version.",
  offre: "Le plus proche de la vente. C'est celui qui doit convertir un lecteur en demande de démonstration.",
  terrain: "La preuve sociale la plus convaincante : un déploiement réel chez une entreprise comparable.",
};

const SelecteurFormat = ({
  valeur,
  onChange,
}: {
  valeur: Format;
  onChange: (f: Format, spec: { motif: Motif; accent: Accent }) => void;
}) => (
  <div className="ms-cascade grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
    {ORDRE.map((f) => {
      const spec = FORMATS[f];
      const actif = valeur === f;
      return (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f, { motif: spec.motif, accent: spec.accent })}
          aria-pressed={actif}
          className={`ms-levier text-left border rounded-lg overflow-hidden bg-white ${
            actif ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400"
          }`}
        >
          <Cover
            motif={spec.motif}
            accent={spec.accent}
            titreFantome=""
            etiquette={spec.nom}
            className="w-full h-[68px] block"
          />
          <div className="p-2.5 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-[12px] font-bold text-slate-800">{spec.nom}</h3>
              {actif && <Pastille ton="ok">Choisi</Pastille>}
            </div>
            <p className="text-[10.5px] leading-snug text-slate-500 mb-2">{ARGUMENT[f]}</p>
            <div className="flex flex-wrap gap-1">
              <Pastille ton="neutre">{spec.minutes[0]}–{spec.minutes[1]} min</Pastille>
              {spec.reponseRapide && <Pastille ton="alerte">En bref requis</Pastille>}
              {spec.sommaire && <Pastille ton="neutre">Sommaire</Pastille>}
            </div>
          </div>
        </button>
      );
    })}
  </div>
);

export default SelecteurFormat;
