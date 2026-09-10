-- Removes three renamed symbols whose rows survive as zero-price ghosts.
--
-- ZOMATO, MCDOWELL and ADANITRANS were dropped from the screener's universe
-- because NSE renamed each of them: they are ETERNAL, UNITDSPR and ADANIENSOL
-- today, all three of which are now in the universe and syncing real prices.
--
-- Removing them from the source array stops the sync WRITING them, but does not
-- remove what it already wrote. Their rows sat at price = 0 because their Yahoo
-- tickers resolve to nothing, and the screener reads the table rather than the
-- array - so without this they keep appearing as three companies trading at
-- zero, next to the correctly-priced rows for the same businesses under their
-- current names.
--
-- Worth recording: these zero-price rows were noted during the August market-cap
-- work and attributed then to partial Yahoo responses. They were not. A quote
-- for a delisted ticker is empty for a much more mundane reason, and the
-- omit-when-unusable guard added later could never have fixed it.
--
-- Scoped to exactly these three symbols. Any other zero-price row is a genuine
-- sync gap and must be left alone to be investigated, not swept up here.

delete from public.screener_stocks
where symbol in ('ZOMATO', 'MCDOWELL', 'ADANITRANS');
