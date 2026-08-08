import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Never lint build output, generated native web assets, SQL, or vendored copies. Keeping these
  // out of scope is what stops `eslint .` from ballooning into hundreds of phantom errors.
  globalIgnores([
    'dist/**',
    'dev-dist/**',
    'android/**',
    'ios/**',
    'supabase/**',
    '**/*.min.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Correctness rules stay ERRORS (fail CI). The following are strict/stylistic rules from the
      // newest react-hooks + react-refresh presets — they flag pre-existing acceptable patterns
      // (timer effects, exporting constants beside a component) rather than bugs, so they are
      // WARNINGS: visible in `npm run lint` output, but they do not fail the build/CI. Revisit and
      // refactor these incrementally; do not let real errors hide behind them.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
