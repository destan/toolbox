import beautify from 'js-beautify';

export { detectLanguage, formatCode, isValidJson };
export type { CodeLanguage, FormatCodeOptions };

type CodeLanguage = 'html' | 'css' | 'javascript' | 'json';

interface FormatCodeOptions {
  language: CodeLanguage
  indentSize: number
  wrapLength: number
}

const leadingCommentsRegex = /^(?:\s|\/\*[\s\S]*?\*\/|\/\/.*)+/;
const jsonLikeStartRegex = /^(?:\{\s*["}]|\[\s*(?:["[\]]|\{\s*"))/;
const jsonLikeEndRegex = /[\]}]$/;
const htmlStartRegex = /^<(?:!doctype|!--|\/?[a-z][\w-]*[\s/>])/i;
const javascriptStartRegex = /^(?:abstract|async|await|class|const|declare|enum|export|for|function|if|import|interface|let|namespace|new|return|switch|try|type|var|while)\b/;
const cssAtRuleStartRegex = /^@(?:charset|container|font-face|import|keyframes|layer|media|namespace|page|supports)\b/;
const cssRuleStartRegex = /^[^{}=;"'`(]+\{\s*(?:[\w-]+\s*:[^{}]*[};]|\})/;
const jsonTokenRegex = /"[^"\\]*(?:\\.[^"\\]*)*"|[{}[\],:]|[^\s{}[\],:"]+/g;

function removeParenthesizedGroups(code: string): string {
  const withoutGroups = code.replace(/\([^()]*\)/g, '');

  return withoutGroups === code ? code : removeParenthesizedGroups(withoutGroups);
}

function isCssRule(code: string): boolean {
  // Selectors can contain brackets and parentheses, for example a[href="x"] and a:not(.b).
  return cssRuleStartRegex.test(removeParenthesizedGroups(code.replace(/\[[^\]]*\]/g, '')));
}

function isValidJson(code: string): boolean {
  try {
    JSON.parse(code);
    return true;
  }
  catch {
    return false;
  }
}

function detectLanguage(rawCode: string): CodeLanguage | undefined {
  const code = rawCode.trim();

  if (code === '') {
    return undefined;
  }

  if (isValidJson(code) || (jsonLikeStartRegex.test(code) && jsonLikeEndRegex.test(code))) {
    return 'json';
  }

  const codeWithoutLeadingComments = code.replace(leadingCommentsRegex, '');

  if (htmlStartRegex.test(codeWithoutLeadingComments)) {
    return 'html';
  }

  if (javascriptStartRegex.test(codeWithoutLeadingComments)) {
    return 'javascript';
  }

  if (cssAtRuleStartRegex.test(codeWithoutLeadingComments) || isCssRule(codeWithoutLeadingComments)) {
    return 'css';
  }

  return 'javascript';
}

// JSON.stringify(JSON.parse(code)) would round large numbers, reorder integer-like keys, and drop duplicate keys.
function formatJson(code: string, indentSize: number): string {
  JSON.parse(code);

  const tokens = code.match(jsonTokenRegex) ?? [];
  const getLineBreak = (depth: number) => `\n${' '.repeat(indentSize * depth)}`;

  let formattedCode = '';
  let depth = 0;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (token === '{' || token === '[') {
      const nextToken = tokens[index + 1];

      if (nextToken === '}' || nextToken === ']') {
        formattedCode += token + nextToken;
        index++;
      }
      else {
        depth++;
        formattedCode += token + getLineBreak(depth);
      }
    }
    else if (token === '}' || token === ']') {
      depth--;
      formattedCode += getLineBreak(depth) + token;
    }
    else if (token === ',') {
      formattedCode += token + getLineBreak(depth);
    }
    else if (token === ':') {
      formattedCode += ': ';
    }
    else {
      formattedCode += token;
    }
  }

  return formattedCode;
}

function formatCode(code: string, { language, indentSize, wrapLength }: FormatCodeOptions): string {
  if (language === 'json') {
    return formatJson(code, indentSize);
  }

  const options = { indent_size: indentSize, wrap_line_length: wrapLength };

  if (language === 'html') {
    return beautify.html(code, options);
  }

  if (language === 'css') {
    return beautify.css(code, options);
  }

  return beautify.js(code, options);
}
