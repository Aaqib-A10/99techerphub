/**
 * OAuth helpers for SSO with Google Workspace and Microsoft 365 (Entra ID).
 *
 * Flow:
 *   1. /api/auth/oauth/[provider]/start sets a random `state` in an
 *      httpOnly cookie and redirects the user to the provider.
 *   2. Provider redirects back to /api/auth/oauth/[provider]/callback
 *      with `code` and `state` query params.
 *   3. Callback verifies the state, exchanges code for a token, fetches
 *      the user profile, then creates or finds a User row, creates a
 *      Session, and sets the session cookie.
 *
 * Gated behind the SSO_ENABLED env var. When unset, the start route
 * returns 404 so SSO can be safely deployed dark.
 */

export type OAuthProvider = 'google' | 'microsoft';

export interface OAuthProfile {
  email: string;
  name: string;
  provider: OAuthProvider;
  providerId: string; // 'sub' for Google, 'oid' for Microsoft
}

interface ProviderConfig {
  authorizationUrl: (tenantId?: string) => string;
  tokenUrl: (tenantId?: string) => string;
  userinfoUrl: string;
  scopes: string;
  // Some providers require extra body params on token exchange
  extraTokenParams?: Record<string, string>;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizationUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: 'openid profile email',
  },
  microsoft: {
    authorizationUrl: (tenantId = 'common') =>
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: (tenantId = 'common') =>
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    userinfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: 'openid profile email User.Read',
  },
};

export const ALLOWED_AUTO_PROVISION_DOMAIN =
  (process.env.SSO_AUTO_PROVISION_DOMAIN || '99technologies.com').toLowerCase();

export function isSsoEnabled(): boolean {
  return process.env.SSO_ENABLED === '1';
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unknown OAuth provider: ${provider}`);
  return cfg;
}

export function getRedirectUri(provider: OAuthProvider): string {
  const base = process.env.OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, '')
    || 'http://localhost:3000';
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export function getClientCredentials(provider: OAuthProvider): {
  clientId: string;
  clientSecret: string;
  tenantId?: string;
} {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    return { clientId, clientSecret };
  }
  if (provider === 'microsoft') {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }
    return { clientId, clientSecret, tenantId };
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Build the URL we redirect to in order to start the OAuth flow.
 */
export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string
): string {
  const cfg = getProviderConfig(provider);
  const { clientId, tenantId } = getClientCredentials(provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(provider),
    response_type: 'code',
    scope: cfg.scopes,
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `${cfg.authorizationUrl(tenantId)}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string
): Promise<{ accessToken: string; idToken?: string }> {
  const cfg = getProviderConfig(provider);
  const { clientId, clientSecret, tenantId } = getClientCredentials(provider);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(provider),
  });
  if (cfg.extraTokenParams) {
    for (const [k, v] of Object.entries(cfg.extraTokenParams)) body.set(k, v);
  }

  const res = await fetch(cfg.tokenUrl(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; id_token?: string };
  if (!data.access_token) throw new Error('No access_token in response');
  return { accessToken: data.access_token, idToken: data.id_token };
}

/**
 * Fetch the authenticated user's profile from the provider.
 */
export async function getUserProfile(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthProfile> {
  const cfg = getProviderConfig(provider);
  const res = await fetch(cfg.userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Userinfo fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;

  if (provider === 'google') {
    const email = (raw.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error('Google profile missing email');
    return {
      provider: 'google',
      email,
      name: (raw.name as string | undefined) || email,
      providerId: (raw.sub as string | undefined) || email,
    };
  }
  if (provider === 'microsoft') {
    // Graph /me returns `mail` or `userPrincipalName` (UPN)
    const email = ((raw.mail as string | undefined) || (raw.userPrincipalName as string | undefined))?.toLowerCase();
    if (!email) throw new Error('Microsoft profile missing email');
    return {
      provider: 'microsoft',
      email,
      name: (raw.displayName as string | undefined) || email,
      providerId: (raw.id as string | undefined) || email,
    };
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Decide whether a User can be auto-provisioned from an SSO email.
 * Currently: only emails ending in @{ALLOWED_AUTO_PROVISION_DOMAIN}
 * may be auto-provisioned. Other domains require a pre-created User row.
 */
export function canAutoProvision(email: string): boolean {
  return email.toLowerCase().endsWith('@' + ALLOWED_AUTO_PROVISION_DOMAIN);
}
