// OWASP-aligned work factor for PBKDF2-HMAC-SHA256. Stored per-hash, so raising
// this only affects newly created hashes; existing hashes verify with their own count.
const ITERATIONS = 210_000
const KEY_LENGTH = 32
const HASH_ALGO = 'SHA-256'

/** Constant-time hex-string comparison (avoids timing side-channels). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH * 8,
  )
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${ITERATIONS}:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2:')) return false
  const [, iters, saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: parseInt(iters), hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH * 8,
  )
  const candidateHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(candidateHex, hashHex)
}
