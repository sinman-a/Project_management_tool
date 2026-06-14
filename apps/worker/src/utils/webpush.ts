import type { Env } from '../types'

// Web Push (RFC 8291 aes128gcm) + VAPID (RFC 8292) on Web Crypto — no external deps.
// Sending is a no-op when VAPID keys are unset (so deploys never depend on push config).

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (const byte of b) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) { out.set(a, o); o += a.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

/** Build the ES256-signed VAPID JWT + the `Authorization: vapid` header value. */
async function vapidAuth(env: Env, audience: string): Promise<string> {
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY!) // 65 bytes: 0x04||X||Y
  const d = env.VAPID_PRIVATE_KEY!
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })))
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:admin@ppm-tool.app',
  })))
  const signingInput = `${header}.${payload}`
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput),
  ))
  const jwt = `${signingInput}.${bytesToB64url(sig)}`
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`
}

/** Encrypt a payload for a subscription using aes128gcm (RFC 8291). */
async function encrypt(p256dh: string, auth: string, payload: Uint8Array): Promise<{ body: Uint8Array }> {
  const uaPublic = b64urlToBytes(p256dh)
  const authSecret = b64urlToBytes(auth)

  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, serverKeys.privateKey, 256))

  const enc = new TextEncoder()
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, serverPublic)
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const record = concat(payload, new Uint8Array([0x02])) // single/last record delimiter, no padding
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, record))

  const rs = new Uint8Array([0, 0, 0x10, 0x00]) // record size = 4096
  const header = concat(salt, rs, new Uint8Array([serverPublic.length]), serverPublic)
  return { body: concat(header, ciphertext) }
}

interface PushPayload { title: string; body?: string; url?: string }

/** Send push to all of a user's subscriptions. Best-effort; prunes dead (404/410) subscriptions. */
export async function sendPushToUser(env: Env, userId: string, payload: PushPayload): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return // push not configured → no-op
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    ).bind(userId).all<{ id: string; endpoint: string; p256dh: string; auth: string }>()
    if (!results.length) return

    const data = new TextEncoder().encode(JSON.stringify(payload))
    for (const sub of results) {
      try {
        const { body } = await encrypt(sub.p256dh, sub.auth, data)
        const audience = new URL(sub.endpoint).origin
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidAuth(env, audience),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
          },
          body,
        })
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
        }
      } catch (e) {
        console.error('[push send error]', (e as Error).message)
      }
    }
  } catch (e) {
    console.error('[push error]', (e as Error).message)
  }
}
