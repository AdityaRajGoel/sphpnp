import { useParams, Link, Navigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import { BookOpen, Clock, ChevronRight, ArrowRight, CheckCircle2, GraduationCap, Share2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import { LEARN_ARTICLES } from "@/data/learnContent";

const difficultyColor: Record<string, string> = {
  Beginner: "bg-secondary/10 text-secondary border-secondary/20",
  Intermediate: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  Advanced: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
};

const ArticlePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? LEARN_ARTICLES[slug] : undefined;

  // Unknown slug → send to the Learning Center hub (avoids thin/404 pages)
  if (!article) return <Navigate to="/learn" replace />;

  const related = article.related
    .map((s) => LEARN_ARTICLES[s])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <SEOHead
          title={article.title}
          description={article.metaDescription}
          type="article"
          datePublished={article.updated}
          dateModified={article.updated}
          author="Parasram India"
          canonical={`https://www.sphpnp.com/learn/${article.slug}`}
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Learning Center", url: "/learn" },
            { name: article.title },
          ]}
        />
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs
          items={[
            { name: "Home", url: "/" },
            { name: "Learning Center", url: "/learn" },
            { name: article.title },
          ]}
        />

        <main className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          {/* Article header */}
          <motion.header
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary uppercase tracking-wide">
                <GraduationCap className="w-3.5 h-3.5" /> {article.category}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${difficultyColor[article.difficulty]}`}>
                {article.difficulty}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {article.readTime} min read
              </span>
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground leading-tight">
              {article.title}
            </h1>
          </motion.header>

          {/* Key takeaways box */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 bg-secondary/5 border border-secondary/20 rounded-2xl p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-secondary mb-3">
              <BookOpen className="w-4 h-4" /> Key Takeaways
            </h2>
            <ul className="space-y-2">
              {article.keyTakeaways.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Article body */}
          <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-heading prose-headings:text-foreground prose-h2:text-2xl prose-h2:mt-8 prose-a:text-secondary prose-a:no-underline hover:prose-a:underline prose-table:border prose-table:border-border/50 prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-td:border-t prose-td:border-border/40">
            <Markdown remarkPlugins={[remarkGfm]}>{article.content}</Markdown>
          </article>

          {/* Disclaimer */}
          <div className="mt-8 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl p-4">
            <strong className="text-foreground">Disclaimer:</strong> This article is for educational purposes only and
            is not investment advice. Investments in securities are subject to market risks. Please consult a
            SEBI-registered advisor before investing.
          </div>

          {/* Share */}
          {(() => {
            const articleUrl = `https://www.sphpnp.com/learn/${article.slug}`;
            const shareText = `${article.title} — ${article.metaDescription}`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${articleUrl}`)}`;
            const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(articleUrl)}&via=ParasramPanipat`;
            return (
              <div className="mt-5 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Share2 className="w-3.5 h-3.5" /> Share:
                </span>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-medium transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href={twUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-medium transition-colors"
                >
                  𝕏 / Twitter
                </a>
              </div>
            );
          })()}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 bg-gradient-to-br from-brand-navy to-primary text-white rounded-2xl p-6 md:p-8 text-center"
          >
            <h2 className="font-heading text-xl md:text-2xl font-bold mb-2">Ready to start investing?</h2>
            <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
              Open a free Demat account with Parasram India - SEBI-registered since 1970, with real branch support in Panipat.
            </p>
            <Link
              to="/open-account"
              className="inline-flex items-center gap-2 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-[1.03] transition-transform"
            >
              Open Free Demat Account <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Related articles */}
          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="font-heading text-xl font-bold text-foreground mb-4">Related Guides</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/learn/${r.slug}`}
                    className="group bg-card border border-border/50 rounded-xl p-4 hover:border-secondary/40 hover:shadow-lg transition-[color,background-color,border-color,box-shadow]"
                  >
                    <span className="text-[10px] font-semibold text-secondary uppercase">{r.category}</span>
                    <h3 className="font-heading text-sm font-bold text-foreground mt-1 mb-2 group-hover:text-secondary transition-colors line-clamp-2">
                      {r.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs text-secondary font-medium">
                      Read <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default ArticlePage;
