import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ElGraphique, Theme } from "./modele";

/**
 * ---------------------------------------------------------------------------
 * GRAPHIQUES
 * ---------------------------------------------------------------------------
 *
 * Repris de bento, qui embarque ses propres graphiques plutôt que d'appeler un
 * service. Ici c'est `recharts`, déjà présent dans le projet.
 *
 * FICHIER SÉPARÉ, ET C'EST SA RAISON D'ÊTRE. `recharts` pèse plus de 300
 * kilooctets. Lié directement au rendu, il suivrait jusque sur les pages
 * publiques du blog — où il ne sert à rien : une présentation dérivée d'un
 * article ne contient de graphique que si l'article contenait un tableau. Il
 * est donc passé en PARAMÈTRE au rendu ; le panel et l'export le fournissent,
 * le site ne le fournit pas et n'en paie pas le poids.
 *
 * DIMENSIONS EXPLICITES, jamais de conteneur responsive : celui-ci mesure son
 * parent au montage, ce qui suppose un navigateur et une mise en page déjà
 * calculée. Or le rendu sert aussi hors navigateur pour l'export en fichier
 * autonome — un graphique responsive y sortirait vide. La boîte de l'élément
 * donne déjà les dimensions, la mesure n'apporterait rien.
 */

export const Graphique = ({ el, theme }: { el: ElGraphique; theme: Theme }) => {
  const serie = el.serie.filter((p) => p.etiquette || Number.isFinite(p.valeur));
  if (!serie.length) return null;

  const L = Math.max(el.l, 80);
  const H = Math.max(el.h, 60);
  const marge = { top: 8, right: 12, bottom: 0, left: 0 };

  /** Les couleurs de série : l'accent choisi, puis les autres du thème. */
  const couleurs = [el.couleur, ...theme.accents.filter((c) => c !== el.couleur)];

  const axes = (
    <>
      {el.grille && <CartesianGrid stroke={`${theme.attenue}22`} vertical={false} />}
      <XAxis
        dataKey="etiquette"
        stroke={theme.attenue}
        tick={{ fill: theme.attenue, fontSize: 14, fontWeight: 700 }}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        stroke={theme.attenue}
        tick={{ fill: theme.attenue, fontSize: 13 }}
        tickLine={false}
        axisLine={false}
        width={52}
      />
    </>
  );

  if (el.graphe === "secteurs") {
    const rayon = Math.min(L, H) / 2 - 8;
    return (
      <PieChart width={L} height={H}>
        <Pie
          data={serie}
          dataKey="valeur"
          nameKey="etiquette"
          cx="50%"
          cy="50%"
          outerRadius={rayon}
          innerRadius={rayon * 0.55}
          paddingAngle={2}
          stroke="none"
          // Animation désactivée : elle ne se rejouerait pas à l'identique d'une
          // diapositive à l'autre, et elle ne produit rien du tout dans un rendu
          // statique — le graphique exporté sortirait vide.
          isAnimationActive={false}
          label={{ fill: theme.encre, fontSize: 14, fontWeight: 700 }}
        >
          {serie.map((_, i) => (
            <Cell key={i} fill={couleurs[i % couleurs.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  if (el.graphe === "lignes") {
    return (
      <LineChart width={L} height={H} data={serie} margin={marge}>
        {axes}
        <Line
          type="monotone"
          dataKey="valeur"
          stroke={el.couleur}
          strokeWidth={3.5}
          dot={{ r: 5, fill: el.couleur, stroke: "none" }}
          isAnimationActive={false}
        />
      </LineChart>
    );
  }

  if (el.graphe === "aires") {
    return (
      <AreaChart width={L} height={H} data={serie} margin={marge}>
        <defs>
          <linearGradient id={`aire-${el.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={el.couleur} stopOpacity={0.45} />
            <stop offset="100%" stopColor={el.couleur} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {axes}
        <Area
          type="monotone"
          dataKey="valeur"
          stroke={el.couleur}
          strokeWidth={3}
          fill={`url(#aire-${el.id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    );
  }

  return (
    <BarChart width={L} height={H} data={serie} margin={marge}>
      {axes}
      <Bar dataKey="valeur" radius={[6, 6, 0, 0]} isAnimationActive={false}>
        {serie.map((_, i) => (
          <Cell key={i} fill={couleurs[i % couleurs.length]} />
        ))}
      </Bar>
    </BarChart>
  );
};

export default Graphique;
