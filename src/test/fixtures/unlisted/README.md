# Unlisted dealer-page fixtures

Real dealer pages, committed deliberately. These parsers read other companies'
markup, which changes without warning and takes the parser to **zero rows**
rather than to wrong rows — a failure that is invisible in the repository and
only shows up when a scheduled run goes red.

That is not hypothetical: the scheduled run of 2026-08-12 reported

```json
{"upserted":23,"failures":["Stockify: parsed 0 quotes (markup likely changed)"]}
```

Stockify had moved from a server-rendered price table to a Next.js app. The old
parser matched `"<company> Unlisted Shares ₹1,234.56"` as *adjacent text*; in the
current markup a sector line, a category pill and a "Price" label all sit
between the name and the figure, so adjacency is simply no longer true and no
repair to that regex was possible. Both dealers now ship their lists as escaped
JSON in the Next.js RSC flight payload, which is what the parser reads.

## `stockify-price-list.html`

**Trimmed, not whole.** The live page is 762 KB, almost all of it markup the
parser never looks at. The fixture keeps only the two
`<script>self.__next_f.push(...)</script>` chunks that carry the price arrays,
**byte-identical within those chunks**, wrapped in a minimal HTML shell. The
escaping is the thing under test, so it must not be normalised.

Verified equivalent: the parser returns **73 quotes** from the trimmed fixture
and **73 from the full live page**, so trimming hides nothing.

The page carries two arrays, both of which are read and merged:

| Array | Rows | Fields | Why it is used |
| --- | --- | --- | --- |
| `data` | 30 | name, price, slug, sector, isin, keyIndicators | The price-list page itself — richer, but only its first page of companies |
| `stocks` | 62 | name, price, slug | The home ticker — thinner, but a wider set |

`data` is read first so its richer fields win a collision. The two were checked
against each other: across the 18 companies present in both, **zero price
disagreements**. Reading only one array would silently halve coverage.

Known content, useful as anchors:

- `A V Thomas & Co. Limited Unlisted Shares` — ₹27,300.00, slug
  `a-v-thomas-and-company-ltd-unlisted-shares`. Also exercises the `&`
  ampersand escape.
- `Cultfit Healthcare Private Limited Unlisted Share` — published at price `0`.
  Zero is a placeholder, not a price, and must never reach the comparison table.
- `NSE India Unlisted Shares` — present in `stocks` but not in the first page of
  `data`, so it pins the merge.

## Provenance

| File | Source | Fetched | SHA-256 (as committed) | Bytes |
| --- | --- | --- | --- | --- |
| `stockify-price-list.html` | https://stockify.net.in/unlisted-shares-price-list-india/ | 2026-08-12 | `bd7b9fcd008faa95652d04ea41098471f775548cf8fbb9e1a326ed87f7eb158d` | 99,871 |

The full untrimmed capture hashed `248a7b5fa7294fc82197b44fa2139fba8c9687a58044add9e651fc50213d7973` (762,782 bytes).

## Refreshing a fixture

These pages will change again. When a scheduled run reports `parsed 0 quotes`
for a source, re-capture that dealer's page, re-derive the fixture, and let the
tests tell you what moved — do not adjust assertions to match a page nobody has
inspected. Prices in this fixture are a dealer's indicative rates on the capture
date and are not represented as current anywhere.
