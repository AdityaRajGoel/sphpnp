import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Shared secret proving a request really came from Telegram. Telegram echoes it
// back in X-Telegram-Bot-Api-Secret-Token on every webhook delivery once it is
// supplied to setWebhook. This function runs with verify_jwt = false and writes
// with the service-role key, so without this check ANY caller could inject
// arbitrary posts into the public site feed, or re-point the bot's webhook.
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

const unauthorized = () =>
  new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Fail CLOSED: an unset secret must lock the endpoint, not open it.
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not configured; refusing all requests.');
    return unauthorized();
  }

  // GET: Register webhook or fetch recent messages for frontend
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // register/status are privileged admin actions: they can repoint the bot's
    // webhook or disclose its configuration, so they require the secret.
    if (action === 'register' || action === 'status') {
      if (req.headers.get('x-admin-secret') !== TELEGRAM_WEBHOOK_SECRET) {
        return unauthorized();
      }
    }

    // Register webhook with Telegram
    if (action === 'register') {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['channel_post'],
            // Telegram will send this back on every delivery so the POST
            // handler below can verify the caller really is Telegram.
            secret_token: TELEGRAM_WEBHOOK_SECRET,
          }),
        }
      );
      const data = await res.json();
      // Telegram always answers with an `ok` boolean even on HTTP 200. Relaying
      // this response with a blanket 200 previously meant a rejected
      // setWebhook call (bad token, unreachable URL, etc.) looked identical to
      // a successful one to whoever is registering the webhook.
      if (!res.ok || data?.ok !== true) {
        console.error('Telegram setWebhook failed:', res.status, data);
      }
      return new Response(JSON.stringify(data), {
        status: res.ok && data?.ok === true ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check current webhook status
    if (action === 'status') {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const data = await res.json();
      if (!res.ok || data?.ok !== true) {
        console.error('Telegram getWebhookInfo failed:', res.status, data);
      }
      return new Response(JSON.stringify(data), {
        status: res.ok && data?.ok === true ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: Fetch recent messages from DB (for frontend polling)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('telegram_updates')
      .select('*')
      .order('message_date', { ascending: false })
      .limit(15);

    if (error) {
      // Log the real postgrest error server-side only; the client gets a
      // generic message so DB internals never leak into an HTTP response.
      console.error('telegram_updates read error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to load messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messages: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // POST: Telegram webhook callback - receives new channel posts
  if (req.method === 'POST') {
    // Only Telegram knows the secret it was given at setWebhook time.
    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET) {
      return unauthorized();
    }

    try {
      const update = await req.json();

      // We only care about channel_post updates
      const post = update.channel_post;
      if (!post) {
        return new Response(JSON.stringify({ ok: true, skipped: 'not a channel_post' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messageText = post.text || post.caption || null;
      const messageDate = new Date(post.date * 1000).toISOString();
      const telegramMessageId = post.message_id;
      const isForwarded = !!post.forward_origin || !!post.forward_from_chat;
      const forwardFromTitle = post.forward_origin?.chat?.title
        || post.forward_from_chat?.title
        || null;

      // Handle photos - get the largest resolution
      let hasPhoto = false;
      let photoUrl: string | null = null;

      if (post.photo && post.photo.length > 0) {
        hasPhoto = true;
        const largestPhoto = post.photo[post.photo.length - 1];
        // Get file path from Telegram
        const fileRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${largestPhoto.file_id}`
        );
        const fileData = await fileRes.json();
        if (fileData.ok && fileData.result.file_path) {
          photoUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
        } else {
          // Not fatal: the post is still saved with hasPhoto true and a null
          // photoUrl. Logged so a run of these doesn't go unnoticed - it means
          // the channel post renders without its image.
          console.error('Telegram getFile failed to resolve a photo URL:', fileRes.status, fileData);
        }
      }

      // Skip if no text and no photo (e.g., stickers, polls, etc.)
      if (!messageText && !hasPhoto) {
        return new Response(JSON.stringify({ ok: true, skipped: 'no text or photo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert into database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase.from('telegram_updates').upsert(
        {
          telegram_message_id: telegramMessageId,
          message_text: messageText,
          message_date: messageDate,
          has_photo: hasPhoto,
          photo_url: photoUrl,
          is_forwarded: isForwarded,
          forward_from_title: forwardFromTitle,
        },
        { onConflict: 'telegram_message_id' }
      );

      if (error) {
        // Fail LOUD to Telegram on purpose: this is a webhook, and Telegram
        // retries non-2xx deliveries. The upsert is keyed on
        // telegram_message_id (onConflict), so a retried delivery after a
        // transient DB error is safe to replay rather than something to
        // suppress.
        console.error('DB insert error:', error);
        return new Response(
          JSON.stringify({ ok: false, error: 'Failed to save message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ ok: true, saved: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Webhook error:', err);
      return new Response(
        JSON.stringify({ ok: false, error: 'Webhook processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
