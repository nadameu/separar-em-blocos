export default function generateMetadataHeader(
  obj: Record<string, string | RegExp | string[] | RegExp>
): string {
  const pairs = Object.entries(obj).flatMap(([key, value]) => {
    switch (typeof value) {
      case 'string':
        return [{ key, value }];

      case 'object': {
        if (Array.isArray(value)) return value.map(v => ({ key, value: v }));
        // break omitido
      }

      default:
        return [{ key, value: String(value) }];
    }
  });

  const keyLength = pairs.reduce((curr, { key: { length } }) => (length > curr ? length : curr), 0);

  const lines = pairs.map(({ key, value }) => `// @${key.padEnd(keyLength, ' ')}  ${value}`);
  return `// ==UserScript==\n${lines.join('\n')}\n// ==/UserScript==`;
}
