export interface EmlHeader {
  name: string
  value: string
}

export interface AuthVerdict {
  source: string
  method: string
  result: string
  details: string
  trusted: boolean
}

export interface RelayHop {
  from: string
  by: string
  with: string
  date: Date | null
  delaySeconds: number | null
}

const AUTH_HEADER_NAMES = ['authentication-results', 'arc-authentication-results', 'received-spf', 'dkim-signature', 'arc-seal', 'arc-message-signature'];
const RECEIVED_CLAUSES = ['from', 'by', 'via', 'with', 'id', 'for'];
const ENCODED_WORD = /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi;

// The headers end at the first empty line. A long body is cut away before any other processing.
export function extractHeaderBlock(eml: string): string {
  const text = eml.replace(/^\s+/, '');
  const end = text.search(/\r?\n\r?\n/);

  return end === -1 ? text : text.slice(0, end);
}

export function parseHeaders(eml: string): EmlHeader[] {
  const headers: EmlHeader[] = [];

  for (const line of extractHeaderBlock(eml).split(/\r?\n/)) {
    const last = headers.at(-1);
    if (/^[ \t]/.test(line) && last) {
      last.value += ` ${line.trim()}`;
      continue;
    }

    const match = line.match(/^([\x21-\x39\x3B-\x7E]+):(.*)$/);
    if (match) {
      headers.push({ name: match[1], value: match[2].trim() });
    }
  }

  return headers.map(({ name, value }) => ({ name, value: decodeEncodedWords(value) }));
}

// RFC 2047: whitespace between two adjacent encoded words is not part of the text.
export function decodeEncodedWords(value: string): string {
  return value
    .replace(/(=\?[^?]+\?[BQ]\?[^?]*\?=)\s+(?==\?[^?]+\?[BQ]\?[^?]*\?=)/gi, '$1')
    .replace(ENCODED_WORD, (word, charset: string, encoding: string, text: string) => {
      try {
        return new TextDecoder(charset).decode(encoding.toUpperCase() === 'B' ? decodeBase64(text) : decodeQuotedPrintable(text));
      }
      catch {
        return word;
      }
    });
}

function decodeBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

function decodeQuotedPrintable(text: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '_') {
      bytes.push(0x20);
    }
    else if (text[i] === '=' && /^[0-9A-F]{2}$/i.test(text.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    }
    else {
      bytes.push(text.charCodeAt(i));
    }
  }

  return Uint8Array.from(bytes);
}

export function getAuthHeaders(headers: EmlHeader[]): EmlHeader[] {
  return headers.filter(({ name }) => AUTH_HEADER_NAMES.includes(name.toLowerCase()));
}

// The receiving server adds its Authentication-Results and Received-SPF on top. Only the top one of each is
// trusted: lower ones come from earlier servers, and the sender can forge them.
export function getAuthVerdicts(headers: EmlHeader[]): AuthVerdict[] {
  const seen = new Set<string>();

  return headers.flatMap(({ name, value }) => {
    const lowerName = name.toLowerCase();
    const trusted = lowerName !== 'arc-authentication-results' && !seen.has(lowerName);
    seen.add(lowerName);

    if (lowerName === 'received-spf') {
      const [result = '', ...rest] = value.split(/\s+/);
      return [{ source: name, method: 'spf', result: result.toLowerCase(), details: rest.join(' '), trusted }];
    }

    if (lowerName !== 'authentication-results' && lowerName !== 'arc-authentication-results') {
      return [];
    }

    return value.split(';').flatMap((part) => {
      const match = part.trim().match(/^(spf|dkim|dmarc)\s*=\s*(\S+)(\s.*)?$/is);
      return match ? [{ source: name, method: match[1].toLowerCase(), result: match[2].toLowerCase(), details: (match[3] ?? '').trim(), trusted }] : [];
    });
  });
}

// Each relay adds its Received header on top, so the hops are reversed to put the oldest first.
export function getRelayHops(headers: EmlHeader[]): RelayHop[] {
  const hops = headers
    .filter(({ name }) => name.toLowerCase() === 'received')
    .map(({ value }) => parseReceived(value))
    .reverse();

  return hops.map((hop, index) => {
    const previous = hops[index - 1]?.date;
    return { ...hop, delaySeconds: previous && hop.date ? (hop.date.getTime() - previous.getTime()) / 1000 : null };
  });
}

function parseReceived(value: string): Omit<RelayHop, 'delaySeconds'> {
  const separator = value.lastIndexOf(';');
  const clausesText = separator === -1 ? value : value.slice(0, separator);
  const dateText = separator === -1 ? '' : value.slice(separator + 1).replace(/\([^)]*\)/g, '').trim();
  const date = new Date(dateText);
  const clauses = splitReceivedClauses(clausesText);

  return {
    from: clauses.from ?? '',
    by: clauses.by ?? '',
    with: clauses.with ?? '',
    date: Number.isNaN(date.getTime()) ? null : date,
  };
}

// Comments such as "(using TLSv1.3 with cipher ...)" can contain clause keywords, so keywords count only outside parentheses.
function splitReceivedClauses(text: string): Record<string, string> {
  const clauses: Record<string, string[]> = {};
  let current: string[] | undefined;
  let depth = 0;

  for (const token of text.trim().split(/\s+/)) {
    if (depth === 0 && RECEIVED_CLAUSES.includes(token.toLowerCase())) {
      current = clauses[token.toLowerCase()] = [];
    }
    else {
      current?.push(token);
    }

    depth = Math.max(0, depth + (token.match(/\(/g)?.length ?? 0) - (token.match(/\)/g)?.length ?? 0));
  }

  return Object.fromEntries(Object.entries(clauses).map(([key, tokens]) => [key, tokens.join(' ')]));
}

export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const total = Math.round(Math.abs(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [hours && `${hours} h`, minutes && `${minutes} min`, (total % 60 || total === 0) && `${total % 60} s`].filter(Boolean);

  return sign + parts.join(' ');
}

export function formatHeadersAsText(headers: EmlHeader[]): string {
  return headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
}

export function formatHeadersAsJson(headers: EmlHeader[]): string {
  return JSON.stringify(headers, null, 2);
}
