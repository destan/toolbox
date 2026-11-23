import { describe, expect, it } from 'vitest';
import { markdownToHtml, markdownToPreviewHtml } from './markdown-to-html.service';

// These tests check the HTML document that the output represents, not one library's serialization.
// normalizeHtml() removes formatting differences between converters:
// whitespace between block elements, whitespace runs inside text, and entity escaping.
const BLOCK_ELEMENTS = new Set(
  'ADDRESS BLOCKQUOTE DD DIV DL DT H1 H2 H3 H4 H5 H6 HR LI OL P PRE TABLE TBODY TD TFOOT TH THEAD TR UL'.split(' '),
);

function normalizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  normalizeChildren(template.content);
  return template.innerHTML;
}

function normalizeChildren(parent: Node): void {
  for (const child of [...parent.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      normalizeText(child);
    }
    else if (child instanceof Element && child.tagName !== 'PRE') {
      normalizeChildren(child);
    }
  }
}

function normalizeText(text: Node): void {
  const value = (text.textContent ?? '').replace(/\s+/g, ' ');
  const isAtBlockBoundary = [text.previousSibling, text.nextSibling].some(
    sibling => sibling === null || (sibling instanceof Element && BLOCK_ELEMENTS.has(sibling.tagName)),
  );
  if (value === ' ' && isAtBlockBoundary) {
    text.parentNode?.removeChild(text);
    return;
  }
  text.textContent = value;
}

