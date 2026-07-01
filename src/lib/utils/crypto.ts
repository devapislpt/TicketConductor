/**
 * crypto.ts — AES-256-GCM encryption helpers for system_config secrets.
 *
 * Strategy:
 *   - encrypt(plaintext, secret) → "iv:authTag:ciphertext" (all base64)
 *   - decrypt(ciphertext, secret) → plaintext string
 *   - getSecret()                 → reads SYSTEM_SECRET env var (throws if missing)
 *
 * The secret is a hex string (64 chars = 32 bytes). Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * NEVER expose this module to the client bundle.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

// ─── Key derivation ───────────────────────────────────────────────────────────
/**
 * Derives a 32-byte buffer from the secret string.
 * Accepts either a 64-char hex string (preferred) or any string (SHA-256 fallback).
 */
function deriveKey(secret: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Buffer.from(secret, 'hex')
  }
  // Fallback: SHA-256 of the secret so any string works
  return createHash('sha256').update(secret).digest()
}

// ─── getSecret ────────────────────────────────────────────────────────────────
/**
 * Reads SYSTEM_SECRET from environment variables.
 * Throws a descriptive error if it is missing or too short.
 * Never leaks the secret value in the error message.
 */
export function getSecret(): string {
  const secret = process.env.SYSTEM_SECRET
  if (!secret) {
    throw new Error(
      '[SystemConfig] SYSTEM_SECRET environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (secret.length < 16) {
    throw new Error(
      '[SystemConfig] SYSTEM_SECRET is too short (minimum 16 characters). ' +
      'Generate a proper key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return secret
}

// ─── encrypt ──────────────────────────────────────────────────────────────────
/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext  The string to encrypt.
 * @param secret     The secret key (hex string or passphrase).
 * @returns          A colon-delimited base64 string: "iv:authTag:ciphertext"
 * @throws           If encryption fails — error message never contains plaintext.
 */
export function encrypt(plaintext: string, secret: string): string {
  try {
    const key = deriveKey(secret)
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':')
  } catch (err) {
    // Never include plaintext in error messages
    const msg = err instanceof Error ? err.message : 'Unknown encryption error'
    throw new Error(`[SystemConfig] Encryption failed: ${msg}`)
  }
}

// ─── decrypt ──────────────────────────────────────────────────────────────────
/**
 * Decrypts a value produced by encrypt().
 *
 * @param ciphertext  The "iv:authTag:ciphertext" base64 string.
 * @param secret      The secret key used during encryption.
 * @returns           The original plaintext string.
 * @throws            If decryption fails (bad key, tampered data, wrong format).
 */
export function decrypt(ciphertext: string, secret: string): string {
  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format — expected "iv:authTag:ciphertext"')
    }

    const [ivB64, authTagB64, dataB64] = parts
    const key = deriveKey(secret)
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const encryptedData = Buffer.from(dataB64, 'base64')

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (err) {
    // Never include any values (could contain sensitive data) in error messages
    const msg = err instanceof Error ? err.message : 'Unknown decryption error'
    throw new Error(`[SystemConfig] Decryption failed: ${msg}`)
  }
}
