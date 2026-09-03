import { NextResponse } from "next/server"
import { runAllRules, type Snapshot } from "@/lib/digest/rules"
import { composeHtml, composeText, composeSubject } from "@/lib/digest/compose"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Weekly Spark digest endpoint.
 *
 * Two callers:
 *  1. Vercel Cron (schedule in vercel.json). Fires Mondays 08:00 UTC.
 *     Requires Bearer $CRON_SECRET on the Authorization header.
 *  2. Manual preview / send:
 *       GET  /api/weekly-digest?preview=html  → HTML preview, no send
 *       GET  /api/weekly-digest?preview=text  → plain-text preview
 *       GET  /api/weekly-digest?preview=json  → raw callouts as JSON
 *       POST /api/weekly-digest?force=1       → force send (bypasses schedule)
 *
 *  Send is skipped and status=preview_only returned when RESEND_API_KEY is
 *  absent — so a fresh install produces a valid preview without any secret
 *  setup. Set RESEND_API_KEY + DIGEST_RECIPIENTS in Vercel env vars to
 *  enable delivery.
 */

interface EndpointResult {
  status: "sent" | "preview_only" | "unauthorized" | "no_send_forced" | "error"
  callouts: number
  subject: string
  html?: string
  text?: string
  error?: string
  recipients?: string[]
  messageId?: string
}

async function fetchJson<T = any>(base: string, path: string): Promise<T | null> {
  try {
    const url = `${base}${path}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      console.error(`digest fetch ${path}: HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e: any) {
    console.error(`digest fetch ${path} failed:`, e.message)
    return null
  }
}

async function collectSnapshot(originBase: string): Promise<Snapshot> {
  const [buybacks, ecosystem, peers, peerRevenue, financials, spkToken] =
    await Promise.all([
      fetchJson(originBase, "/api/buybacks"),
      fetchJson(originBase, "/api/ecosystem"),
      fetchJson(originBase, "/api/peers"),
      fetchJson(originBase, "/api/peer-revenue"),
      fetchJson(originBase, "/api/financials"),
      fetchJson(originBase, "/api/spk-token"),
    ])
  return { buybacks, ecosystem, peers, peerRevenue, financials, spkToken }
}

function originFromRequest(request: Request): string {
  const url = new URL(request.url)
  // In prod under basePath the origin still exposes /api routes at the
  // basePath prefix (see next.config.js). Preserve it.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
  return `${url.protocol}//${url.host}${basePath}`
}

function verifyCronAuth(request: Request): {
  ok: boolean
  scheduled: boolean
  reason?: string
} {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization") || ""

  // Vercel Cron always sends Authorization: Bearer <CRON_SECRET>.
  // Fail closed: if CRON_SECRET isn't set, nothing is authorised. ?preview
  // still works (it never sends), but a send requires the configured secret.
  const isScheduled = !!secret && authHeader === `Bearer ${secret}`
  return {
    ok: isScheduled,
    scheduled: isScheduled,
    reason: !secret ? "missing_cron_secret" : isScheduled ? undefined : "bad_bearer",
  }
}

async function sendViaResend(opts: {
  html: string
  text: string
  subject: string
  from: string
  recipients: string[]
  apiKey: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from,
        to: opts.recipients,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    })
    const body: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: body?.message || `HTTP ${res.status}` }
    }
    return { ok: true, id: body?.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

async function run(request: Request, options: { forceSend: boolean }) {
  const url = new URL(request.url)
  const previewFormat = url.searchParams.get("preview")
  const auth = verifyCronAuth(request)

  // Reject only when a secret is set AND the header didn't match AND the
  // caller wants a real send. Preview requests always allowed for dev.
  if (!auth.ok && !previewFormat) {
    const result: EndpointResult = {
      status: "unauthorized",
      callouts: 0,
      subject: "",
      error: auth.reason || "unauthorized",
    }
    return NextResponse.json(result, { status: 401 })
  }

  const originBase = originFromRequest(request)
  const snapshot = await collectSnapshot(originBase)
  const callouts = runAllRules(snapshot)
  const html = composeHtml(callouts)
  const text = composeText(callouts)
  const subject = composeSubject(callouts)

  // Format-specific previews come back raw for easy debugging.
  if (previewFormat === "html") return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  if (previewFormat === "text") return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8" } })
  if (previewFormat === "json") return NextResponse.json({ subject, callouts, snapshotKeys: Object.keys(snapshot).filter((k) => (snapshot as any)[k] != null) })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.DIGEST_FROM || "alerts@datumlab.xyz"
  const recipients = (process.env.DIGEST_RECIPIENTS || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)

  // Graceful degrade: without a Resend key, we still return everything so
  // it's easy to hook up delivery later without changing the endpoint shape.
  if (!apiKey || recipients.length === 0) {
    const result: EndpointResult = {
      status: "preview_only",
      callouts: callouts.length,
      subject,
      html,
      text,
      recipients,
      error: !apiKey
        ? "RESEND_API_KEY not set"
        : "DIGEST_RECIPIENTS not set",
    }
    return NextResponse.json(result)
  }

  // Only skip send when the caller is neither the Cron nor an explicit force.
  if (!auth.scheduled && !options.forceSend) {
    const result: EndpointResult = {
      status: "no_send_forced",
      callouts: callouts.length,
      subject,
      recipients,
    }
    return NextResponse.json(result)
  }

  const sent = await sendViaResend({ html, text, subject, from, recipients, apiKey })
  const result: EndpointResult = {
    status: sent.ok ? "sent" : "error",
    callouts: callouts.length,
    subject,
    recipients,
    messageId: sent.id,
    error: sent.error,
  }
  return NextResponse.json(result, { status: sent.ok ? 200 : 500 })
}

export async function GET(request: Request) {
  return run(request, { forceSend: false })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const force = url.searchParams.get("force") === "1"
  return run(request, { forceSend: force })
}
