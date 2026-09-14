import { useEffect, useState } from "react";

type Props = {
  /** ISO timestamp of the data shown. */
  updatedAt: string | null | undefined;
  /** Past this many minutes the dot stops pulsing and reads as stale. */
  staleAfterMinutes?: number;
  label?: string;
  className?: string;
};

const ago = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/**
 * A pulsing "live" dot with a relative age that keeps ticking, so a reader can
 * see a board is current - and see honestly when it is not: stale data gets a
 * still, grey dot instead of a pulse.
 */
export default function LiveIndicator({ updatedAt, staleAfterMinutes = 30, label = "Updated", className = "" }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!updatedAt) return null;
  const age = now - Date.parse(updatedAt);
  const fresh = Number.isFinite(age) && age < staleAfterMinutes * 60_000;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`} title={new Date(updatedAt).toLocaleString("en-IN")}>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {fresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60 duration-ambient" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${fresh ? "bg-secondary" : "bg-muted-foreground/50"}`} />
      </span>
      {fresh ? "Live" : label} · {ago(age)}
    </span>
  );
}
