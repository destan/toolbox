import { describe, expect, it } from 'vitest';
import { detectLanguage, formatCode, isValidJson } from './code-formatter.service';

describe('code-formatter service', () => {
  describe('detectLanguage', () => {
    it('returns undefined for an empty input', () => {
      expect(detectLanguage('')).toBeUndefined();
      expect(detectLanguage('  \n ')).toBeUndefined();
    });

    it.each([
      ['{"a":1,"b":[1,2]}'],
      ['[1,2,3]'],
      ['"hello"'],
      ['{"a":1,}'],
      ['[\n  {"a": 1},\n]'],
    ])('detects JSON in %j', (code) => {
      expect(detectLanguage(code)).toBe('json');
    });

    it.each([
      ['<div><p>hi</p></div>'],
      ['<!doctype html><html></html>'],
      ['<style>a{color:red}</style>'],
      ['<script>let a=1</script>'],
      ['<!-- comment --><p>x</p>'],
      ['<br>'],
      ['<my-element a="1"></my-element>'],
    ])('detects HTML in %j', (code) => {
      expect(detectLanguage(code)).toBe('html');
    });

    it.each([
      ['a{color:red}'],
      ['.a .b > c { margin: 0 auto; }'],
      ['@media (max-width: 600px) { .a { display: none } }'],
      ['body{margin:0}\nh1,h2{font-weight:700}'],
      [':root{--x:1}'],
      ['a:not(.b):hover{color:red}'],
      ['a:not(:is(.b)){color:red}'],
      ['/* comment */\na{color:red}'],
      ['a[href="x"]{color:red}'],
      ['.a{\n}\n.b{color:red}'],
    ])('detects CSS in %j', (code) => {
      expect(detectLanguage(code)).toBe('css');
    });

    it.each([
      ['const a = 1;'],
      ['function f(){return 1}'],
      ['a = {b: 1}'],
      ['console.log("x")'],
      ['if (a < b) { c() }'],
      ['const x = <div>hi</div>;'],
      ['class A { b() {} }'],
      ['export default { a: 1 }'],
      ['[1,2,3].map(x=>x*2)'],
      ['["a"].map(f)'],
      ['[{a: 1}]'],
      ['// comment\nconst a=1'],
      ['/* comment */\nexport default { a: 1 }'],
      ['foo({a: 1})'],
      ['foo.bar(function () { a: 1 })'],
      ['(function(){ return 1 })()'],
      ['{ a: 1 }'],
      ['interface A { b: string }'],
    ])('detects JavaScript in %j', (code) => {
      expect(detectLanguage(code)).toBe('javascript');
    });
  });

  describe('isValidJson', () => {
    it('accepts valid JSON and rejects invalid JSON', () => {
      expect(isValidJson('{"a": 1}')).toBe(true);
      expect(isValidJson('{"a": 1,}')).toBe(false);
    });
  });

  describe('formatCode', () => {
    const options = { indentSize: 2, wrapLength: 0 };

    it('formats HTML with its nested style and script blocks', () => {
      const code = '<div><style>a{color:red}</style><script>function x(){return 1}</script></div>';

      expect(formatCode(code, { ...options, language: 'html' })).toBe(`<div>
  <style>
    a {
      color: red
    }
  </style>
  <script>
    function x() {
      return 1
    }
  </script>
</div>`);
    });

    it('formats CSS', () => {
      expect(formatCode('a{color:red;margin:0}', { ...options, language: 'css' })).toBe(`a {
  color: red;
  margin: 0
}`);
    });

    it('formats JavaScript', () => {
      expect(formatCode('function a(){return 1}', { ...options, language: 'javascript' })).toBe(`function a() {
  return 1
}`);
    });

    it('applies the indent size', () => {
      expect(formatCode('a{color:red}', { ...options, indentSize: 4, language: 'css' })).toBe(`a {
    color: red
}`);
      expect(formatCode('{"a":1}', { ...options, indentSize: 4, language: 'json' })).toBe(`{
    "a": 1
}`);
    });

    it('applies the wrap length', () => {
      const code = 'const a = [111111111, 222222222, 333333333, 444444444];';

      expect(formatCode(code, { ...options, wrapLength: 30, language: 'javascript' })).toBe(`const a = [111111111,
  222222222, 333333333,
  444444444
];`);
    });

    it('formats JSON with one value per line', () => {
      expect(formatCode('{"a":1,"b":[1,{"c":null}],"d":{},"e":[]}', { ...options, language: 'json' })).toBe(`{
  "a": 1,
  "b": [
    1,
    {
      "c": null
    }
  ],
  "d": {},
  "e": []
}`);
    });

    it('keeps large numbers, key order, and duplicate keys in JSON', () => {
      expect(formatCode('{"b":12345678901234567890,"1":1.10,"b":2e3}', { ...options, language: 'json' })).toBe(`{
  "b": 12345678901234567890,
  "1": 1.10,
  "b": 2e3
}`);
    });

    it('keeps JSON string values unchanged', () => {
      const code = String.raw`{"a{b":"c,d:[e] \"quoted\" \\"}`;

      expect(formatCode(code, { ...options, language: 'json' })).toBe(String.raw`{
  "a{b": "c,d:[e] \"quoted\" \\"
}`);
    });

    it('throws on invalid JSON', () => {
      expect(() => formatCode('{"a":1,}', { ...options, language: 'json' })).toThrow();
    });
  });
});
