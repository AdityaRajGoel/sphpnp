const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000;

function getRateLimitKey(req: Request): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

function sanitize(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen).replace(/[<>"'&]/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
    return map[c] || c;
  });
}

function isValidPhone(phone: string): boolean {
  return /^(\+?91)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// One bounded retry for a transient blip. Not a queue, not unbounded -
// try once, wait briefly, try again, then report honestly.
const DB_INSERT_MAX_ATTEMPTS = 2;
const DB_INSERT_RETRY_DELAY_MS = 500;

interface LeadPayload {
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  message: string | null;
}

async function insertLeadWithRetry(
  supabaseUrl: string,
  supabaseKey: string,
  payload: LeadPayload
): Promise<boolean> {
  for (let attempt = 1; attempt <= DB_INSERT_MAX_ATTEMPTS; attempt++) {
    try {
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/account_leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      });

      if (dbRes.ok) return true;

      // Log server-side only - never echo the raw PostgREST error body to the client.
      console.error(`DB insert failed (attempt ${attempt}/${DB_INSERT_MAX_ATTEMPTS}):`, await dbRes.text());
    } catch (fetchError) {
      console.error(`DB insert threw (attempt ${attempt}/${DB_INSERT_MAX_ATTEMPTS}):`, fetchError);
    }

    if (attempt < DB_INSERT_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DB_INSERT_RETRY_DELAY_MS));
    }
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders, ...securityHeaders } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
    });
  }

  const responseHeaders = { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' };

  try {
    const ip = getRateLimitKey(req);
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many submissions. Please try again later.' }),
        { status: 429, headers: responseHeaders }
      );
    }

    const body = await req.json();

    // Honeypot check - if the hidden field has a value, it's a bot
    if (body._website && typeof body._website === 'string' && body._website.trim().length > 0) {
      // Silently accept but don't process (bots think it worked)
      return new Response(
        JSON.stringify({ success: true, message: 'Lead saved successfully' }),
        { headers: responseHeaders }
      );
    }

    // Timestamp-based CSRF check - form must be submitted within 5 seconds to 30 minutes of render
    const formTimestamp = body._ts;
    if (formTimestamp && typeof formTimestamp === 'number') {
      const elapsed = Date.now() - formTimestamp;
      if (elapsed < 3000) {
        // Submitted too fast (< 3 seconds) - likely a bot
        return new Response(
          JSON.stringify({ success: true, message: 'Lead saved successfully' }),
          { headers: responseHeaders }
        );
      }
      if (elapsed > 30 * 60 * 1000) {
        return new Response(
          JSON.stringify({ success: false, error: 'Form expired. Please refresh and try again.' }),
          { status: 400, headers: responseHeaders }
        );
      }
    }

    const name = sanitize(body.name, 100);
    const phone = sanitize(body.phone, 20);
    const email = body.email ? sanitize(body.email, 255) : null;
    const city = body.city ? sanitize(body.city, 100) : null;
    const message = body.message ? sanitize(body.message, 1000) : null;

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid name is required (min 2 characters)' }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (!phone || !isValidPhone(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid Indian phone number is required' }),
        { status: 400, headers: responseHeaders }
      );
    }

    if (email && !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email address' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const persisted = await insertLeadWithRetry(supabaseUrl, supabaseKey, { name, phone, email, city, message });

    const whatsappNumber = '919416400314';
    const waMessage = `🆕 New Lead!\n👤 ${name}\n📱 ${phone}${email ? `\n📧 ${email}` : ''}${city ? `\n📍 ${city}` : ''}${message ? `\n💬 ${message}` : ''}`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMessage)}`;

    if (!persisted) {
      // The write did not go through even after a retry. Never report success -
      // that is how leads go missing. Keep whatsappUrl in the payload so the UI
      // can still get the visitor to the business instead of a dead end.
      return new Response(
        JSON.stringify({
          success: false,
          persisted: false,
          whatsappUrl,
          message: "We couldn't save your details automatically. Please message us on WhatsApp or call us directly.",
        }),
        { headers: responseHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, persisted: true, whatsappUrl, message: 'Lead saved successfully' }),
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error('Error processing lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
