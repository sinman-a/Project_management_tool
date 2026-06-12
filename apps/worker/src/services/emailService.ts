import type { Env } from '../types'

interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/** Login URL for CTAs; falls back to the production Pages origin. */
export function appLoginUrl(env: Env): string {
  return `${(env.APP_URL ?? 'https://ppm-tool.pages.dev').replace(/\/$/, '')}/login`
}

/**
 * Send an email via Resend. Provider-agnostic call site: if RESEND_API_KEY /
 * EMAIL_FROM are not configured, this is a no-op (logs and returns) so auth flows
 * never depend on email being set up. Never throws.
 */
export async function sendEmail(env: Env, msg: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.log(`[email skipped] to=${msg.to} subject="${msg.subject}" (RESEND_API_KEY/EMAIL_FROM unset)`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    })
    if (!res.ok) {
      console.error(`[email failed] ${res.status} ${await res.text()}`)
    }
  } catch (e) {
    console.error('[email error]', (e as Error).message)
  }
}

/** Minimal inline-styled HTML shell with an optional CTA button. */
function renderEmail(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<tr><td style="padding:24px 0;">
         <a href="${cta.url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;display:inline-block;">${cta.label}</a>
       </td></tr>`
    : ''
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;text-align:left;">
        <tr><td style="font-size:18px;font-weight:700;padding-bottom:8px;">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#3f3f46;">${bodyHtml}</td></tr>
        ${button}
        <tr><td style="font-size:12px;color:#a1a1aa;border-top:1px solid #e4e4e7;padding-top:16px;">PPM Tool — Project & Portfolio Management</td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

export function welcomeEmail(p: { name: string; orgName: string; loginUrl: string }): Omit<EmailMessage, 'to'> {
  const body = `Hi ${p.name},<br/><br/>Your workspace <strong>${p.orgName}</strong> on PPM Tool is ready. You can now create projects, plan resources and track your portfolio.`
  return {
    subject: `Welcome to PPM Tool, ${p.name}`,
    html: renderEmail('Welcome to PPM Tool 🎉', body, { label: 'Open PPM Tool', url: p.loginUrl }),
    text: `Hi ${p.name}, your workspace "${p.orgName}" on PPM Tool is ready. Sign in: ${p.loginUrl}`,
  }
}

export function inviteEmail(p: { name: string; orgName: string; inviterName: string; loginUrl: string }): Omit<EmailMessage, 'to'> {
  const body = `Hi ${p.name},<br/><br/><strong>${p.inviterName}</strong> added you to the <strong>${p.orgName}</strong> workspace on PPM Tool. Sign in with the email address this message was sent to — your administrator will share your initial password.`
  return {
    subject: `You've been added to ${p.orgName} on PPM Tool`,
    html: renderEmail('You have been invited', body, { label: 'Sign in', url: p.loginUrl }),
    text: `Hi ${p.name}, ${p.inviterName} added you to "${p.orgName}" on PPM Tool. Sign in: ${p.loginUrl}`,
  }
}

export function signupNotifyEmail(p: { orgName: string; email: string }): Omit<EmailMessage, 'to'> {
  const body = `A new workspace just registered on PPM Tool.<br/><br/>Organization: <strong>${p.orgName}</strong><br/>Admin email: <strong>${p.email}</strong>`
  return {
    subject: `New signup: ${p.orgName}`,
    html: renderEmail('New workspace registered', body),
    text: `New signup on PPM Tool — org "${p.orgName}", admin ${p.email}`,
  }
}
