import { describe, expect, it } from 'vitest';
import {
  decodeEncodedWords,
  extractHeaderBlock,
  formatDuration,
  formatHeadersAsJson,
  formatHeadersAsText,
  getAuthHeaders,
  getAuthVerdicts,
  getRelayHops,
  parseHeaders,
} from './eml-header-parser.service';

const SAMPLE_EML = [
  'Received: by 2002:a05:6512:1234 with SMTP id abc;',
  '        Tue, 2 Jan 2024 10:00:05 -0800 (PST)',
  'Received: from mail.example.com (mail.example.com [192.0.2.1])',
  '        (using TLSv1.3 with cipher TLS_AES_256_GCM_SHA384 (256/256 bits))',
  '        by mx.google.com with ESMTPS id xyz',
  '        for <bob@example.org>; Tue, 2 Jan 2024 18:00:00 +0000',
  'Authentication-Results: mx.google.com;',
  '       dkim=pass header.i=@example.com header.s=s1;',
  '       spf=pass (google.com: domain of alice@example.com designates 192.0.2.1 as permitted sender) smtp.mailfrom=alice@example.com;',
  '       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=example.com',
  'Received-SPF: softfail (google.com: transitioning domain) client-ip=192.0.2.1;',
  'DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=s1;',
  '        b=abc123',
  'From: =?UTF-8?B?QWxpY2Ugw5Z6dMO8cms=?= <alice@example.com>',
  'Subject: =?ISO-8859-1?Q?Caf=E9_menu?= =?UTF-8?Q?_=E2=82=AC5?=',
  '',
  'Body: this line is not a header.',
].join('\r\n');

