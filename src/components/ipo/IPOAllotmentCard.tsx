import { CheckCircle2, Circle, ClipboardCheck, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, type Ipo } from "@/lib/ipo";
import { allotmentChecks, allotmentSteps } from "@/lib/ipo-allotment";
import { istToday } from "@/lib/market-data";

const CheckButton = ({ href, label, primary }: { href: string; label: string; primary?: boolean }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 text-sm font-medium transition-colors md:min-h-10 ${
      primary ? "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-card hover:border-secondary/50 hover:text-secondary"
    }`}
  >
    {label}
    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
  </a>
);

/** Where and when to check an allotment: the issue's dates, its registrar's page and both exchanges. */
export default function IPOAllotmentCard({ ipo }: { ipo: Ipo }) {
  const { registrar, exchanges } = allotmentChecks(ipo);
  const steps = allotmentSteps(ipo, istToday());
  const beforeAllotment = ipo.status === "upcoming" || ipo.status === "open";

  return (
    <Card className="min-w-0">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-secondary" aria-hidden="true" />
          <h2 className="font-heading text-lg font-bold">Allotment status</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {beforeAllotment && ipo.allotment_date
            ? `Allotment is due on ${formatDate(ipo.allotment_date)}. Check it on the registrar's page or either exchange with your PAN or application number.`
            : "Check it on the registrar's page or either exchange with your PAN or application number."}
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {steps.length > 0 && (
            <ol className="space-y-2.5 text-sm" aria-label="Allotment timeline">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-2.5">
                  {step.done
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                  <span className="ml-auto tabular-nums font-medium">{formatDate(step.date)}</span>
                  <span className="sr-only">{step.done ? "(done)" : "(upcoming)"}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-col gap-2">
            {registrar?.url && <CheckButton primary href={registrar.url} label={`Check on ${registrar.name}`} />}
            {registrar && !registrar.url && <p className="text-sm text-muted-foreground">Registrar: {registrar.name}</p>}
            {exchanges.map((e) => <CheckButton key={e.label} href={e.url} label={`Check on ${e.label}`} />)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
