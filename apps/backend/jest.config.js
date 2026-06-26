/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    // Resolve workspace-absolute imports like 'apps/backend/prisma/...'
    '^apps/backend/(.*)$': '<rootDir>/../$1',
    // Resolve @app/contracts to its built dist
    '^@app/contracts$': '<rootDir>/../../packages/contracts/dist/index.js',
    '^@app/contracts/(.*)$': '<rootDir>/../../packages/contracts/dist/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  reporters: [
    'default',
    ['jest-html-reporters', { publicPath: '../test-report', filename: 'index.html', openReport: false }],
  ],
};
