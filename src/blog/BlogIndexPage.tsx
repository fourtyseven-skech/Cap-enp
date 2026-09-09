import BlogShell from "./BlogShell";
import { Vignette } from "./covers";
import { categories, formatDate, posts, slugify, type Post } from "@/lib/blog";

const accentText = { office: "text-ms-blue", digital: "text-ms-pink", service: "text-ms-green" } as const;
const accentBg = { office: "bg-ms-blue", digital: "bg-ms-pink", service: "bg-ms-green" } as const;

/** Article mis à la une : couverture pleine largeur, titre en surimpression. */
const Une = ({ post }: { post: Post }) => {
  const accent = post.accent ?? "office";
  return (
    <a href={`/blog/${post.slug}/`} className="group block mb-16 md:mb-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-black/5 shadow-[0_30px_80px_rgba(0,0,0,0.10)]">
        <Vignette
          image={post.image}
          motif={post.motif ?? "grille"}
          accent={accent}
          titreFantome={post.titre_fantome ?? ""}
          vtName={`couv-${post.slug}`}
          etiquette={post.categorie}
          className="w-full h-[260px] md:h-[400px] block"
        />
        {/* ---------- Voile de papier ----------
            Le titre était blanc sur un voile d'encre. Or les couvertures sont
            CLAIRES par construction — papier, trame de points, lettrage filaire :
            il fallait donc les noircir aux trois quarts pour rendre le texte
            lisible, ce qui revenait à masquer l'illustration qu'on venait de
            dessiner. Et pendant la transition vers l'article, la couverture est
            portée au-dessus du reste par son identité de transition : le voile
            passait dessous et le titre blanc se retrouvait sur fond pâle,
            illisible — c'est le cas de l'article « offre », dont le motif de
            devises est presque uni.

            Encre sur voile de papier : le contraste ne dépend plus de la
            couverture, l'illustration reste visible, et le texte tient dans
            tous les états, transition comprise. */}
        <div className="absolute inset-0 bg-gradient-to-t from-ms-paper via-ms-paper/85 to-ms-paper/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-block w-8 h-[3px] ${accentBg[accent]}`} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${accentText[accent]}`}>
              À la une · {post.categorie}
            </span>
          </div>
          <h2 className="text-xl md:text-3xl lg:text-4xl font-extrabold text-ms-ink tracking-tight leading-[1.1] max-w-3xl mb-3 group-hover:text-ms-blue transition-colors">
            {post.titre}
          </h2>
          <p className="text-[13px] md:text-sm text-ms-ink/60 leading-relaxed max-w-xl hidden md:block">
            {post.chapeau}
          </p>
          <p className="mt-4 text-[11px] font-semibold text-ms-ink/40">
            {post.auteur} · {formatDate(post.publie_le)} · {post.minutes} min
          </p>
        </div>
      </div>
    </a>
  );
};

/** Entrée de sommaire : numéro d'ordre, filet, titre. */
const Entree = ({ post, n }: { post: Post; n: number }) => {
  const accent = post.accent ?? "office";
  return (
    <a
      href={`/blog/${post.slug}/`}
      className="group grid md:grid-cols-[auto_180px_1fr] gap-4 md:gap-8 items-start py-8 border-t border-black/10 hover:bg-black/[0.015] transition-colors"
    >
      <span className="font-titrage font-black text-2xl md:text-3xl text-ms-ink/12 tabular-nums leading-none md:pt-1 tracking-tighter">
        {String(n).padStart(2, "0")}
      </span>

      <div className="hidden md:block overflow-hidden rounded-xl border border-black/5">
        <Vignette
          image={post.image}
          motif={post.motif ?? "grille"}
          accent={accent}
          titreFantome={post.titre_fantome ?? ""}
          vtName={`couv-${post.slug}`}
          etiquette={post.categorie}
          className="w-full h-[110px] block group-hover:scale-[1.03] transition-transform duration-500"
        />
      </div>

      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className={`inline-block w-5 h-[2px] ${accentBg[accent]}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accentText[accent]}`}>
            {post.categorie}
          </span>
          <span className="text-[10px] font-semibold text-ms-ink/30">
            {formatDate(post.publie_le)} · {post.minutes} min
          </span>
        </div>
        <h2 className="text-lg md:text-xl font-extrabold text-ms-ink tracking-tight leading-snug mb-2 group-hover:text-ms-blue transition-colors">
          {post.titre}
        </h2>
        <p className="text-[13px] text-ms-ink/55 leading-relaxed max-w-2xl">{post.chapeau}</p>
      </div>
    </a>
  );
};

const BlogIndexPage = () => {
  const [une, ...suite] = posts;

  return (
    <BlogShell motif={une?.motif ?? "grille"} accent={une?.accent ?? "office"} mot="1990">
      {/* ---------- Bandeau-titre, façon manchette de revue ---------- */}
      <section className="relative overflow-hidden border-b border-black/10">
        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-[3px] bg-ms-blue" />
            <span className="w-10 h-[3px] bg-ms-pink" />
            <span className="w-10 h-[3px] bg-ms-green" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-ms-ink tracking-tight leading-[1.05] max-w-2xl mb-6">
            Le journal
            <br />
            <span className="text-ms-ink/30">de la gestion algérienne</span>
          </h1>
          <p className="text-sm text-ms-ink/60 leading-relaxed max-w-lg">
            Comptabilité, production, logistique et paie — ce que trente-cinq ans passés dans les ateliers et
            les services financiers algériens nous ont appris, et qu'on ne lit nulle part ailleurs.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35">
            <span>Alger · Algérie</span>
            <span>{posts.length} article{posts.length > 1 ? "s" : ""}</span>
            <span>Depuis 1990</span>
            <a href="/blog/rss.xml" className="hover:text-ms-ink transition-colors">
              Flux RSS
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        {posts.length === 0 ? (
          <p className="text-sm text-ms-ink/50">Aucun article publié pour le moment.</p>
        ) : (
          <>
            {une && <Une post={une} />}

            {categories.length > 1 && (
              <nav className="flex flex-wrap gap-2 mb-4" aria-label="Rubriques">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35 self-center mr-2">
                  Rubriques
                </span>
                {categories.map((c) => (
                  <a
                    key={c}
                    href={`/blog/categorie/${slugify(c)}/`}
                    className="px-3 py-1.5 rounded-full border border-black/10 text-xs font-bold text-ms-ink/60 hover:text-ms-ink hover:border-ms-ink/30 transition-colors"
                  >
                    {c}
                  </a>
                ))}
              </nav>
            )}

            {suite.length > 0 && (
              <section aria-label="Tous les articles">
                <h2 className="sr-only">Sommaire</h2>
                <div className="border-b border-black/10">
                  {suite.map((p, i) => (
                    <Entree key={p.slug} post={p} n={i + 2} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </BlogShell>
  );
};

export default BlogIndexPage;
