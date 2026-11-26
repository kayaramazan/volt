/**
 * Pretty-print a JSON request body. Unquoted `{{variable}}` templates (e.g.
 * `{"id": {{userId}}}`) aren't valid JSON, so they're swapped for string
 * sentinels before parsing and restored verbatim afterwards. Templates inside
 * string literals are left alone — they're already valid JSON.
 *
 * Throws (SyntaxError) when the body isn't JSON even after the swap.
 */
export function beautifyJson(text: string, indent = 2): string {
  const templates: string[] = [];
  let masked = '';
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      masked += ch;
      if (ch === '\\') {
        masked += text[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      masked += ch;
      continue;
    }
    if (ch === '{' && text[i + 1] === '{') {
      const end = text.indexOf('}}', i + 2);
      if (end !== -1) {
        templates.push(text.slice(i, end + 2));
        masked += JSON.stringify(sentinel(templates.length - 1));
        i = end + 1;
        continue;
      }
    }
    masked += ch;
  }

  const pretty = JSON.stringify(JSON.parse(masked), null, indent);
  if (templates.length === 0) return pretty;
  // JSON.stringify escapes the NUL bytes, so match the escaped form.
  return pretty.replace(/"\\u0000VOLT_VAR_(\d+)\\u0000"/g, (_, n: string) => templates[Number(n)]!);
}

function sentinel(n: number): string {
  return `\u0000VOLT_VAR_${n}\u0000`;
}
