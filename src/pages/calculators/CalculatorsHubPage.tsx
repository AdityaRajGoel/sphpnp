import { Link } from "react-router-dom";
import { ArrowRight, Calculator } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PageHeader from "@/components/PageHeader";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import { CALCULATORS, type CalculatorEntry } from "@/components/calculators/catalog";

const GROUPS: { key: CalculatorEntry["group"]; title: string; blurb: string }[] = [
  { key: "Investing", title: "Investing", blurb: "SIPs, lump sums and withdrawals, at a return you assume." },
  { key: "Returns", title: "Measuring returns", blurb: "What an investment actually earned." },
  { key: "Trading", title: "Trading", blurb: "Averages, option values, charges and margin." },
  { key: "Tax", title: "Tax", blurb: "FY 2026-27 estimates from the Income-tax Act, 2025." },
];

const crumbs = [{ name: "Home", url: "/" }, { name: "Calculators" }];

export default function CalculatorsHubPage() {
  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col bg-background">
        <SEOHead
          title="Investment, Trading & Tax Calculators"
          description="Free calculators for SIP, step-up SIP, lumpsum, SWP, CAGR, XIRR, stock average, option value, brokerage, margin, capital gains tax and income tax."
          breadcrumbs={crumbs}
        />
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={crumbs} />
        <main className="container mx-auto max-w-5xl flex-1 px-4 pb-12 md:pb-16">
          <PageHeader
            className="mb-6"
            eyebrow={<><Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Tools</>}
            title="Calculators"
            description="Work out returns, costs and tax before you decide."
          />
          <div className="space-y-10">
            {GROUPS.map((g) => (
              <section key={g.key} aria-labelledby={`calc-${g.key}`}>
                <div className="mb-3 border-b pb-2">
                  <h2 id={`calc-${g.key}`} className="text-xl font-bold tracking-tight text-foreground">{g.title}</h2>
                  <p className="text-sm text-muted-foreground">{g.blurb}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {CALCULATORS.filter((c) => c.group === g.key).map((c) => (
                    <li key={c.href}>
                      <Link to={c.href} className="group flex h-full items-start gap-3 rounded-surface border bg-card p-4 shadow-sm transition-colors hover:border-secondary">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary/10 text-secondary">
                          <c.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-foreground">{c.name}</span>
                          <span className="block text-sm text-muted-foreground">{c.blurb}</span>
                        </span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-secondary" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-10 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Illustration only, not investment advice.</strong> Returns in these calculators are assumptions you enter, not guarantees, and tax figures are estimates.
            {" "}Questions about your own numbers? <Link to="/contact" className="font-medium text-secondary underline-offset-2 hover:underline">Talk to the branch</Link>.
          </p>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
}
