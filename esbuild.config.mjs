import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const banner = {
  js: `/**
 * wakesys Booking Plugin v${pkg.version}
 * Copyright (c) 2026 wakesys s.à.r.l.
 * Licensed under GPL-3.0
 * https://github.com/wakesys/wakesys-booking-plugin
 */`,
};

const shared = { bundle: true, platform: 'browser', target: ['es2017'], banner, sourcemap: true };

await esbuild.build({
  ...shared,
  entryPoints: ['src/iife-auto.ts'],
  outfile: 'dist/plugin.js',
  format: 'iife',
  minify: true,
});

await esbuild.build({
  ...shared,
  entryPoints: ['src/core/index.ts'],
  outfile: 'dist/index.mjs',
  format: 'esm',
});

await esbuild.build({
  ...shared,
  entryPoints: ['src/react.tsx'],
  outfile: 'dist/react.mjs',
  format: 'esm',
  external: ['react', 'react-dom'],
});

console.log(`built v${pkg.version}`);
