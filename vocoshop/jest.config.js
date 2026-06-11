module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?expo|@react-native|expo|@expo|react-navigation|@react-navigation|react-native-svg)/'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': '<rootDir>/../node_modules/react',
    '^react-native$': '<rootDir>/../node_modules/react-native'
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  moduleDirectories: ['node_modules', '<rootDir>']
};