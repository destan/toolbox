export const ECHO_URL = 'https://echo.free.beeceptor.com/';

const REQUEST_TIMEOUT_MS = 10_000;

// c-table rows must be assignable to Record<string, unknown>, which an interface is not.
export type HttpHeader = Record<'name' | 'value', string>;

export interface EchoedRequest {
  ip: string
  headers: HttpHeader[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseEchoedRequest(body: unknown): EchoedRequest {
  if (!isRecord(body) || typeof body.ip !== 'string' || !isRecord(body.headers)) {
    throw new Error('Beeceptor returned an unexpected response.');
  }

  return {
    ip: body.ip,
    headers: Object.entries(body.headers).map(([name, value]) => ({ name, value: String(value) })),
  };
}

export async function fetchEchoedRequest(): Promise<EchoedRequest> {
  const response = await fetch(ECHO_URL, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Beeceptor responded with HTTP status ${response.status}.`);
  }

  return parseEchoedRequest(await response.json());
}

export function formatHeaders(headers: HttpHeader[]): string {
  return headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
}
