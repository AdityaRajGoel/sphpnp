import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Calculator } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageHeader from "@/components/PageHeader";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import { CALCULATORS } from "./catalog";

export type RelatedGuide = { slug: string; title: string };

type Props = {
  path: string;
  name: string;
  seoTitle: string;
  description: string;
  intro: ReactNode;
  faqItems?: { question: string; answer: string }[];
  /** Method and limits, printed under the calculator after the advice line. */
  notes?: ReactNode;
  relatedGuides?: RelatedGuide[];
  children: ReactNode;
};

const BASE = "https://www.sphpnp.com";

/**
 * The page around every calculator in the pack: the same shell as
 * /brokerage-calculator (SEOHead, Header, breadcrumbs, PageHeader, Footer),
 * the advice line, one quiet link to the branch and the other calculators.
 */
export default function CalculatorShell({ path, name, seoTitle, description, intro, faqItems, notes, relatedGuides = [], children }: Props) {
  const crumbs = [{ name: "Home", url: "/" }, { name: "Calculators", url: "/calculators" }, { name }];
  const others = CALCULATORS.filter((c) => c.href !== path);
  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col bg-background">
        <SEOHead
          title={seoTitle}
          description={description}
          breadcrumbs={crumbs}
          faqItems={faqItems}
          jsonLd={{
            "@type": "WebApplication",
            name,
            description,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web Browser",
            url: `${BASE}${path}`,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            provider: { "@type": "Organization", name: "Shri Parasram Holdings Panipat", url: BASE },
          }}
        />
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={crumbs} />
        <main className="container mx-auto max-w-5xl flex-1 px-4 pb-12 md:pb-16">
          <PageHeader className="mb-6" eyebrow={<><Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Calculator</>} title={name} description={intro} />

          {children}

          <aside aria-label="About these figures" className="mt-10 space-y-2 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <p><strong className="font-semibold text-foreground">Illustration only, not investment advice.</strong> {notes}</p>
            <p>
              Questions about your own numbers?{" "}
              <Link to="/contact" className="font-medium text-secondary underline-offset-2 hover:underline">Talk to the branch</Link>.
            </p>
          </aside>

          {relatedGuides.length > 0 && (
            <section aria-labelledby="related-guides" className="mt-8">
              <h2 id="related-guides" className="text-base font-semibold text-foreground">Related guides</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {relatedGuides.map((g) => (
                  <li key={g.slug}>
                    <Link to={`/learn/${g.slug}`} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground transition-colors hover:border-secondary">
                      <BookOpen className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav aria-labelledby="more-calculators" className="mt-8">
            <h2 id="more-calculators" className="text-base font-semibold text-foreground">More calculators</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((c) => (
                <li key={c.href}>
                  <Link to={c.href} className="inline-flex items-center rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-secondary hover:text-secondary">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/calculators" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-secondary hover:underline">
                  All calculators <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </nav>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
}
