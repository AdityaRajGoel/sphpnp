import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, FolderDown, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import {
  DOWNLOAD_SECTIONS, DOWNLOADS_CHECKED_ON, DOWNLOADS_SOURCE, LANGUAGE_PACKS, filterDownloads,
  type DownloadItem,
} from "@/data/downloads";

const CRUMBS = [{ name: "Home", url: "/" }, { name: "Forms & Downloads" }];

function ItemRow({ item }: { item: DownloadItem }) {
  const isPage = item.kind === "Page" || item.kind === "App";
  return (
    <li className="border-t border-border first:border-t-0">
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[1fr_7.5rem_3.5rem_1.25rem]"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-secondary">
          {item.title}
          {item.note && <span className="ml-1.5 font-normal text-muted-foreground">({item.note})</span>}
        </span>
        <span className="col-start-1 row-start-2 text-xs text-muted-foreground sm:col-start-auto sm:row-start-auto sm:text-sm">{item.date}</span>
        <span className="hidden text-xs font-medium text-muted-foreground sm:block">{item.kind}</span>
        {isPage
          ? <ExternalLink className="row-span-2 h-4 w-4 text-muted-foreground group-hover:text-secondary sm:row-span-1" aria-hidden />
          : <Download className="row-span-2 h-4 w-4 text-muted-foreground group-hover:text-secondary sm:row-span-1" aria-hidden />}
      </a>
    </li>
  );
}

const DownloadsPage = () => {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const sections = useMemo(() => filterDownloads(DOWNLOAD_SECTIONS, query), [query]);
  const total = DOWNLOAD_SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const shown = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <PageTransition>
      <SEOHead
        title="Forms & Downloads: KYC, Demat and Account Forms | Parasram"
        description="Account opening, KYC, DDPI, nomination, transmission and closure forms for Parasram clients, plus 54EC bond forms, trading software and policies."
        breadcrumbs={CRUMBS}
      />
      <div className="min-h-screen bg-background">
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={CRUMBS} />
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <PageHeader
            eyebrow={<><FolderDown className="h-3.5 w-3.5" aria-hidden="true" /> Client services</>}
            title="Forms and downloads"
            description={`Account, KYC and demat forms, bond forms, trading software and policies, as Shri Parasram Holdings publishes them. ${total} files; each link opens the firm's current copy.`}
          />

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Sections" className="flex flex-wrap gap-2">
              {DOWNLOAD_SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-fast hover:border-secondary/50 hover:text-foreground">
                  {s.title}
                </a>
              ))}
              <a href="#languages" className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-fast hover:border-secondary/50 hover:text-foreground">Other languages</a>
            </nav>
            <div className="relative md:w-80">
              <label htmlFor={searchId} className="sr-only">Find a form</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a form, e.g. nominee"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors duration-fast placeholder:text-muted-foreground/70 focus:border-secondary"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {query.trim() ? `${shown} of ${total} files match "${query.trim()}".` : ""}
          </p>

          <div className="mt-6 space-y-10">
            {sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
                <h2 id={`${s.id}-h`} className="text-xl font-bold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.intro}
                  {s.id === "software" && <> <Link to="/apps" className="font-medium text-secondary hover:underline">Go to Apps</Link>.</>}
                </p>
                <div className="mt-3 hidden grid-cols-[1fr_7.5rem_3.5rem_1.25rem] gap-x-4 border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid" aria-hidden>
                  <span>Document</span><span>Published</span><span>Type</span><span />
                </div>
                <ul>{s.items.map((i) => <ItemRow key={i.href} item={i} />)}</ul>
              </section>
            ))}
            {sections.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No form matches &ldquo;{query.trim()}&rdquo;. Try a shorter word, or <Link to="/contact" className="text-secondary hover:underline">ask the branch</Link>.
              </p>
            )}

            {!query.trim() && (
              <section id="languages" aria-labelledby="languages-h" className="scroll-mt-28">
                <h2 id="languages-h" className="text-xl font-bold">Client documents in other languages</h2>
                <p className="mt-1 text-sm text-muted-foreground">Rights and obligations, risk disclosure, do&rsquo;s and don&rsquo;ts and registration documents, as ZIP files (2017).</p>
                <dl className="mt-3">
                  {LANGUAGE_PACKS.map((g) => (
                    <div key={g.segment} className="grid grid-cols-1 gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[8rem_1fr]">
                      <dt className="text-sm text-muted-foreground">{g.segment}</dt>
                      <dd className="flex flex-wrap gap-x-4 gap-y-2">
                        {g.packs.map((p) => (
                          <a key={p.href} href={p.href} className="text-sm font-medium text-foreground hover:text-secondary hover:underline">{p.language}</a>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>

          <p className="mt-12 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
            Files are hosted by Shri Parasram Holdings on{" "}
            <a href={DOWNLOADS_SOURCE} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">parasramindia.com</a>; every link was checked on {DOWNLOADS_CHECKED_ON}.
            Investor charters and grievance data are on <Link to="/investor-corner" className="underline hover:text-foreground">Investor Corner</Link>; bank details for paying in are on <Link to="/fund-transfer" className="underline hover:text-foreground">Fund Transfer</Link>.
            For help with a form, <Link to="/contact" className="underline hover:text-foreground">contact the Panipat branch</Link>.
          </p>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default DownloadsPage;
