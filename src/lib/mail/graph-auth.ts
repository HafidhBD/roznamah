/**
 * App-only (OAuth2 client credentials) Microsoft Graph token, ported from the Waves platform
 * (apps/api/src/core/microsoft/graph-auth.ts). One instance caches one token for every caller.
 */
export interface GraphAuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Overridable for tests; the default is the public Microsoft cloud. */
  loginBaseUrl?: string;
  timeoutMs?: number;
}

/** A failed Microsoft login. The message is Microsoft's `error: description` first line, never credentials. */
export class GraphAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** True when Microsoft could not be reached at all (timeout, DNS, connection). */
    readonly network = false,
  ) {
    super(message);
    this.name = 'GraphAuthError';
  }
}

/** Refresh a token this long before Microsoft says it expires. */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class GraphAuth {
  private cached?: { value: string; expiresAt: number };
  /** One token request at a time; concurrent callers share it. */
  private inflight?: Promise<string>;
  private readonly loginBase: string;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: GraphAuthConfig) {
    this.loginBase = (cfg.loginBaseUrl ?? 'https://login.microsoftonline.com').replace(/\/+$/, '');
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
  }

  async token(): Promise<string> {
    if (this.cached && this.cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return this.cached.value;
    this.inflight ??= this.request().finally(() => (this.inflight = undefined));
    return this.inflight;
  }

  /** Drop the cached token (revoked or expired early) so the next token() logs in again. */
  invalidate(): void {
    this.cached = undefined;
  }

  private async request(): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.loginBase}/${encodeURIComponent(this.cfg.tenantId)}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }).toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const name = (e as Error).name;
      throw new GraphAuthError(
        name === 'TimeoutError' ? `no answer from Microsoft within ${this.timeoutMs} ms` : `cannot reach Microsoft: ${(e as Error).message}`,
        undefined,
        true,
      );
    }
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      // error_description is Microsoft's text (AADSTS code); it never echoes the secret.
      const why = [data.error, data.error_description?.split(/\r?\n/)[0]].filter(Boolean).join(': ') || `HTTP ${res.status}`;
      throw new GraphAuthError(why, res.status);
    }
    this.cached = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.cached.value;
  }
}
