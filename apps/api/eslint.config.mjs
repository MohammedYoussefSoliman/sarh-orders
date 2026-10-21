import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'prisma/migrations'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Deliberately OFF. NestJS resolves constructor dependencies from the
      // metadata `emitDecoratorMetadata` writes, which needs the *value*
      // import to survive compilation. Rewriting an injected class to
      // `import type` erases it and breaks DI at runtime, so this rule's
      // autofix is actively unsafe here.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
