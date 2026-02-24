import eslint from '@eslint/js';
import cdkPlugin from 'eslint-plugin-cdk';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      cdk: cdkPlugin,
    },
    rules: {
      // CDK rules
      'cdk/ban-lambda-runtimes': 'off',
      'cdk/ban-reserved-words': 'error',
      'cdk/construct-ctor': 'error',
      'cdk/construct-props-struct-name': 'error',
      'cdk/filename-match-regex': 'off',
      'cdk/no-static-import': 'error',
      'cdk/prefer-type-only-imports': 'error',
      'cdk/public-static-property-all-caps': 'error',
      'cdk/stack-props-struct-name': 'error',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['node_modules/**', 'cdk.out/**', '*.js', '**/*.d.ts'],
  }
);
