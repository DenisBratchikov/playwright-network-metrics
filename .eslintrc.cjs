module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  plugins: ['import'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'import/no-unresolved': 'off',
    'import/extensions': 'off'
  },
};
