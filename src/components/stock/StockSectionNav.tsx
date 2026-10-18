import { useEffect, useState, type RefObject } from "react";

type Section = { id: string; label: string };

/**
 * A sticky jump bar for the stock page, built from the page's own section
 * headings (every section h2 carries an id). The page runs to ~30 sections and
 * 20,000px on a large cap; without this, reaching shareholding or filings meant
 * scrolling past everything above them.
 *
 * Sections load in at different times (news, F&O, analytics), so the list is
 * rebuilt whenever the content changes rather than read once.
 */
export default function StockSectionNav({ root }: { root: RefObject<HTMLElement | null> }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [top, setTop] = useState(0);

  // Sit directly under the sticky site header, whatever height it has at this breakpoint.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header[role=banner]");
    if (!header) return;
    const observer = new ResizeObserver(() => setTop(header.offsetHeight));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      const next = [...el.querySelectorAll<HTMLHeadingElement>("h2[id]")]
        .map((h) => ({ id: h.id, label: (h.textContent ?? "").trim() }))
        .filter((s) => s.label);
      setSections((prev) => (prev.length === next.length && prev.every((s, i) => s.id === next[i].id && s.label === next[i].label) ? prev : next));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); };
    read();
    const mutations = new MutationObserver(schedule);
    mutations.observe(el, { childList: true, subtree: true });
    return () => { mutations.disconnect(); cancelAnimationFrame(frame); };
  }, [root]);

  // Highlight the section whose heading most recently crossed below the bar.
  useEffect(() => {
    if (sections.length === 0) return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = sections.find((s) => visible.get(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: `-${top + 56}px 0px -55% 0px` },
    );
    for (const s of sections) {
      const h = document.getElementById(s.id);
      if (h) observer.observe(h);
    }
    return () => observer.disconnect();
  }, [sections, top]);

  // Keep the active link in view inside the scrolling bar.
  useEffect(() => {
    if (active) document.getElementById(`nav-${active}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (sections.length < 3) return null;

  return (
    <nav
      aria-label="Sections on this page"
      style={{ top }}
      className="sticky z-30 -mx-4 border-b border-border bg-background px-4"
    >
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              id={`nav-${s.id}`}
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              onClick={(e) => {
                e.preventDefault();
                const h = document.getElementById(s.id);
                if (!h) return;
                const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - top - 64, behavior: smooth ? "smooth" : "auto" });
                history.replaceState(null, "", `#${s.id}`);
              }}
              className={`inline-flex min-h-8 items-center whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
                active === s.id ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
