import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
const files = ['api/config.js', 'api/captcha/verify.js', 'lib/validation.js'];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', new URL(`../${file}`, import.meta.url).pathname], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.stdout}`);
}
const html = await readFile(new URL('../final_frontend.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 1 || !html.includes('</html>')) throw new Error('Frontend document structure is incomplete.');
new vm.Script(scripts[0][1], { filename: 'final_frontend.html' });
console.log('JavaScript syntax and frontend document checks passed.');
