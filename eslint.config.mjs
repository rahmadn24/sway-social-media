import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // The remaining fetch/reset effects in this app call setState
      // synchronously on purpose (initial loading flags, clearing stale filters,
      // closing the mobile sidebar on navigation). Rewriting them all to
      // Suspense + use() would be a large behavioural change, so they stay
      // visible as warnings instead of failing the lint run.
      'react-hooks/set-state-in-effect': 'warn',
      // Legacy rule aimed at pages/_document; in the App Router the root layout
      // renders on every route, so a <link> there loads the font site-wide.
      '@next/next/no-page-custom-font': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Local workspace data and generated files:
    'data/**',
    'public/uploads/**',
  ]),
]);

export default eslintConfig;
