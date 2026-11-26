/**
 * A minimal Microsoft identity platform (client-credentials token) + Graph sendMail server on
 * localhost, ported from the Waves platform's test/support/fake-graph.ts (mail endpoints only).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

export interface FakeGraphOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** Mailboxes the app may send as. */
  mailboxes: string[];
  /** Seconds the issued token claims to live (default 3600). */
  expiresIn?: number;
  /** Answer the next n sendMail calls with 401 InvalidAuthenticationToken. */
  rejectTokens?: number;
  /** Answer every sendMail with this status and Graph error code. */
  sendError?: { status: number; code: string; message: string };
  delayMs?: number;
}

export interface FakeGraphSent {
  mailbox: string;
  authorization: string;
  body: {
    message: {
      subject: string;
      body: { contentType: string; content: string };
      toRecipients: { emailAddress: { address: string } }[];
      from?: unknown;
    };
    saveToSentItems: boolean;
  };
}

export interface FakeGraph {
  /** Base for both the login and the Graph host in tests. */
  url: string;
  requests: string[];
  tokenRequests: Record<string, string>[];
  sent: FakeGraphSent[];
  options: FakeGraphOptions;
  close(): Promise<void>;
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
  });

export async function startFakeGraph(opts: FakeGraphOptions): Promise<FakeGraph> {
  const tokens = new Set<string>();
  const requests: string[] = [];
  const tokenRequests: Record<string, string>[] = [];
  const sent: FakeGraphSent[] = [];

  const json = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, body === undefined ? {} : { 'content-type': 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const graphError = (res: ServerResponse, status: number, code: string, message: string) => json(res, status, { error: { code, message } });

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    requests.push(`${req.method} ${req.url}`);
    const raw = await readBody(req);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (res.destroyed) return;
    const url = new URL(req.url ?? '/', 'http://fake');

    if (url.pathname === `/${opts.tenantId}/oauth2/v2.0/token` && req.method === 'POST') {
      const form = Object.fromEntries(new URLSearchParams(raw));
      tokenRequests.push(form);
      if (form.grant_type !== 'client_credentials' || form.scope !== 'https://graph.microsoft.com/.default') return json(res, 400, { error: 'invalid_request' });
      if (form.client_id !== opts.clientId || form.client_secret !== opts.clientSecret) {
        return json(res, 401, { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: x' });
      }
      const token = randomUUID();
      tokens.add(token);
      return json(res, 200, { token_type: 'Bearer', expires_in: opts.expiresIn ?? 3600, access_token: token });
    }

    const m = /^\/v1\.0\/users\/([^/]+)\/sendMail$/.exec(url.pathname);
    if (m && req.method === 'POST') {
      const auth = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      if (!tokens.has(auth)) return graphError(res, 401, 'InvalidAuthenticationToken', 'Access token is empty.');
      if (opts.rejectTokens && opts.rejectTokens > 0) {
        opts.rejectTokens--;
        tokens.delete(auth);
        return graphError(res, 401, 'InvalidAuthenticationToken', 'Lifetime validation failed, the token is expired.');
      }
      if (opts.sendError) return graphError(res, opts.sendError.status, opts.sendError.code, opts.sendError.message);
      const mailbox = decodeURIComponent(m[1]!).toLowerCase();
      if (!opts.mailboxes.map((x) => x.toLowerCase()).includes(mailbox)) return graphError(res, 404, 'ErrorInvalidUser', `The requested user '${mailbox}' is invalid.`);
      sent.push({ mailbox, authorization: auth, body: JSON.parse(raw) });
      return json(res, 202);
    }
    return json(res, 404, { error: { code: 'NotFound', message: 'not found' } });
  };

  const server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    tokenRequests,
    sent,
    options: opts,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
