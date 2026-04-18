// OAuth 2.0 / OIDC discovery metadata.
//
// token.app has no user accounts — all pricing data is public. The only
// protected surface is POST /api/refresh, which accepts a static admin
// Bearer token (REFRESH_SECRET) shaped as an OAuth 2.0 client_credentials
// grant. We publish discovery metadata so agent scanners (e.g.
// isitagentready.com) can machine-verify that we describe our auth model,
// while honestly signalling that interactive user flows are not offered.
//
// Required fields per RFC 8414 + isitagentready scanner:
//   issuer, authorization_endpoint, token_endpoint, jwks_uri,
//   grant_types_supported, response_types_supported.

export function buildAuthorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    grant_types_supported: ['client_credentials'],
    response_types_supported: ['none'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    scopes_supported: ['admin:refresh'],
    service_documentation: `${origin}/about`,
    ui_locales_supported: ['en'],
  };
}

// OpenID Connect discovery. Superset of oauth-authorization-server with a
// few extra required fields. token.app does NOT issue id_tokens, so we
// advertise the minimum needed for the scanner to validate the document.
export function buildOpenIdConfiguration(origin: string) {
  return {
    ...buildAuthorizationServerMetadata(origin),
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['none'],
  };
}

// Empty JWKS — we don't issue or verify JWTs. A valid empty document keeps
// the jwks_uri pointer from 404ing for conformance checks.
export const EMPTY_JWKS = { keys: [] as unknown[] };
