const ITERATIONS = 100_000
const KEY_LENGTH = 32
const HASH_ALGO = 'SHA-256'

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
  return candidateHex === hashHex
}
