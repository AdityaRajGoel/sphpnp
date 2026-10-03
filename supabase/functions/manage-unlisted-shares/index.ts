import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000

function getRateLimitKey(req: Request): string {
  return req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record) return { allowed: true }
  if (record.lockedUntil > now) return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) }
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) { loginAttempts.delete(ip); return { allowed: true } }
  if (record.count >= MAX_ATTEMPTS) { record.lockedUntil = now + LOCKOUT_DURATION_MS; return { allowed: false, retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) } }
  return { allowed: true }
}

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (record) { record.count += 1; record.lastAttempt = now }
  else loginAttempts.set(ip, { count: 1, lastAttempt: now, lockedUntil: 0 })
}

function clearAttempts(ip: string) { loginAttempts.delete(ip) }

function sanitizeString(val: unknown, maxLength = 500): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLength)
}
function sanitizeBoolean(val: unknown): boolean { return val === true }
function sanitizeNumber(val: unknown): number { const num = Number(val); return Number.isFinite(num) ? num : 0 }

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif']
const MAX_FILE_SIZE = 2 * 1024 * 1024

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
// Mirror the admin form's options (src/components/admin/MarketDataManager.tsx).
const FLOW_CATEGORIES = ['fii_cash', 'dii_cash', 'fii_fno', 'mf_activity']
const ACTION_TYPES = ['Dividend', 'Bonus', 'Split', 'Buyback', 'Rights', 'Results', 'AGM', 'Other']

function safeErrorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const contentType = req.headers.get('content-type') || ''
    const clientIp = getRateLimitKey(req)

    // Handle image upload
    if (contentType.includes('multipart/form-data')) {
      const rateCheck = checkRateLimit(clientIp)
      if (!rateCheck.allowed) return safeErrorResponse(429, `Too many attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.`)

      const formData = await req.formData()
      const password = formData.get('password') as string
      const file = formData.get('file') as File
      const shareId = formData.get('share_id') as string

      const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')
      if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) { recordFailedAttempt(clientIp); return safeErrorResponse(401, 'Invalid password') }
      clearAttempts(clientIp)

      if (!file) return safeErrorResponse(400, 'No file provided')
      if (!ALLOWED_MIME_TYPES.includes(file.type)) return safeErrorResponse(400, 'Invalid file type.')
      if (file.size > MAX_FILE_SIZE) return safeErrorResponse(400, 'File too large. Maximum 2MB.')

      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'png'
      const safeShareId = shareId ? shareId.replace(/[^a-zA-Z0-9-]/g, '') : crypto.randomUUID()
      const fileName = `${safeShareId}.${ext}`

      const { error: uploadError } = await supabase.storage.from('stock-logos').upload(fileName, file, { upsert: true, contentType: file.type })
      if (uploadError) { console.error('Upload error:', uploadError); return safeErrorResponse(500, 'Failed to upload file') }

      const { data: urlData } = supabase.storage.from('stock-logos').getPublicUrl(fileName)
      if (shareId) {
        await supabase.from('unlisted_shares').update({ image_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', safeShareId)
      }

      return new Response(JSON.stringify({ success: true, url: urlData.publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const action = sanitizeString(body.action, 20)
    const password = typeof body.password === 'string' ? body.password : ''
    const data = body.data || {}

    if (action === 'list') {
      const { data: shares, error } = await supabase.from('unlisted_shares').select('*').order('display_order', { ascending: true })
      if (error) { console.error('List error:', error); return safeErrorResponse(500, 'Failed to load shares') }
      return new Response(JSON.stringify({ success: true, data: shares }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Public: list active banners (no auth)
    if (action === 'list_banners') {
      const { data: banners, error } = await supabase.from('banner_messages').select('id, message, type, link_url, link_text').eq('is_active', true).order('display_order', { ascending: true })
      if (error) { console.error('List banners error:', error); return safeErrorResponse(500, 'Failed to load banners') }
      return new Response(JSON.stringify({ success: true, banners }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) return safeErrorResponse(429, `Too many attempts. Try again in ${rateCheck.retryAfterSeconds} seconds.`)

    if (action === 'verify') {
      const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')
      if (!ADMIN_PASSWORD) return safeErrorResponse(500, 'Server configuration error')
      if (password !== ADMIN_PASSWORD) { recordFailedAttempt(clientIp); return safeErrorResponse(401, 'Invalid password') }
      clearAttempts(clientIp)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD')
    if (!ADMIN_PASSWORD) return safeErrorResponse(500, 'Server configuration error')
    if (password !== ADMIN_PASSWORD) { recordFailedAttempt(clientIp); return safeErrorResponse(401, 'Invalid password') }
    clearAttempts(clientIp)

    if (action === 'update') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid share ID')
      const updateData: Record<string, any> = {
        name: sanitizeString(data.name, 200),
        short_code: sanitizeString(data.short_code, 20),
        tag: sanitizeString(data.tag, 50),
        tag_color: sanitizeString(data.tag_color, 100),
        price: sanitizeString(data.price, 50),
        buy_price: sanitizeString(data.buy_price, 50) || null,
        sell_price: sanitizeString(data.sell_price, 50) || null,
        min_qty: sanitizeString(data.min_qty, 50),
        gradient_color: sanitizeString(data.gradient_color, 100),
        display_order: sanitizeNumber(data.display_order),
        is_active: sanitizeBoolean(data.is_active),
        company_description: sanitizeString(data.company_description, 2000) || null,
        sector: sanitizeString(data.sector, 100) || null,
        founded_year: sanitizeString(data.founded_year, 10) || null,
        headquarters: sanitizeString(data.headquarters, 200) || null,
        updated_at: new Date().toISOString(),
      }
      if (data.image_url !== undefined) {
        updateData.image_url = data.image_url === null ? null : sanitizeString(data.image_url, 1000)
      }
      const { error } = await supabase.from('unlisted_shares').update(updateData).eq('id', data.id)
      if (error) { console.error('Update error:', error); return safeErrorResponse(500, 'Failed to update share') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create') {
      const name = sanitizeString(data.name, 200)
      const short_code = sanitizeString(data.short_code, 20)
      const price = sanitizeString(data.price, 50)
      if (!name || !short_code || !price) return safeErrorResponse(400, 'Name, short code, and price are required')

      const { error } = await supabase.from('unlisted_shares').insert({
        name, short_code, price,
        buy_price: sanitizeString(data.buy_price, 50) || null,
        sell_price: sanitizeString(data.sell_price, 50) || null,
        tag: sanitizeString(data.tag, 50) || 'Popular',
        tag_color: sanitizeString(data.tag_color, 100) || 'bg-secondary/10 text-secondary',
        min_qty: sanitizeString(data.min_qty, 50) || '1 Share',
        gradient_color: sanitizeString(data.gradient_color, 100) || 'from-blue-600 to-blue-800',
        display_order: sanitizeNumber(data.display_order),
        image_url: data.image_url ? sanitizeString(data.image_url, 1000) : null,
        company_description: sanitizeString(data.company_description, 2000) || null,
        sector: sanitizeString(data.sector, 100) || 'General',
        founded_year: sanitizeString(data.founded_year, 10) || null,
        headquarters: sanitizeString(data.headquarters, 200) || null,
      })
      if (error) { console.error('Create error:', error); return safeErrorResponse(500, 'Failed to create share') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid share ID')
      const { error } = await supabase.from('unlisted_shares').delete().eq('id', data.id)
      if (error) { console.error('Delete error:', error); return safeErrorResponse(500, 'Failed to delete share') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---- Leads Management ----
    if (action === 'list_leads') {
      const { data: leads, error } = await supabase.from('account_leads').select('*').order('created_at', { ascending: false })
      if (error) { console.error('List leads error:', error); return safeErrorResponse(500, 'Failed to load leads') }
      return new Response(JSON.stringify({ success: true, leads }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update_lead') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid lead ID')
      const status = sanitizeString(data.status, 20)
      if (!['new', 'contacted', 'converted', 'closed'].includes(status)) return safeErrorResponse(400, 'Invalid status')
      const { error } = await supabase.from('account_leads').update({ status }).eq('id', data.id)
      if (error) { console.error('Update lead error:', error); return safeErrorResponse(500, 'Failed to update lead') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete_lead') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid lead ID')
      const { error } = await supabase.from('account_leads').delete().eq('id', data.id)
      if (error) { console.error('Delete lead error:', error); return safeErrorResponse(500, 'Failed to delete lead') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---- Market data (admin "Market Data" tab) ----
    // These tables only accept writes from a database admin, and this page signs
    // in with the admin password instead, so its direct writes were refused (and a
    // refused delete looked like a success). The password check above guards these.
    if (action === 'save_flows') {
      const rows = Array.isArray(data.rows) ? data.rows : []
      const clean = rows.slice(0, FLOW_CATEGORIES.length).map((r: Record<string, unknown>) => ({
        activity_date: sanitizeString(r.activity_date, 10),
        category: sanitizeString(r.category, 20),
        buy_cr: sanitizeNumber(r.buy_cr),
        sell_cr: sanitizeNumber(r.sell_cr),
      }))
      if (!clean.length || clean.some((r) => !ISO_DATE.test(r.activity_date) || !FLOW_CATEGORIES.includes(r.category) || r.buy_cr < 0 || r.sell_cr < 0)) {
        return safeErrorResponse(400, 'Invalid flow rows')
      }
      const { error } = await supabase.from('market_flows').upsert(clean, { onConflict: 'activity_date,category' })
      if (error) { console.error('Save flows error:', error); return safeErrorResponse(500, 'Failed to save flows') }
      return new Response(JSON.stringify({ success: true, saved: clean.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'add_corporate_action') {
      const row = {
        company: sanitizeString(data.company, 120),
        action_type: sanitizeString(data.action_type, 20),
        details: sanitizeString(data.details, 500),
        ex_date: sanitizeString(data.ex_date, 10),
      }
      if (!row.company || !row.details || !ACTION_TYPES.includes(row.action_type) || !ISO_DATE.test(row.ex_date)) {
        return safeErrorResponse(400, 'Invalid corporate action')
      }
      const { error } = await supabase.from('corporate_actions').insert(row)
      if (error) { console.error('Add corporate action error:', error); return safeErrorResponse(500, 'Failed to add corporate action') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete_corporate_action') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid corporate action ID')
      const { error, count } = await supabase.from('corporate_actions').delete({ count: 'exact' }).eq('id', data.id)
      if (error) { console.error('Delete corporate action error:', error); return safeErrorResponse(500, 'Failed to delete corporate action') }
      if (!count) return safeErrorResponse(404, 'Corporate action not found')
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---- Banner Management ----
    if (action === 'list_all_banners') {
      const { data: banners, error } = await supabase.from('banner_messages').select('*').order('display_order', { ascending: true })
      if (error) { console.error('List all banners error:', error); return safeErrorResponse(500, 'Failed to load banners') }
      return new Response(JSON.stringify({ success: true, banners }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create_banner') {
      const message = sanitizeString(data.message, 500)
      if (!message) return safeErrorResponse(400, 'Banner message is required')
      const type = sanitizeString(data.type, 20) || 'info'
      if (!['info', 'warning', 'success', 'promo'].includes(type)) return safeErrorResponse(400, 'Invalid banner type')
      const { error } = await supabase.from('banner_messages').insert({
        message,
        type,
        link_url: sanitizeString(data.link_url, 1000) || null,
        link_text: sanitizeString(data.link_text, 100) || null,
        is_active: data.is_active !== undefined ? sanitizeBoolean(data.is_active) : true,
        display_order: sanitizeNumber(data.display_order),
      })
      if (error) { console.error('Create banner error:', error); return safeErrorResponse(500, 'Failed to create banner') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update_banner') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid banner ID')
      const type = sanitizeString(data.type, 20) || 'info'
      if (!['info', 'warning', 'success', 'promo'].includes(type)) return safeErrorResponse(400, 'Invalid banner type')
      const { error } = await supabase.from('banner_messages').update({
        message: sanitizeString(data.message, 500),
        type,
        link_url: sanitizeString(data.link_url, 1000) || null,
        link_text: sanitizeString(data.link_text, 100) || null,
        is_active: sanitizeBoolean(data.is_active),
        display_order: sanitizeNumber(data.display_order),
        updated_at: new Date().toISOString(),
      }).eq('id', data.id)
      if (error) { console.error('Update banner error:', error); return safeErrorResponse(500, 'Failed to update banner') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete_banner') {
      if (!data.id || typeof data.id !== 'string') return safeErrorResponse(400, 'Invalid banner ID')
      const { error } = await supabase.from('banner_messages').delete().eq('id', data.id)
      if (error) { console.error('Delete banner error:', error); return safeErrorResponse(500, 'Failed to delete banner') }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return safeErrorResponse(400, 'Invalid action')
  } catch (error) {
    console.error('Unhandled error:', error)
    return safeErrorResponse(500, 'An unexpected error occurred')
  }
})
