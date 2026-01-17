module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // Enforce explicit types - no 'any'
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Require explicit return types on functions
    '@typescript-eslint/explicit-function-return-type': 'warn',
    
    // Require explicit accessibility modifiers
    '@typescript-eslint/explicit-member-accessibility': 'off',
    
    // Disallow non-null assertions
    '@typescript-eslint/no-non-null-assertion': 'error',
    
    // Require interfaces for object types
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    
    // Naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
    ],
    
    // No unused variables
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // No console.log (use NestJS Logger)
    'no-console': 'error',
  },
};
