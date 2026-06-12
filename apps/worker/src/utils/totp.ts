// RFC 6238 TOTP (HMAC-SHA1) implemented on Web Crypto — no external dependencies.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/g, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** Generate a new base32 TOTP secret (20 random bytes = 160 bits). */
export function generateSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)))
}

async function hotp(secret: string, counter: number, digits = 6): Promise<string> {
  const keyBytes = base32Decode(secret)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])

  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  // 64-bit big-endian counter (high word is 0 for our time range).
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter >>> 0)

  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (bin % 10 ** digits).toString().padStart(digits, '0')
}

const PERIOD = 30

/** Verify a TOTP code with a ±`window` step tolerance (clock drift). */
export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
  const trimmed = (code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(trimmed)) return false
  const counter = Math.floor(Date.now() / 1000 / PERIOD)
  for (let i = -window; i <= window; i++) {
    if (await hotp(secret, counter + i) === trimmed) return true
  }
  return false
}

export function otpauthUri(secret: string, email: string, issuer = 'PPM Tool'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: String(PERIOD) })
  return `otpauth://totp/${label}?${params.toString()}`
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Generate N human-friendly backup codes (xxxx-xxxx) + their SHA-256 hashes. */
export async function genBackupCodes(n = 10): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = []
  for (let i = 0; i < n; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    plain.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`)
  }
  const hashed = await Promise.all(plain.map(sha256Hex))
  return { plain, hashed }
}
