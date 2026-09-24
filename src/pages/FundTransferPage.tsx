import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, Check, Copy, ExternalLink, Mail } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import {
  BANK, CHECKED_ON, CLIENT_BANK_ACCOUNTS_PDF, FUND_TRANSFER_SOURCE, GATEWAY_CHARGE, PAYMENT_GATEWAY, WITHDRAWAL_EMAIL,
  virtualAccountFor,
} from "@/lib/fund-transfer";

const CRUMBS = [{ name: "Home", url: "/" }, { name: "Fund Transfer" }];

/** Copies one value; says so in words, for screen readers too. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-fast hover:border-secondary/50 hover:text-foreground"
    >
      {state === "copied" ? <Check className="h-3.5 w-3.5 text-secondary" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Select to copy" : "Copy"}</span>
    </button>
  );
}

/** One line of the bank-details list: a label, the value, and a copy action for values people type. */
function Detail({ term, value, copy, mono = false }: { term: string; value: string; copy?: boolean; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-border py-3 first:border-t-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="flex min-w-0 items-start justify-between gap-3">
        <span className={`min-w-0 break-words text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
        {copy && <CopyButton value={value} label={term} />}
      </dd>
    </div>
  );
}

const FundTransferPage = () => {
  const [code, setCode] = useState("");
  const inputId = useId();
  const result = code ? virtualAccountFor(code) : null;

  return (
    <PageTransition>
      <SEOHead
        title="Fund Transfer: Add Money to Your Trading Account | Parasram"
        description="Add funds to your Parasram trading account: NetBanking or UPI online, or NEFT/RTGS/IMPS to HDFC Bank account PRSM99 + your trading code."
        breadcrumbs={CRUMBS}
      />
      <div className="min-h-screen bg-background">
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={CRUMBS} />
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <PageHeader
            eyebrow={<><Banknote className="h-3.5 w-3.5" aria-hidden="true" /> Client services</>}
            title="Add funds to your trading account"
            description="Pay in online by NetBanking or UPI, or by bank transfer from your registered bank account. Withdrawals are requested by email."
          />

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
            <section aria-labelledby="bank-transfer" className="min-w-0">
              <h2 id="bank-transfer" className="text-xl font-bold">Bank transfer: NEFT, RTGS or IMPS</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your trading code is part of your own account number at HDFC Bank: <span className="font-mono text-foreground">{BANK.virtualPrefix}</span> followed by the code.
              </p>

              <div className="mt-5 rounded-lg border border-border bg-card p-4 sm:p-5">
                <label htmlFor={inputId} className="text-sm font-medium">Your trading code</label>
                <input
                  id={inputId}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. CSAMB"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={24}
                  aria-describedby={`${inputId}-result`}
                  aria-invalid={result !== null && !result.ok}
                  className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-base uppercase tracking-wide outline-none transition-colors duration-fast placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/70 focus:border-secondary"
                />
                <div id={`${inputId}-result`} className="mt-3 min-h-[3.25rem]" aria-live="polite">
                  {result === null && (
                    <p className="text-sm text-muted-foreground">It is printed on every contract note you receive.</p>
                  )}
                  {result !== null && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
                  {result?.ok && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Your account number</div>
                        <div className="font-mono text-xl font-medium tracking-wide text-foreground">{result.account}</div>
                      </div>
                      <CopyButton value={result.account} label="your account number" />
                    </div>
                  )}
                </div>
              </div>

              <dl className="mt-6">
                <Detail term="Beneficiary" value={BANK.beneficiary} copy />
                <Detail term="Bank" value={BANK.bank} />
                <Detail term="Account number" value={result?.ok ? result.account : `${BANK.virtualPrefix} + your trading code`} copy={Boolean(result?.ok)} mono />
                <Detail term="Or the current account" value={BANK.pooledAccount} copy mono />
                <Detail term="IFSC" value={BANK.ifsc} copy mono />
                <Detail term="MICR" value={BANK.micr} mono />
                <Detail term="Branch" value={BANK.branch} />
                <Detail term="Bank address" value={BANK.address} />
              </dl>

              <p className="mt-4 rounded-md bg-muted/60 px-4 py-3 text-sm">
                Funds can only be transferred from your bank account registered with Shri Parasram Holdings Pvt. Ltd.
              </p>
            </section>

            <aside className="min-w-0 space-y-8" aria-label="Other ways to pay and withdraw">
              <section aria-labelledby="pay-online">
                <h2 id="pay-online" className="text-xl font-bold">Pay online</h2>
                <p className="mt-1 text-sm text-muted-foreground">NetBanking or UPI through Parasram&rsquo;s payment gateway, for NSE, BSE and MCX. You will need your client code.</p>
                <p className="mt-3 text-sm"><span className="text-muted-foreground">Charge:</span> {GATEWAY_CHARGE}</p>
                <Button asChild className="mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <a href={PAYMENT_GATEWAY} target="_blank" rel="noopener noreferrer">
                    Open the payment gateway <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              </section>

              <section aria-labelledby="withdraw">
                <h2 id="withdraw" className="text-xl font-bold">Withdraw funds</h2>
                <p className="mt-1 text-sm text-muted-foreground">To take money out of your trading account, send the request by email.</p>
                <a href={`mailto:${WITHDRAWAL_EMAIL}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
                  <Mail className="h-4 w-4" aria-hidden /> {WITHDRAWAL_EMAIL}
                </a>
              </section>

              <section aria-labelledby="amc">
                <h2 id="amc" className="text-xl font-bold">Lifetime AMC</h2>
                <p className="mt-1 text-sm text-muted-foreground">The one-time lifetime demat AMC is paid on Parasram&rsquo;s fund-transfer page.</p>
                <a href={FUND_TRANSFER_SOURCE} target="_blank" rel="noopener noreferrer" className="link-arrow mt-3 text-sm font-semibold text-secondary">Pay the lifetime AMC</a>
              </section>

              <section aria-labelledby="source" className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
                <h2 id="source" className="sr-only">Where these details come from</h2>
                <p>
                  Bank details as published by Shri Parasram Holdings at{" "}
                  <a href={FUND_TRANSFER_SOURCE} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">parasramindia.com/fund-transfer</a>, checked {CHECKED_ON}.
                  The firm&rsquo;s{" "}
                  <a href={CLIENT_BANK_ACCOUNTS_PDF} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">list of client bank accounts</a> (PDF) is the official reference.
                </p>
                <p className="mt-2">
                  Forms for KYC, nominee and depository changes are on <Link to="/downloads" className="underline hover:text-foreground">Forms &amp; downloads</Link>. Questions: <Link to="/contact" className="underline hover:text-foreground">contact the Panipat branch</Link>.
                </p>
              </section>
            </aside>
          </div>
        </main>
        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default FundTransferPage;
