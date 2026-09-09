import BlogShell from "./BlogShell";
import { Vignette } from "./covers";
import { ID_DECK, documentDepuisArticle, serialiser } from "./deck/depuisArticle";
import { formatDate, related, slugify, type Post } from "@/lib/blog";

const accentText = { office: "text-ms-blue", digital: "text-ms-pink", service: "text-ms-green" } as const;
const accentBg = { office: "bg-ms-blue", digital: "bg-ms-pink", service: "bg-ms-green" } as const;
const accentBorder = { office: "border-ms-blue", digital: "border-ms-pink", service: "border-ms-green" } as const;

const BlogPostPage = ({ post }: { post: Post }) => {
  const voisins = related(post);
  const accent = post.accent ?? "office";

  /**
   * Projection de l'article en présentation. Calculée ici, au build, à partir
   * du seul Markdown : rien n'est stocké, rien n'est à saisir. Le résultat est
   * déposé dans la page sous forme de JSON lisible, que l'îlot client reprend
   * tel quel — l'analyseur Markdown et le texte des autres articles restent
   * hors du script envoyé au navigateur.
   */
  const deck = documentDepuisArticle({ ...post, accent });

  return (
    <BlogShell motif={post.motif ?? "grille"} accent={accent} mot={post.titre_fantome ?? ""}>
      {/* ---------- Manchette ---------- */}
      <header className="relative border-b border-black/10 overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-4 pt-10 pb-12 md:pt-14 md:pb-16">
          <nav aria-label="Fil d'Ariane" className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35 mb-8">
            <a href="/" className="hover:text-ms-ink transition-colors">Accueil</a>
            <span className="mx-2">/</span>
            <a href="/blog/" className="hover:text-ms-ink transition-colors">Journal</a>
            <span className="mx-2">/</span>
            <a href={`/blog/categorie/${slugify(post.categorie)}/`} className={`${accentText[accent]} hover:opacity-70 transition-opacity`}>
              {post.categorie}
            </a>
          </nav>

          {post.maquette && (
            <p className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300/60 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">
              Maquette — contenu de présentation
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
            <span className={`inline-block w-10 h-[3px] ${accentBg[accent]}`} />
            {/* Le format est annoncé : le lecteur sait en une seconde s'il a
                affaire à une réponse courte ou à une analyse de fond. */}
            <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${accentText[accent]}`}>
              {post.spec.nom}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/30">
              {post.categorie}
            </span>
            {post.version && (
              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold text-white ${accentBg[accent]}`}>
                Version {post.version}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-4xl lg:text-[2.75rem] font-extrabold text-ms-ink tracking-tight leading-[1.08] mb-6">
            {post.titre}
          </h1>

          <p className="text-base md:text-lg text-ms-ink/55 leading-relaxed font-medium max-w-2xl">
            {post.chapeau}
          </p>

          <div className="mt-8 pt-5 border-t border-black/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ms-ink/40">
            <span className="text-ms-ink/65">{post.auteur}</span>
            <span>·</span>
            <time dateTime={post.publie_le}>{formatDate(post.publie_le)}</time>
            <span>·</span>
            <span>{post.minutes} min de lecture</span>
            {post.maj_le && post.maj_le !== post.publie_le && (
              <>
                <span>·</span>
                <span className="text-ms-ink/30 normal-case tracking-normal font-semibold">
                  mis à jour le {formatDate(post.maj_le)}
                </span>
              </>
            )}
          </div>

          {/* ---------- Mode diaporama ----------
              Le deck voyage avec la page, en JSON lisible. Ce n'est pas du
              contenu : `type="application/json"` n'est ni exécuté ni rendu, et
              les moteurs l'ignorent. L'article indexé reste exactement celui
              qu'il était avant l'ajout du mode diapo.

              Le bouton, lui, est monté par `entry-blog-client.tsx`. La hauteur
              est réservée ici pour que son apparition ne déplace pas le texte
              sous les yeux du lecteur. */}
          <script
            id={ID_DECK}
            type="application/json"
            dangerouslySetInnerHTML={{ __html: serialiser(deck) }}
          />
          <div id="ms-diapo-lanceur" className="mt-6 min-h-[38px]" />
        </div>
      </header>

      {/* ---------- Couverture ---------- */}
      <div className="mx-auto max-w-5xl px-4 -mt-px">
        <Vignette
          image={post.image}
          motif={post.motif ?? "grille"}
          accent={accent}
          titreFantome={post.titre_fantome ?? ""}
          vtName={`couv-${post.slug}`}
          etiquette={post.categorie}
          className="w-full h-[200px] md:h-[340px] block border-x border-b border-black/10 rounded-b-[2rem]"
        />
      </div>

      {/* ---------- Corps, avec sommaire en marge ---------- */}
      <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <div className="grid lg:grid-cols-[200px_1fr] gap-10 lg:gap-16">
          {/* Sommaire collant — `position: sticky` fonctionne sans JavaScript.
              Affiché seulement si le format le prévoit : sur une info rapide,
              un sommaire de deux lignes est du bruit. */}
          {post.spec.sommaire && post.sommaire.length >= 2 ? (
            <>
              {/* Deux formes du même sommaire.
                  En marge, il ne coûte rien : il occupe une colonne que le
                  texte n'utilise pas. Sur téléphone, il n'y a pas de marge — il
                  s'intercalait alors entre le chapeau et la première phrase,
                  repoussant l'article d'un écran entier avant qu'on ait lu une
                  ligne. Il s'y replie donc, et reste ouvrable d'une touche.
                  `<details>` est du HTML : les pages du blog sont pré-générées
                  et fonctionnent sans JavaScript. */}
              <details className="lg:hidden rounded-2xl border border-black/10 bg-white/60 px-5 py-4">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/45">
                  Au sommaire · {post.sommaire.length} sections
                </summary>
                <ol className="mt-4 space-y-3 border-t border-black/10 pt-4">
                  {post.sommaire.map((s, i) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="flex gap-2.5 text-[13px] leading-snug text-ms-ink/65">
                        <span className="text-ms-ink/25 font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <span>{s.texte}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </details>

              <nav aria-label="Sommaire" className="hidden lg:block lg:sticky lg:top-8 lg:self-start">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/35 mb-4 pb-3 border-b border-black/10">
                  Au sommaire
                </p>
                <ol className="space-y-3">
                  {post.sommaire.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="group flex gap-2.5 text-[12px] leading-snug text-ms-ink/55 hover:text-ms-ink transition-colors"
                      >
                        <span className="text-ms-ink/25 font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <span className="group-hover:underline underline-offset-2">{s.texte}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </>
          ) : (
            <div aria-hidden="true" />
          )}

          <article className="min-w-0">
            {/* Réponse en une phrase, avant tout le reste.
                C'est le levier GEO le plus direct : les moteurs génératifs
                extraient volontiers un passage court, explicite et placé haut
                dans la page pour le citer tel quel. */}
            {post.spec.reponseRapide && post.reponse && (
              <aside
                className={`mb-10 rounded-2xl border-l-[3px] ${accentBorder[accent]} bg-white/70 border-y border-r border-black/5 p-6`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-ms-ink/40 mb-3">
                  En bref
                </p>
                <p className="text-[15px] md:text-base font-bold text-ms-ink leading-relaxed">
                  {post.reponse}
                </p>
              </aside>
            )}

            {/* Lettrine sur le premier paragraphe : marqueur éditorial fort,
                obtenu en CSS pur via first-letter, sans toucher au Markdown. */}
            <div
              className="prose prose-slate max-w-none
                prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-ms-ink
                prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-5 prose-h2:scroll-mt-8
                prose-h3:text-lg prose-h3:mt-10
                prose-p:text-[15px] prose-p:text-ms-ink/75 prose-p:leading-[1.75]
                prose-li:text-[15px] prose-li:text-ms-ink/75 prose-li:leading-[1.7]
                prose-a:text-ms-blue prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                prose-strong:text-ms-ink prose-strong:font-bold
                prose-blockquote:border-l-[3px] prose-blockquote:border-ms-blue prose-blockquote:bg-ms-paper/60
                prose-blockquote:py-1 prose-blockquote:px-5 prose-blockquote:rounded-r-lg
                prose-blockquote:text-ms-ink/70 prose-blockquote:not-italic prose-blockquote:font-medium
                prose-code:text-ms-blue prose-code:bg-ms-paper prose-code:px-1.5 prose-code:py-0.5
                prose-code:rounded prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none
                prose-table:text-[13px] prose-th:text-ms-ink prose-th:font-bold prose-td:text-ms-ink/70
                prose-hr:border-black/10
                first-letter:float-left first-letter:mr-3 first-letter:mt-1
                [&>p:first-of-type]:first-letter:text-[3.5rem] [&>p:first-of-type]:first-letter:font-black
                [&>p:first-of-type]:first-letter:leading-[0.85] [&>p:first-of-type]:first-letter:text-ms-ink"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />

            {/* Exergue : phrase saillante détachée, typique d'un magazine. */}
            {post.exergue && (
              <figure className={`my-14 border-l-[3px] ${accentBorder[accent]} pl-6 md:pl-8`}>
                <blockquote className="text-lg md:text-2xl font-extrabold text-ms-ink tracking-tight leading-snug">
                  {post.exergue}
                </blockquote>
              </figure>
            )}

            {post.faq && post.faq.length > 0 && (
              <section className="mt-16 pt-10 border-t-2 border-ms-ink/10">
                <div className="flex items-center gap-3 mb-7">
                  <span className={`inline-block w-8 h-[3px] ${accentBg[accent]}`} />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ms-ink/45">
                    Questions fréquentes
                  </h2>
                </div>
                <dl className="divide-y divide-black/10 border-y border-black/10">
                  {post.faq.map((f) => (
                    <div key={f.q} className="py-5">
                      <dt className="font-bold text-ms-ink text-[15px] mb-2">{f.q}</dt>
                      <dd className="text-[14px] text-ms-ink/65 leading-relaxed">{f.r}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {post.etiquettes.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ms-ink/30 mr-1">
                  Sujets
                </span>
                {post.etiquettes.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-md bg-ms-paper border border-black/5 text-[11px] font-semibold text-ms-ink/55"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Appel à l'action, dans le langage sombre du site */}
            <aside className="relative mt-16 rounded-[2rem] bg-ms-dark text-white p-8 md:p-12 overflow-hidden">
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-ms-blue/25 blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-7 h-[3px] bg-ms-blue" />
                  <span className="w-7 h-[3px] bg-ms-pink" />
                  <span className="w-7 h-[3px] bg-ms-green" />
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-3 max-w-md">
                  Un besoin de gestion à cadrer ?
                </h2>
                <p className="text-[13px] text-white/55 leading-relaxed max-w-md mb-7">
                  Chaque projet démarre par un audit de vos process réels, pas par un catalogue de
                  fonctionnalités.
                </p>
                <a
                  href="/#contact"
                  className="inline-flex items-center px-6 py-3 rounded-full bg-white text-ms-ink font-bold text-sm hover:bg-white/90 transition-colors"
                >
                  Demander une démo
                </a>
              </div>
            </aside>
          </article>
        </div>

        {voisins.length > 0 && (
          <section className="mt-20 pt-10 border-t border-black/10">
            <div className="flex items-center gap-3 mb-7">
              <span className="inline-block w-8 h-[3px] bg-ms-ink/20" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ms-ink/45">
                Dans la même veine
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {voisins.map((p) => {
                const a = p.accent ?? "office";
                return (
                  <a key={p.slug} href={`/blog/${p.slug}/`} className="group block">
                    <div className="overflow-hidden rounded-xl border border-black/5 mb-3">
                      <Vignette
                        image={post.image}
                        motif={p.motif ?? "grille"}
                        accent={a}
                        titreFantome={p.titre_fantome ?? ""}
                        vtName={`couv-${p.slug}`}
                        etiquette={p.categorie}
                        className="w-full h-[100px] block group-hover:scale-[1.04] transition-transform duration-500"
                      />
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 ${accentText[a]}`}>
                      {p.categorie}
                    </p>
                    <h3 className="text-sm font-bold text-ms-ink leading-snug group-hover:text-ms-blue transition-colors">
                      {p.titre}
                    </h3>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </BlogShell>
  );
};

export default BlogPostPage;