function parseHtml(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

const converters = [
  { name: 'markdownToHtml', convert: markdownToHtml },
  { name: 'markdownToPreviewHtml', convert: markdownToPreviewHtml },
];

describe('markdown-to-html', () => {
  describe.each(converters)('$name', ({ convert }) => {
    it('converts paragraphs, bold lead-ins, tight lists, code spans, and http and file links', () => {
      const markdown = [
        '`APP-10001` is the Jira key for [content pull request 101](https://git.example.com/projects/PROJ/repos/repo-name/pull-requests/101). You created it to add test coverage for sample calculation groups in `SAMPLE_BUSINESS_LOGIC.sqlx` ([pipeline.md](file:///c:/Users/username/workspace/project/plan/findings/pipeline.md), "Owner response and the pull request, 2026-01-15").',
        '',
        '**We planned work across three areas: the content test, the merge gate, and the SQLParser fork.**',
        '- We planned to add covering rows to `SAMPLE_UNIT_TEST` on `team/feature-a` ([pipeline.md](file:///c:/Users/username/workspace/project/plan/findings/pipeline.md), "Owner response and the pull request, 2026-01-15").',
        '- We planned to make the merge gate check called `.sqlx` files of changed tests ([038-called-files-of-changed-tests.md](file:///c:/Users/username/workspace/project/plan/decisions/038-called-files-of-changed-tests.md), "Decision").',
        '- We planned a low-priority SQLParser fork fix so Spark accepts those two `MAX` rules ([handover-alias-fix.md](file:///c:/Users/username/workspace/project/plan/handover-alias-fix.md), "Goal").',
        '',
        '**Only the low-priority SQLParser fork patch remains open in this repository.**',
        '- **Content PR:** We opened pull request 101 with the `.tab` and `.xlsx` rows. Coverage of `SAMPLE_BUSINESS_LOGIC.sqlx` rose from 20.8% to 37.5% ([pipeline.md](file:///c:/Users/username/workspace/project/plan/findings/pipeline.md), "Commit `a1b2c3d4e` added the workbook to the pull request"). `Unverified`: the Jira status of `APP-10001` after 2026-01-15. Check: read `APP-10001` in Jira. `Unverified`: whether pull request 101 merged after 2026-01-16. Check: read pull request 101 on Bitbucket.',
        '- **Merge gate:** We shipped called-file checks for changed tests ([038-called-files-of-changed-tests.md](file:///c:/Users/username/workspace/project/plan/decisions/038-called-files-of-changed-tests.md), "Decision"). We also updated the gate comment layout and wording ([040-changed-and-affected-files.md](file:///c:/Users/username/workspace/project/plan/decisions/040-changed-and-affected-files.md), "Decision", [041-gate-comment-wording.md](file:///c:/Users/username/workspace/project/plan/decisions/041-gate-comment-wording.md), "Decision").',
        '- **SQLParser fork:** We isolated the Spark bug in [SampleAliasCheck.java](file:///c:/Users/username/workspace/project/plan/experiments/SampleAliasCheck.java) ([pipeline.md](file:///c:/Users/username/workspace/project/plan/findings/pipeline.md), "Spark check of the HAVING alias rules, run on 2026-01-15"). Because `duckdb` is the default rule engine, the fork patch has not started ([handover-alias-fix.md](file:///c:/Users/username/workspace/project/plan/handover-alias-fix.md), "Start it only when the user asks for it").',
        '',
      ].join('\n');

      const expectedHtml = [
        '<p><code>APP-10001</code> is the Jira key for <a href="https://git.example.com/projects/PROJ/repos/repo-name/pull-requests/101">content pull request 101</a>. You created it to add test coverage for sample calculation groups in <code>SAMPLE_BUSINESS_LOGIC.sqlx</code> (<a href="file:///c:/Users/username/workspace/project/plan/findings/pipeline.md">pipeline.md</a>, "Owner response and the pull request, 2026-01-15").</p>',
        '<p><strong>We planned work across three areas: the content test, the merge gate, and the SQLParser fork.</strong></p>',
        '<ul>',
        '<li>We planned to add covering rows to <code>SAMPLE_UNIT_TEST</code> on <code>team/feature-a</code> (<a href="file:///c:/Users/username/workspace/project/plan/findings/pipeline.md">pipeline.md</a>, "Owner response and the pull request, 2026-01-15").</li>',
        '<li>We planned to make the merge gate check called <code>.sqlx</code> files of changed tests (<a href="file:///c:/Users/username/workspace/project/plan/decisions/038-called-files-of-changed-tests.md">038-called-files-of-changed-tests.md</a>, "Decision").</li>',
        '<li>We planned a low-priority SQLParser fork fix so Spark accepts those two <code>MAX</code> rules (<a href="file:///c:/Users/username/workspace/project/plan/handover-alias-fix.md">handover-alias-fix.md</a>, "Goal").</li>',
        '</ul>',
        '<p><strong>Only the low-priority SQLParser fork patch remains open in this repository.</strong></p>',
        '<ul>',
        '<li><strong>Content PR:</strong> We opened pull request 101 with the <code>.tab</code> and <code>.xlsx</code> rows. Coverage of <code>SAMPLE_BUSINESS_LOGIC.sqlx</code> rose from 20.8% to 37.5% (<a href="file:///c:/Users/username/workspace/project/plan/findings/pipeline.md">pipeline.md</a>, "Commit <code>a1b2c3d4e</code> added the workbook to the pull request"). <code>Unverified</code>: the Jira status of <code>APP-10001</code> after 2026-01-15. Check: read <code>APP-10001</code> in Jira. <code>Unverified</code>: whether pull request 101 merged after 2026-01-16. Check: read pull request 101 on Bitbucket.</li>',
        '<li><strong>Merge gate:</strong> We shipped called-file checks for changed tests (<a href="file:///c:/Users/username/workspace/project/plan/decisions/038-called-files-of-changed-tests.md">038-called-files-of-changed-tests.md</a>, "Decision"). We also updated the gate comment layout and wording (<a href="file:///c:/Users/username/workspace/project/plan/decisions/040-changed-and-affected-files.md">040-changed-and-affected-files.md</a>, "Decision", <a href="file:///c:/Users/username/workspace/project/plan/decisions/041-gate-comment-wording.md">041-gate-comment-wording.md</a>, "Decision").</li>',
        '<li><strong>SQLParser fork:</strong> We isolated the Spark bug in <a href="file:///c:/Users/username/workspace/project/plan/experiments/SampleAliasCheck.java">SampleAliasCheck.java</a> (<a href="file:///c:/Users/username/workspace/project/plan/findings/pipeline.md">pipeline.md</a>, "Spark check of the HAVING alias rules, run on 2026-01-15"). Because <code>duckdb</code> is the default rule engine, the fork patch has not started (<a href="file:///c:/Users/username/workspace/project/plan/handover-alias-fix.md">handover-alias-fix.md</a>, "Start it only when the user asks for it").</li>',
        '</ul>',
      ].join('\n');

      expect(normalizeHtml(convert(markdown))).toBe(normalizeHtml(expectedHtml));
    });

    it('renders file: links in any letter case', () => {
      expect(normalizeHtml(convert('[notes](FILE:///home/user/notes.md)'))).toBe(
        normalizeHtml('<p><a href="FILE:///home/user/notes.md">notes</a></p>'),
      );
    });

    it('does not render javascript:, vbscript:, or non-image data: links', () => {
      const html = convert([
        '[a](javascript:alert(1))',
        '[b](vbscript:msgbox)',
        '[c](data:text/html;base64,PHNjcmlwdD4=)',
        '![d](javascript:alert(1))',
      ].join('\n\n'));
      const fragment = parseHtml(html);

      const unsafeUrls = [...fragment.querySelectorAll('[href], [src]')]
        .map(element => element.getAttribute('href') ?? element.getAttribute('src') ?? '')
        .filter(url => /^(?:javascript|vbscript|data):/i.test(url.trim()));
      expect(unsafeUrls).toEqual([]);
    });

    it('renders data: image links', () => {
      const image = parseHtml(convert('![dot](data:image/png;base64,iVBORw0KGgo=)')).querySelector('img');

      expect(image?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
      expect(image?.getAttribute('alt')).toBe('dot');
    });

    it('renders fenced code blocks with the language class and the code text', () => {
      const code = parseHtml(convert('```js\nconst x = 1;\n```')).querySelector('pre > code');

      expect(code?.classList.contains('language-js')).toBe(true);
      expect(code?.textContent).toBe('const x = 1;\n');
    });
  });
});
