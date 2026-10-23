import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const baseDirectory = fileURLToPath(new URL('.', import.meta.url));
const compatibility = new FlatCompat({ baseDirectory });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'e2e/platform-cinematic/**'] },
  ...compatibility.extends('next/core-web-vitals'),
];
