export async function POST() {
  // Firebase session cookies are stateless JWTs — no server-side state to revoke.
  // Return 200 per RFC 7009 (revocation is best-effort).
  return new Response(null, {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  })
}
