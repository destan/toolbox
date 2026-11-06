import { afterEach, describe, expect, it, vi } from 'vitest';
import { ECHO_URL, fetchEchoedRequest, formatHeaders, parseEchoedRequest } from './browser-headers.service';

const echoBody = {
  method: 'GET',
  ip: '203.0.113.7',
  headers: { 'Accept': '*/*', 'User-Agent': 'test-agent' },
};

const unexpectedResponseMessage = 'Beeceptor returned an unexpected response.';

describe('browser-headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('parseEchoedRequest', () => {
    it('extracts the IP address and the headers in response order', () => {
      expect(parseEchoedRequest(echoBody)).toEqual({
        ip: '203.0.113.7',
        headers: [
          { name: 'Accept', value: '*/*' },
          { name: 'User-Agent', value: 'test-agent' },
        ],
        warnings: [],
      });
    });

    it('keeps the warnings of the echo service', () => {
      expect(parseEchoedRequest({ ...echoBody, warnings: ['Duplicate headers found: x-dup'] }).warnings).toEqual(['Duplicate headers found: x-dup']);
    });

    it('accepts a header with an empty value', () => {
      expect(parseEchoedRequest({ ip: '203.0.113.7', headers: { 'X-Empty': '' } }).headers).toEqual([{ name: 'X-Empty', value: '' }]);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an array', []],
      ['a missing IP address', { headers: { Accept: '*/*' } }],
      ['an empty IP address', { ip: '', headers: { Accept: '*/*' } }],
      ['missing headers', { ip: '203.0.113.7' }],
      ['empty headers', { ip: '203.0.113.7', headers: {} }],
      ['headers that are an array', { ip: '203.0.113.7', headers: ['Accept'] }],
      ['a null header value', { ip: '203.0.113.7', headers: { 'X-Test': null } }],
      ['an object header value', { ip: '203.0.113.7', headers: { 'X-Test': { a: 1 } } }],
      ['warnings that are not strings', { ...echoBody, warnings: [1] }],
    ])('rejects %s', (_, body) => {
      expect(() => parseEchoedRequest(body)).toThrow(unexpectedResponseMessage);
    });
  });

  describe('fetchEchoedRequest', () => {
    it('omits credentials and the referrer from the request', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(echoBody)));
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchEchoedRequest()).resolves.toMatchObject({ ip: '203.0.113.7' });

      expect(fetchMock).toHaveBeenCalledWith(ECHO_URL, expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
    });

    it('reports the HTTP status of a failed response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Too many requests', { status: 429 })));

      await expect(fetchEchoedRequest()).rejects.toThrow('Beeceptor responded with HTTP status 429.');
    });

    it('reports a successful response with a non-JSON body as unexpected', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!DOCTYPE html>')));

      await expect(fetchEchoedRequest()).rejects.toThrow(unexpectedResponseMessage);
    });

    it('reports a timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError')));

      await expect(fetchEchoedRequest()).rejects.toThrow('Beeceptor did not respond within 10 seconds. Try again later.');
    });

    it('reports a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(fetchEchoedRequest()).rejects.toThrow('The browser could not reach Beeceptor.');
    });
  });

  describe('formatHeaders', () => {
    it('writes one header per line', () => {
      expect(formatHeaders([{ name: 'Accept', value: '*/*' }, { name: 'User-Agent', value: 'test-agent' }])).toBe('Accept: */*\nUser-Agent: test-agent');
    });
  });
});
