module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/setup.js'],
  moduleFileExtensions: ['js', 'json'],
  // 微信小程序模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
}
