import { useEffect, useMemo, useState } from "react";
import { journal, surChangement, LIBELLES, SENSIBLES, type Action, type Entree } from "./depot";
import { Bouton, Liste, Panneau, Pastille, Saisie } from "./ui";

/**
 * Journal d'activité.
 *
 * Il répond à quatre questions distinctes, qu'on confond souvent :
 * qui a fait quoi (retracer), y a-t-il eu un accès anormal (détecter),
 * qu'est-il arrivé à cet article (comprendre après coup), et à plusieurs
 * rédacteurs, qui est responsable de quoi (trancher).
 *
 * ⚠️ Ce journal-ci est écrit dans le navigateur : il est effaçable par la
 * personne même qu'il est censé tracer, et perdu au changement de poste. Sur
 * le serveur il devra être en AJOUT SEUL — aucune route ne permettant de
 * modifier ou d'effacer une ligne, y compris à un administrateur. Sans quoi il
 * ne prouve rien.
 */

const quand = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const Journal = () => {
  const [entrees, setEntrees] = useState<Entree[]>(() => journal.lister());
  const [filtre, setFiltre] = useState<string>("toutes");
  const [recherche, setRecherche] = useState("");

  useEffect(() => surChangement(() => setEntrees(journal.lister())), []);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return entrees.filter((e) => {
      if (filtre === "sensibles" && !SENSIBLES.includes(e.action)) return false;
      if (filtre !== "toutes" && filtre !== "sensibles" && e.action !== filtre) return false;
      if (!q) return true;
      return (
        e.acteur.toLowerCase().includes(q) ||
        e.cible.toLowerCase().includes(q) ||
        (e.detail ?? "").toLowerCase().includes(q)
      );
    });
  }, [entrees, filtre, recherche]);

  const sensibles = entrees.filter((e) => SENSIBLES.includes(e.action)).length;

  return (
    <div className="max-w-[1400px] mx-auto p-4 space-y-4">
      <div className="p-3 rounded border border-amber-200 bg-amber-50">
        <Pastille ton="alerte">Simulation locale</Pastille>
        <p className="mt-1.5 text-[11px] leading-snug text-amber-900">
          Ce journal est stocké dans le navigateur : effaçable, et perdu si vous changez de poste. Sur le
          serveur, il devra être en <strong>ajout seul</strong> — non modifiable, non effaçable, même par un
          administrateur. Un journal qu'on peut nettoyer ne prouve rien.
        </p>
      </div>

      <Panneau
        titre={`Journal — ${liste.length} sur ${entrees.length}`}
        action={
          <span className="flex items-center gap-2">
            {sensibles > 0 && <Pastille ton="bloc">{sensibles} sensibles</Pastille>}
            <Bouton variante="discret" onClick={() => journal.vider()}>
              Vider
            </Bouton>
          </span>
        }
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <Saisie
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un acteur, une cible…"
            className="flex-1 min-w-[200px]"
          />
          <Liste value={filtre} onChange={(e) => setFiltre(e.target.value)} className="w-auto">
            <option value="toutes">Toutes les actions</option>
            <option value="sensibles">Actions sensibles seulement</option>
            {(Object.keys(LIBELLES) as Action[]).map((a) => (
              <option key={a} value={a}>
                {LIBELLES[a]}
              </option>
            ))}
          </Liste>
        </div>

        {liste.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-slate-400">
            Aucune entrée. Les actions du panel s'enregistreront ici.
          </p>
        ) : (
          // Quatre colonnes fixes : sous 700 px, la dernière (la cible, la plus
          // longue) se retrouvait réduite à rien. Le tableau garde sa largeur
          // et se balaie latéralement.
          <div className="border border-slate-200 rounded overflow-x-auto">
            <div className="min-w-[620px]">
            <div className="grid grid-cols-[120px_150px_150px_1fr] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              {["Date", "Acteur", "Action", "Cible"].map((t) => (
                <span key={t} className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {t}
                </span>
              ))}
            </div>
            {liste.map((e) => {
              const chaud = SENSIBLES.includes(e.action);
              return (
                <div
                  key={e.id}
                  className={`grid grid-cols-[120px_150px_150px_1fr] gap-2 px-3 py-1.5 items-center border-b border-slate-100 last:border-b-0 ${
                    chaud ? "bg-red-50/50" : ""
                  }`}
                >
                  <span className="text-[10.5px] font-mono text-slate-500 tabular-nums">{quand(e.date)}</span>
                  <span className="text-[11px] text-slate-700 truncate">{e.acteur}</span>
                  <span>
                    <Pastille ton={chaud ? "bloc" : "neutre"}>{LIBELLES[e.action]}</Pastille>
                  </span>
                  <span className="min-w-0 text-[11px] text-slate-600 truncate">
                    <span className="font-mono text-slate-500">{e.cible}</span>
                    {e.detail && <span className="text-slate-400"> — {e.detail}</span>}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </Panneau>
    </div>
  );
};

export default Journal;
