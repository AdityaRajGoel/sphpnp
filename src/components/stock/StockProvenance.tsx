import type { FilingMeta } from "@/hooks/useStockFundamentals";

export default function StockProvenance({ filing }: { filing: FilingMeta | null }) {
  if (!filing) return null;
  const filed = filing.filing_date ? new Date(filing.filing_date) : null;
  const filedText =
    filed && !Number.isNaN(filed.getTime())
      ? filed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <p className="text-xs text-muted-foreground border-t pt-4">
      Sourced from the company's NSE XBRL filing
      {filedText ? ` dated ${filedText}` : ""}
      {filing.is_audited ? " (audited)" : " (unaudited)"}.
      {filing.xbrl_url && (
        <>
          {" "}
          <a
            href={filing.xbrl_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            View the source filing
          </a>
          .
        </>
      )}{" "}
      Figures are as filed and are not investment advice.
    </p>
  );
}
