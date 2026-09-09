import BlogShell from "./BlogShell";
import { Vignette } from "./covers";
import { formatDate, postsByCategory, type Post } from "@/lib/blog";

const accentBg = { office: "bg-ms-blue", digital: "bg-ms-pink", service: "bg-ms-green" } as const;

/**
 * Page de rubrique : /blog/categorie/[nom]
 *
 * Page à part entière, générée en HTML, qui donne à chaque thème une adresse
 * indexable. C'est elle qui se positionne sur les recherches thématiques
 * larges, là où un article isolé ne le ferait pas.
 */
const BlogCategoryPage = ({ categorie }: { categorie: string }) => {
  const liste: Post[] = postsByCategory(categorie);
  const accent = liste[0]?.accent ?? "office";

  return (
    <BlogShell motif={liste[0]?.motif ?? "grille"} accent={accent} mot={liste[0]?.titre_fantome ?? ""}>
      <section className="relative border-b border-black/10 overflow-hidden">
        <div className="relative mx-auto max-w-5xl px-4 py-14 md:py-20">
          <nav aria-label="Fil d'Ariane" className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35 mb-7">
            <a href="/" className="hover:text-ms-ink transition-colors">Accueil</a>
            <span className="mx-2">/</span>
            <a href="/blog/" className="hover:text-ms-ink transition-colors">Journal</a>
          </nav>
          <div className="flex items-center gap-3 mb-5">
            <span className={`inline-block w-10 h-[3px] ${accentBg[accent]}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-ms-ink/40">Rubrique</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-ms-ink tracking-tight mb-3">{categorie}</h1>
          <p className="text-sm text-ms-ink/45 font-semibold">
            {liste.length} article{liste.length > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="border-b border-black/10">
          {liste.map((post, i) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}/`}
              className="group grid md:grid-cols-[auto_180px_1fr] gap-4 md:gap-8 items-start py-8 border-t border-black/10 hover:bg-black/[0.015] transition-colors"
            >
              <span className="font-titrage font-black text-2xl md:text-3xl text-ms-ink/12 tabular-nums leading-none md:pt-1 tracking-tighter">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="hidden md:block overflow-hidden rounded-xl border border-black/5">
                <Vignette
                  image={post.image}
                  motif={post.motif ?? "grille"}
                  accent={post.accent ?? "office"}
                  titreFantome={post.titre_fantome ?? ""}
                  vtName={`couv-${post.slug}`}
                  etiquette={post.categorie}
                  className="w-full h-[110px] block group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35 mb-2">
                  {formatDate(post.publie_le)} · {post.minutes} min
                </p>
                <h2 className="text-lg md:text-xl font-extrabold text-ms-ink tracking-tight leading-snug mb-2 group-hover:text-ms-blue transition-colors">
                  {post.titre}
                </h2>
                <p className="text-[13px] text-ms-ink/55 leading-relaxed max-w-2xl">{post.chapeau}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </BlogShell>
  );
};

export default BlogCategoryPage;
