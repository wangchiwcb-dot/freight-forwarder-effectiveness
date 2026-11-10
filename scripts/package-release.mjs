import { mkdtemp, mkdir, chmod, cp, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(new URL('..', import.meta.url).pathname);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const output = join(root, 'artifacts');
const staging = await mkdtemp(join(tmpdir(), 'freight-release-'));
try {
  // mkdtemp defaults to 0700; deployed non-root services must traverse the archive root.
  await chmod(staging, 0o755);
  await mkdir(output, { recursive: true });
  for (const name of ['dist', 'database', 'deploy'])
    await cp(join(root, name), join(staging, name), { recursive: true });
  for (const name of ['package.json', 'package-lock.json', '.env.example', 'README.md'])
    await copyFile(join(root, name), join(staging, name));
  await mkdir(join(staging, 'docs'));
  for (const name of ['api.md', 'runbook.md', 'deployment.md'])
    await copyFile(join(root, 'docs', name), join(staging, 'docs', name));
  const name = `freight-times-${pkg.version}.tar.gz`;
  execFileSync('tar', ['--no-xattrs', '-czf', join(output, name), '-C', staging, '.'], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  const hash = createHash('sha256')
    .update(await readFile(join(output, name)))
    .digest('hex');
  await writeFile(join(output, `${name}.sha256`), `${hash}  ${name}\n`);
  console.log(`Built ${name} (SHA-256 ${hash})`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
