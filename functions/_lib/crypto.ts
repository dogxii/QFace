const encoder = new TextEncoder()

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)

  return toBase64Url(values.buffer)
}

export async function sha256(value: string) {
  return toBase64Url(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function signValue(value: string, secret: string) {
  return `${value}.${await hmac(value, secret)}`
}

export async function verifySignedValue(signedValue: string, secret: string) {
  const separatorIndex = signedValue.lastIndexOf('.')
  if (separatorIndex < 1) return undefined

  const value = signedValue.slice(0, separatorIndex)
  const signature = signedValue.slice(separatorIndex + 1)
  const expected = await hmac(value, secret)

  return signature === expected ? value : undefined
}
