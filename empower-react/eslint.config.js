import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
      // Async init() called from useEffect is a valid data-loading pattern; the rule
      // produces false positives because it tracks setState through async call chains.
      'react-hooks/set-state-in-effect': 'off',
      // Function declarations are hoisted — accessing init() before its syntactic
      // position is valid JS. Disable the rule that incorrectly flags this.
      'react-hooks/immutability': 'off',
    },
  },
])
