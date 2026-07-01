/**
 * Unit tests for Zod validation schemas
 * Tests: magicLinkSchema, loginSchema, resetPasswordSchema
 */

import { magicLinkSchema } from '@/lib/validators/auth'
import { loginSchema } from '@/lib/validators/auth'
import { resetPasswordSchema } from '@/lib/validators/auth'

// ---------------------------------------------------------------------------
// Helper: parse a schema and return { success, data, error }
// ---------------------------------------------------------------------------
function safeParse<T>(schema: { safeParse: (v: unknown) => T }, value: unknown): T {
  return schema.safeParse(value)
}

// ---------------------------------------------------------------------------
// magicLinkSchema
// ---------------------------------------------------------------------------
describe('magicLinkSchema', () => {
  describe('valid inputs', () => {
    it('accepts a standard email address', () => {
      const result = magicLinkSchema.safeParse({ email: 'user@example.com' })
      expect(result.success).toBe(true)
    })

    it('accepts an email with subdomain', () => {
      const result = magicLinkSchema.safeParse({ email: 'admin@mail.fallcon.org' })
      expect(result.success).toBe(true)
    })

    it('accepts an email with plus addressing', () => {
      const result = magicLinkSchema.safeParse({ email: 'user+tag@example.com' })
      expect(result.success).toBe(true)
    })

    it('accepts an email with dots in the local part', () => {
      const result = magicLinkSchema.safeParse({ email: 'first.last@example.com' })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects an email missing the @ symbol', () => {
      const result = magicLinkSchema.safeParse({ email: 'notanemail' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('rejects an email missing the domain', () => {
      const result = magicLinkSchema.safeParse({ email: 'user@' })
      expect(result.success).toBe(false)
    })

    it('rejects an email missing the local part', () => {
      const result = magicLinkSchema.safeParse({ email: '@example.com' })
      expect(result.success).toBe(false)
    })

    it('rejects an email with spaces', () => {
      const result = magicLinkSchema.safeParse({ email: 'user name@example.com' })
      expect(result.success).toBe(false)
    })

    it('rejects an empty email string', () => {
      const result = magicLinkSchema.safeParse({ email: '' })
      expect(result.success).toBe(false)
    })

    it('rejects a missing email field entirely', () => {
      const result = magicLinkSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects a null email value', () => {
      const result = magicLinkSchema.safeParse({ email: null })
      expect(result.success).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  describe('valid inputs', () => {
    it('accepts valid email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'secureP@ss1',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a long password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'a'.repeat(64),
      })
      expect(result.success).toBe(true)
    })

    it('accepts minimum-length password (8 chars)', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '12345678',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('invalid inputs', () => {
    it('rejects a missing password field', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0])
        expect(paths).toContain('password')
      }
    })

    it('rejects an empty password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
      expect(result.success).toBe(false)
    })

    it('rejects a password shorter than 8 characters', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'short' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordIssue = result.error.issues.find((i) => i.path[0] === 'password')
        expect(passwordIssue).toBeDefined()
      }
    })

    it('rejects an invalid email with valid password', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'validPass123' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0])
        expect(paths).toContain('email')
      }
    })

    it('rejects empty email with valid password', () => {
      const result = loginSchema.safeParse({ email: '', password: 'validPass123' })
      expect(result.success).toBe(false)
    })

    it('rejects both fields missing', () => {
      const result = loginSchema.safeParse({})
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('rejects null values', () => {
      const result = loginSchema.safeParse({ email: null, password: null })
      expect(result.success).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
describe('resetPasswordSchema', () => {
  describe('valid inputs', () => {
    it('accepts matching passwords that meet minimum length', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'StrongPass1!',
        confirmPassword: 'StrongPass1!',
      })
      expect(result.success).toBe(true)
    })

    it('accepts exactly 8-character matching passwords (minimum boundary)', () => {
      const result = resetPasswordSchema.safeParse({
        password: '12345678',
        confirmPassword: '12345678',
      })
      expect(result.success).toBe(true)
    })

    it('accepts long passwords that match', () => {
      const long = 'x'.repeat(128)
      const result = resetPasswordSchema.safeParse({
        password: long,
        confirmPassword: long,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('passwords do not match', () => {
    it('rejects when password and confirmPassword differ', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'MyPassword1!',
        confirmPassword: 'DifferentPass1!',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues[0]
        // Zod refine produces an error; the message should indicate mismatch
        expect(issue.message).toMatch(/match|same|identical/i)
      }
    })

    it('rejects when confirmPassword is empty but password is valid', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'MyPassword1!',
        confirmPassword: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects when password has trailing space that confirmPassword lacks', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'MyPassword1! ',
        confirmPassword: 'MyPassword1!',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('password too short', () => {
    it('rejects a 7-character password (one below minimum)', () => {
      const result = resetPasswordSchema.safeParse({
        password: '1234567',
        confirmPassword: '1234567',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordIssue = result.error.issues.find(
          (i) => i.path[0] === 'password' || i.path.includes('password')
        )
        expect(passwordIssue?.message).toMatch(/8|characters|minimum|short/i)
      }
    })

    it('rejects an empty password', () => {
      const result = resetPasswordSchema.safeParse({
        password: '',
        confirmPassword: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects a single character password', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'a',
        confirmPassword: 'a',
      })
      expect(result.success).toBe(false)
    })

    it('reports a helpful minimum-length error message', () => {
      const result = resetPasswordSchema.safeParse({
        password: 'short',
        confirmPassword: 'short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join(' ')
        expect(messages).toMatch(/8|character|minimum|length/i)
      }
    })
  })

  describe('edge cases', () => {
    it('rejects missing confirmPassword field', () => {
      const result = resetPasswordSchema.safeParse({ password: 'ValidPass123' })
      expect(result.success).toBe(false)
    })

    it('rejects missing password field', () => {
      const result = resetPasswordSchema.safeParse({ confirmPassword: 'ValidPass123' })
      expect(result.success).toBe(false)
    })

    it('rejects null values', () => {
      const result = resetPasswordSchema.safeParse({ password: null, confirmPassword: null })
      expect(result.success).toBe(false)
    })
  })
})