describe('eml-header-parser', () => {
  describe('extractHeaderBlock', () => {
    it('cuts the body at the first empty line and drops leading whitespace', () => {
      expect(extractHeaderBlock('\n\nA: 1\nB: 2\n\nbody\n\nmore')).toBe('A: 1\nB: 2');
    });

    it('keeps the full text when there is no body', () => {
      expect(extractHeaderBlock('A: 1\r\nB: 2')).toBe('A: 1\r\nB: 2');
    });
  });

  describe('parseHeaders', () => {
    it('keeps the order and duplicates, unfolds and decodes values, and ignores the body', () => {
      const headers = parseHeaders(SAMPLE_EML);

      expect(headers.map(({ name }) => name)).toEqual(['Received', 'Received', 'Authentication-Results', 'Received-SPF', 'DKIM-Signature', 'From', 'Subject']);
      expect(headers[0].value).toBe('by 2002:a05:6512:1234 with SMTP id abc; Tue, 2 Jan 2024 10:00:05 -0800 (PST)');
      expect(headers[5].value).toBe('Alice Öztürk <alice@example.com>');
      expect(headers[6].value).toBe('Café menu €5');
    });

    it('ignores lines that are not headers', () => {
      expect(parseHeaders('From someone@example.com Tue Jan 2 2024\nTo: bob@example.org')).toEqual([{ name: 'To', value: 'bob@example.org' }]);
    });

    it('returns no headers for an empty input', () => {
      expect(parseHeaders('')).toEqual([]);
    });
  });

  describe('decodeEncodedWords', () => {
    it('keeps an encoded word with an unknown charset', () => {
      expect(decodeEncodedWords('=?x-unknown?Q?abc?=')).toBe('=?x-unknown?Q?abc?=');
    });

    it('keeps the whitespace between an encoded word and plain text', () => {
      expect(decodeEncodedWords('Re: =?UTF-8?Q?caf=C3=A9?= menu')).toBe('Re: café menu');
    });
  });

  describe('getAuthHeaders', () => {
    it('returns the SPF, DKIM, DMARC and ARC headers', () => {
      expect(getAuthHeaders(parseHeaders(SAMPLE_EML)).map(({ name }) => name)).toEqual(['Authentication-Results', 'Received-SPF', 'DKIM-Signature']);
    });
  });

  describe('getAuthVerdicts', () => {
    it('reads the verdicts from Authentication-Results and Received-SPF', () => {
      expect(getAuthVerdicts(parseHeaders(SAMPLE_EML))).toEqual([
        { source: 'Authentication-Results', method: 'dkim', result: 'pass', details: 'header.i=@example.com header.s=s1', trusted: true },
        {
          source: 'Authentication-Results',
          method: 'spf',
          result: 'pass',
          details: '(google.com: domain of alice@example.com designates 192.0.2.1 as permitted sender) smtp.mailfrom=alice@example.com',
          trusted: true,
        },
        { source: 'Authentication-Results', method: 'dmarc', result: 'fail', details: '(p=REJECT sp=REJECT dis=NONE) header.from=example.com', trusted: true },
        { source: 'Received-SPF', method: 'spf', result: 'softfail', details: '(google.com: transitioning domain) client-ip=192.0.2.1;', trusted: true },
      ]);
    });

    it('reads the verdicts from ARC-Authentication-Results and does not trust them', () => {
      expect(getAuthVerdicts([{ name: 'ARC-Authentication-Results', value: 'i=1; mx.google.com; spf=neutral smtp.mailfrom=a@b.c' }])).toEqual([
        { source: 'ARC-Authentication-Results', method: 'spf', result: 'neutral', details: 'smtp.mailfrom=a@b.c', trusted: false },
      ]);
    });

    it('trusts only the top Authentication-Results and Received-SPF', () => {
      const verdicts = getAuthVerdicts([
        { name: 'Authentication-Results', value: 'mx.example.org; spf=pass' },
        { name: 'Received-SPF', value: 'pass' },
        { name: 'Authentication-Results', value: 'forged.example; dkim=pass' },
        { name: 'Received-SPF', value: 'pass' },
      ]);

      expect(verdicts.map(({ trusted }) => trusted)).toEqual([true, true, false, false]);
    });
  });

  describe('getRelayHops', () => {
    it('puts the oldest hop first, ignores keywords in comments, and computes the delay', () => {
      const hops = getRelayHops(parseHeaders(SAMPLE_EML));

      expect(hops).toEqual([
        {
          from: 'mail.example.com (mail.example.com [192.0.2.1]) (using TLSv1.3 with cipher TLS_AES_256_GCM_SHA384 (256/256 bits))',
          by: 'mx.google.com',
          with: 'ESMTPS',
          date: new Date('2024-01-02T18:00:00Z'),
          delaySeconds: null,
        },
        {
          from: '',
          by: '2002:a05:6512:1234',
          with: 'SMTP',
          date: new Date('2024-01-02T18:00:05Z'),
          delaySeconds: 5,
        },
      ]);
    });

    it('sets no date and no delay when the date is missing', () => {
      expect(getRelayHops([{ name: 'Received', value: 'from a by b' }])).toEqual([{ from: 'a', by: 'b', with: '', date: null, delaySeconds: null }]);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds as hours, minutes and seconds', () => {
      expect(formatDuration(0)).toBe('0 s');
      expect(formatDuration(5)).toBe('5 s');
      expect(formatDuration(120)).toBe('2 min');
      expect(formatDuration(3725)).toBe('1 h 2 min 5 s');
      expect(formatDuration(-90)).toBe('-1 min 30 s');
    });
  });

  describe('formatHeadersAsText and formatHeadersAsJson', () => {
    const headers = [{ name: 'To', value: 'bob@example.org' }, { name: 'To', value: 'carol@example.org' }];

    it('formats the headers as lines', () => {
      expect(formatHeadersAsText(headers)).toBe('To: bob@example.org\nTo: carol@example.org');
    });

    it('formats the headers as a JSON array', () => {
      expect(JSON.parse(formatHeadersAsJson(headers))).toEqual(headers);
    });
  });
});
