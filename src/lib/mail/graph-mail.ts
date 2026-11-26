/**
 * Sends mail through Microsoft Graph (`POST /v1.0/users/{sender}/sendMail`) with an app-only token,
 * ported from the Waves platform (apps/api/src/core/mail/graph-mail.client.ts).
 *
 * The message is sent as the sender mailbox: recipients see that mailbox's display name as set in
 * Microsoft 365, not the display name in EMAIL_FROM.
 */
import { GraphAuth, GraphAuthError } from './graph-auth';

export interface GraphMailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Mailbox the app sends as (UPN or SMTP address). */
  sender: string;
  /** Keep a copy in the sender's Sent Items. */
  saveToSentItems: boolean;
  /** Overridable for tests; defaults are the public Microsoft cloud. */
  loginBaseUrl?: string;
  graphBaseUrl?: string;
  timeoutMs?: number;
}

export type GraphMailMessage = { to: string[]; subject: string; html?: string; text?: string };

export type GraphMailErrorKind = 'auth' | 'send' | 'network';

/** A Graph send failure. Messages carry Microsoft's error code, never credentials or tokens. */
export class GraphMailError extends Error {
  constructor(
    message: string,
    readonly kind: GraphMailErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GraphMailError';
  }

  /** Worth another try later (throttling, outages, timeouts). */
  get retryable(): boolean {
    return this.kind === 'network' || this.status === 429 || (this.status !== undefined && this.status >= 500);
  }
}

export class GraphMailClient {
  private readonly auth: GraphAuth;
  private readonly graphBase: string;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: GraphMailConfig) {
    this.graphBase = (cfg.graphBaseUrl ?? 'https://graph.microsoft.com').replace(/\/+$/, '');
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
    this.auth = new GraphAuth({
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      loginBaseUrl: cfg.loginBaseUrl,
      timeoutMs: this.timeoutMs,
    });
  }

  async send(msg: GraphMailMessage): Promise<void> {
    const body = JSON.stringify({
      message: {
        subject: msg.subject,
        body: msg.html !== undefined ? { contentType: 'HTML', content: msg.html } : { contentType: 'Text', content: msg.text ?? '' },
        toRecipients: msg.to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: this.cfg.saveToSentItems,
    });
    let res = await this.postSendMail(body);
    if (res.status === 401) {
      await res.body?.cancel().catch(() => undefined);
      // Token revoked or expired early: log in again once.
      this.auth.invalidate();
      res = await this.postSendMail(body);
    }
    if (res.status !== 202 && !res.ok) {
      throw new GraphMailError(`Graph sendMail failed (${res.status}): ${await graphErrorText(res)}`, 'send', res.status);
    }
    await res.body?.cancel().catch(() => undefined);
  }

  private async postSendMail(body: string): Promise<Response> {
    const token = await this.accessToken();
    try {
      return await fetch(`${this.graphBase}/v1.0/users/${encodeURIComponent(this.cfg.sender)}/sendMail`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const name = (e as Error).name;
      throw new GraphMailError(
        name === 'TimeoutError' ? `no answer from Microsoft within ${this.timeoutMs} ms` : `cannot reach Microsoft: ${(e as Error).message}`,
        'network',
      );
    }
  }

  private async accessToken(): Promise<string> {
    try {
      return await this.auth.token();
    } catch (e) {
      if (e instanceof GraphAuthError) {
        throw new GraphMailError(e.network ? e.message : `Microsoft login failed: ${e.message}`, e.network ? 'network' : 'auth', e.status);
      }
      throw e;
    }
  }
}

async function graphErrorText(res: Response): Promise<string> {
  const data = (await res.json().catch(() => undefined)) as { error?: { code?: string; message?: string } } | undefined;
  return data?.error ? `${data.error.code ?? 'error'}: ${data.error.message ?? ''}`.trim() : res.statusText;
}
