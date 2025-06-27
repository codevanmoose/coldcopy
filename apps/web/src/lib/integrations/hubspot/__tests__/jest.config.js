const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: '../../../../',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  displayName: 'HubSpot Integration Tests',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../../../src/$1',
    '^@/lib/(.*)$': '<rootDir>/../../../../src/lib/$1',
    '^@/components/(.*)$': '<rootDir>/../../../../src/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/../../../../src/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/../../../../src/types/$1',
  },
  collectCoverageFrom: [
    '../**/*.{ts,tsx}',
    '!../**/*.d.ts',
    '!../**/__tests__/**',
    '!../types.ts', // Type definitions don't need coverage
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 10000,
  verbose: true,
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);