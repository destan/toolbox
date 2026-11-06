import _ from 'lodash';

export const ECHO_URL = 'https://echo.free.beeceptor.com/';

const REQUEST_TIMEOUT_MS = 10_000;
const UNEXPECTED_RESPONSE_MESSAGE = 'Beeceptor returned an unexpected response.';

// c-table rows must be assignable to Record<string, unknown>, which an interface is not.
export type HttpHeader = Record<'name' | 'value', string>;

export interface EchoedRequest {
  ip: string
  headers: HttpHeader[]
  warnings: string[]
}

interface EchoBody {
  ip: string
  headers: Record<string, string>
  warnings?: string[] | null
}

function isEchoBody(body: unknown): body is EchoBody {
  if (!_.isPlainObject(body)) {
    return false;
  }

  const { ip, headers, warnings } = body as Record<string, unknown>;

  return _.isString(ip)
    && ip !== ''
    && _.isPlainObject(headers)
    && !_.isEmpty(headers)
    && Object.values(headers as object).every(_.isString)
    && (_.isNil(warnings) || (_.isArray(warnings) && warnings.every(_.isString)));
}

export function parseEchoedRequest(body: unknown): EchoedRequest {
  if (!isEchoBody(body)) {
    throw new Error(UNEXPECTED_RESPONSE_MESSAGE);
  }

  return {
    ip: body.ip,
    headers: Object.entries(body.headers).map(([name, value]) => ({ name, value })),
    warnings: body.warnings ?? [],
  };
}

function toRequestError(error: unknown): Error {
  switch ((error as Error).name) {
    case 'SyntaxError':
      return new Error(UNEXPECTED_RESPONSE_MESSAGE);
    case 'TimeoutError':
      return new Error(`Beeceptor did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. Try again later.`);
    default:
      return new Error('The browser could not reach Beeceptor. Check your network connection and any content blocker, then try again. Beeceptor may also be rate limiting requests.', { cause: error });
  }
}

export async function fetchEchoedRequest(): Promise<EchoedRequest> {
  let response: Response;
  let body: unknown;

  try {
    response = await fetch(ECHO_URL, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    body = response.ok ? await response.json() : undefined;
  }
  catch (error) {
    throw toRequestError(error);
  }

  if (!response.ok) {
    throw new Error(`Beeceptor responded with HTTP status ${response.status}.`);
  }

  return parseEchoedRequest(body);
}

export function formatHeaders(headers: HttpHeader[]): string {
  return headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
}
