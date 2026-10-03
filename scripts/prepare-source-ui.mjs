import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/prepare-source-ui.mjs <path-to-v78.html>');
const source = await readFile(resolve(sourcePath), 'utf8');
await mkdir('private/reference', { recursive: true });
for (const kind of ['ijr', 'regional', 'corporate']) {
  const template = source.match(new RegExp('<template[^>]+id=["\x27]tpl-' + kind + '["\x27][^>]*>([\\s\\S]*?)</template>', 'i'))?.[1];
  if (!template) throw new Error(`Missing ${kind} template in source HTML`);
  await writeFile(`private/reference/${kind}-preview.html`, template);
}
console.log('Private local source UI fixtures prepared for Playwright comparison. Do not publish these files.');
