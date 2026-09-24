/**
 * What an empty tab on the home page's market overview says. An empty list is
 * not an outage: on a day when every tracked stock fell, "Top gainers" is
 * honestly empty - it used to say the feed was unavailable while the losers
 * tab beside it was full.
 */
export function emptyTabMessage(tab: string, feedLoaded: boolean, tracked: number): string {
  if (tab === "calendar") return "No upcoming corporate actions listed right now - check back soon.";
  if (!feedLoaded) return "Live market data is temporarily unavailable. Figures are not shown rather than estimated.";
  const subject = tracked > 0 ? `None of the ${tracked} tracked stocks` : "No tracked stock";
  if (tab === "gainers") return `${subject} is up today.`;
  if (tab === "losers") return `${subject} is down today.`;
  if (tab === "active") return "No trading activity reported yet today.";
  return "Nothing to show here right now.";
}
