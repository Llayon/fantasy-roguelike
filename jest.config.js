module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts', '!**/index.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/core/$1',
    '^@simulator/(.*)$': '<rootDir>/simulator/$1',
    '^@roguelike/(.*)$': '<rootDir>/roguelike/$1',
    '^@game/(.*)$': '<rootDir>/game/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
  },
  // Property-based testing configuration
  testTimeout: 30000, // 30 seconds for PBT tests
  verbose: true,
};
