const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ChannelConfig = {
  key: string;
  name: string;
  channelId: string;
  liveUrl: string;
  channelUrl: string;
};

type FeedEntry = {
  videoId: string;
  title: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
};

const CHANNELS: ChannelConfig[] = [
  {
    key: 'zee-business',
    name: 'Zee Business',
    channelId: 'UCkXopQ3ubd-rnXnStZqCl2w',
    liveUrl: 'https://www.youtube.com/@ZeeBusiness/live',
    channelUrl: 'https://www.youtube.com/@ZeeBusiness',
  },
  {
    key: 'cnbc-awaaz',
    name: 'CNBC Awaaz',
    channelId: 'UCQIycDaLsBpMKjOCeaKUYVg',
    liveUrl: 'https://www.youtube.com/@CNBCAwaaz/live',
    channelUrl: 'https://www.youtube.com/@CNBCAwaaz',
  },
];

// "&amp;" is decoded last so a double-encoded entity (e.g. "&amp;lt;") isn't
// unescaped twice in one pass.
const decodeXml = (value: string) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

const extractTag = (xml: string, tagName: string) => {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
  return match?.[1] ?? null;
};

const parseFeedEntries = (xml: string): FeedEntry[] => {
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const entries: FeedEntry[] = [];

  for (const match of xml.matchAll(entryRegex)) {
    const entryXml = match[1];
    const videoId = extractTag(entryXml, 'yt:videoId');
    if (!videoId) continue;

    const title = extractTag(entryXml, 'title');
    const publishedAt = extractTag(entryXml, 'published');
    const updatedAt = extractTag(entryXml, 'updated');

    entries.push({
      videoId,
      title: title ? decodeXml(title) : null,
      publishedAt,
      updatedAt,
    });
  }

  return entries;
};

const isLikelyLiveTitle = (title: string | null) => {
  if (!title) return false;
  return /\blive\b|🔴|stream|share market live|market live|final trade/i.test(title);
};

const pickBestEntries = (entries: FeedEntry[]) => {
  const scored = [...entries].sort((a, b) => {
    const scoreA = isLikelyLiveTitle(a.title) ? 1 : 0;
    const scoreB = isLikelyLiveTitle(b.title) ? 1 : 0;
    return scoreB - scoreA;
  });

  return scored.slice(0, 8);
};

const resolveEmbeddableUrl = async (videoId: string) => {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  const response = await fetch(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) {
    throw new Error(`oEmbed lookup failed with status ${response.status}`);
  }

  const payload = await response.json();
  const iframeHtml = typeof payload?.html === 'string' ? payload.html : '';
  const srcMatch = iframeHtml.match(/src="([^"]+)"/);
  const rawEmbed = srcMatch?.[1] || `https://www.youtube.com/embed/${videoId}?feature=oembed`;

  return {
    embedUrl: rawEmbed.replaceAll('&amp;', '&'),
    watchUrl,
    title: typeof payload?.title === 'string' ? payload.title : null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const channels = await Promise.all(
      CHANNELS.map(async (channel) => {
        try {
          const feedResponse = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
          );

          if (!feedResponse.ok) {
            throw new Error(`RSS fetch failed with status ${feedResponse.status}`);
          }

          const xml = await feedResponse.text();
          const entries = parseFeedEntries(xml);
          const candidates = pickBestEntries(entries);

          let resolved: {
            embedUrl: string;
            watchUrl: string;
            title: string | null;
            entry: FeedEntry;
          } | null = null;

          for (const entry of candidates) {
            try {
              const embed = await resolveEmbeddableUrl(entry.videoId);
              resolved = { ...embed, entry };
              break;
            } catch {
              // Try next entry
            }
          }

          if (!resolved) {
            throw new Error('No embeddable videos found for this channel');
          }

          return {
            ...channel,
            status: 'ok',
            videoId: resolved.entry.videoId,
            title: resolved.title || resolved.entry.title,
            publishedAt: resolved.entry.publishedAt,
            updatedAt: resolved.entry.updatedAt,
            embedUrl: resolved.embedUrl,
            watchUrl: resolved.watchUrl,
            resolvedFrom: isLikelyLiveTitle(resolved.entry.title) ? 'live-like-title' : 'latest-embeddable',
          };
        } catch (channelError) {
          const errorMessage = channelError instanceof Error ? channelError.message : 'Unknown channel fetch error';
          return {
            ...channel,
            status: 'fallback',
            videoId: null,
            title: null,
            publishedAt: null,
            updatedAt: null,
            embedUrl: `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}`,
            watchUrl: channel.liveUrl,
            resolvedFrom: 'channel-live-url',
            error: errorMessage,
          };
        }
      }),
    );

    return new Response(
      JSON.stringify({ success: true, channels, fetchedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Failed to fetch live broadcasts:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch live broadcasts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
