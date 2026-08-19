module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  // @noble/hashes (via @stellar/stellar-sdk) ships ESM-only; compile it to
  // CJS with ts-jest so the suite can load the SDK.
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  // pnpm nests real packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>,
  // so the exempted-package check has to allow an optional .pnpm hop before matching,
  // or it fires (and wrongly ignores the file) on the outer node_modules/.pnpm segment.
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!(\\.pnpm[\\\\/])?(@noble[\\\\/+]|uint8array-extras))',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
};
