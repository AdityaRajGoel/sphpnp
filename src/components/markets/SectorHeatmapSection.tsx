import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScreenerStocks } from "@/hooks/useScreenerStocks";
import { heatStep, sectorTiles, type SectorTile } from "@/lib/sector-heatmap";
import { EmptyState, SectionHeading, divergingFill, tooltipStyle } from "./chart-kit";

const fill = (changePct: number) => divergingFill(heatStep(changePct));
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const lakhCrore = (rupeesCr: number) => `₹${(rupeesCr / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh Cr`;

type TileProps = Partial<SectorTile> & { x?: number; y?: number; width?: number; height?: number; depth?: number };

function Tile({ x = 0, y = 0, width = 0, height = 0, depth, name, changePct = 0 }: TileProps) {
  if (depth !== 1) return null;
  const roomy = width > 64 && height > 34;
  return (
    <g style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={width} height={height} style={{ fill: fill(changePct), stroke: "hsl(var(--card))", strokeWidth: 2 }} rx={4} />
      {roomy && (
        <>
          <text x={x + 8} y={y + 18} style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }}>
            {name && name.length * 7 > width - 12 ? `${name.slice(0, Math.max(3, Math.floor((width - 16) / 7)))}…` : name}
          </text>
          <text x={x + 8} y={y + 34} style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{pct(changePct)}</text>
        </>
      )}
    </g>
  );
}

function TileTooltip({ active, payload }: { active?: boolean; payload?: { payload: SectorTile }[] }) {
  const tile = payload?.[0]?.payload;
  if (!active || !tile?.name) return null;
  return (
    <div style={tooltipStyle.contentStyle} className="px-3 py-2">
      <div className="font-semibold">{tile.name}</div>
      <div className="tabular-nums">{pct(tile.changePct)} today</div>
      <div className="text-muted-foreground">{tile.count} stocks · {lakhCrore(tile.cap)}</div>
    </div>
  );
}

/** Sector heatmap for Market Pulse: area is market value, colour is the day's value-weighted change. */
export default function SectorHeatmapSection() {
  const navigate = useNavigate();
  const { stocks, loading } = useScreenerStocks();
  const tiles = useMemo(() => sectorTiles(stocks), [stocks]);

  return (
    <section aria-labelledby="sector-heatmap" className="scroll-mt-24">
      <SectionHeading
        id="sector-heatmap"
        title="Sectors today"
        subtitle="Each tile is a sector of the tracked stocks: its size is market value, its colour the day's change weighted by market value."
      />
      <Card className="mt-4 p-3 sm:p-4">
        {loading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : tiles.length === 0 ? (
          <EmptyState text="Sector data is not available right now." />
        ) : (
          <>
            <div className="h-[320px] md:h-[380px]" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={tiles}
                  dataKey="cap"
                  nameKey="name"
                  isAnimationActive={false}
                  content={<Tile />}
                  onClick={(node) => {
                    // Recharts passes the datum's own fields on the node.
                    const { slug } = node as unknown as Partial<SectorTile>;
                    if (slug) navigate(`/sectors/${slug}`);
                  }}
                >
                  <Tooltip content={<TileTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>Change today:</span>
              {[-2.5, -1.5, -0.5, 0, 0.5, 1.5, 2.5].map((v) => (
                <span key={v} className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-5 rounded-sm border border-border" style={{ background: fill(v) }} aria-hidden="true" />
                  {v === 0 ? "±0.25%" : v < 0 ? (v === -2.5 ? "−2% or more" : v === -1.5 ? "−1 to −2%" : "−0.25 to −1%") : v === 2.5 ? "+2% or more" : v === 1.5 ? "+1 to +2%" : "+0.25 to +1%"}
                </span>
              ))}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as a table</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Sectors by market value, with the day's change</caption>
                  <thead className="text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-1.5 pr-3 text-left font-medium">Sector</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">Change</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">Stocks</th>
                      <th scope="col" className="py-1.5 pl-3 text-right font-medium">Market value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiles.map((t) => (
                      <tr key={t.name} className="border-t">
                        <td className="py-1.5 pr-3"><Link to={`/sectors/${t.slug}`} className="hover:text-secondary hover:underline">{t.name}</Link></td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{pct(t.changePct)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{t.count}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">{lakhCrore(t.cap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>
    </section>
  );
}
