export interface EdgeAuthUser {
  id: string
  role: string
  companyId: string | null
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

const JWT_SECRET = getRequiredEnvVar('JWT_SECRET')

async function verifyJwtEdge(token: string): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts

    const encoder = new TextEncoder()
    const secretKey = encoder.encode(JWT_SECRET)

    const key = await crypto.subtle.importKey(
      'raw',
      secretKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    )
    const data = encoder.encode(`${headerB64}.${payloadB64}`)

    const isValid = await crypto.subtle.verify('HMAC', key, signature, data)
    if (!isValid) return null

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    if (payload.iss !== 'freee_audit' || payload.aud !== 'freee_audit_users') {
      return null
    }

    return {
      userId: payload.userId,
      sessionId: payload.sessionId,
    }
  } catch {
    return null
  }
}

export async function validateSessionEdge(token: string): Promise<EdgeAuthUser | null> {
  const decoded = await verifyJwtEdge(token)
  if (!decoded) return null

  return {
    id: decoded.userId,
    role: 'USER',
    companyId: null,
  }
}

export async function extractUserFromToken(token: string): Promise<EdgeAuthUser | null> {
  return validateSessionEdge(token)
}
