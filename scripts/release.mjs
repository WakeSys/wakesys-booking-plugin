import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('usage: npm run release -- <x.y.z>');
  process.exit(1);
}

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim();

if (out('git status --porcelain')) throw new Error('working tree is dirty');
if (out('git rev-parse --abbrev-ref HEAD') !== 'main') throw new Error('not on main');

// --allow-same-version: package.json may already be at the version being
// released (e.g. re-running a release after a failed CDN verification), and
// that must not be treated as an error.
sh(`npm version ${version} --no-git-tag-version --allow-same-version`);
sh('npm run build');
sh('npm test');

// Keep the documented CDN URL in step with the version being tagged.
const readme = readFileSync('README.md', 'utf-8').replace(
  /wakesys-booking-plugin@\d+\.\d+\.\d+\//g,
  `wakesys-booking-plugin@${version}/`,
);
writeFileSync('README.md', readme);

sh('git add package.json dist README.md CHANGELOG.md');
sh(`git commit -m "release: v${version}"`);
sh(`git tag v${version}`);
sh('git push && git push --tags');
sh('npm publish --provenance');

const url = `https://cdn.jsdelivr.net/gh/wakesys/wakesys-booking-plugin@${version}/dist/plugin.js`;
for (let i = 1; i <= 10; i++) {
  const res = await fetch(url);
  if (res.ok && (await res.text()).includes(`v${version}`)) {
    console.log(`CDN verified: ${url}`);
    process.exit(0);
  }
  console.log(`CDN not ready (attempt ${i}/10), retrying...`);
  await new Promise((r) => setTimeout(r, 6000));
}
throw new Error(`CDN did not serve v${version} — the tag may not have pushed`);
