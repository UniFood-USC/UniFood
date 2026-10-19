module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/tests/ui/**/*.test.tsx', '<rootDir>/tests/student/**/*.test.ts?(x)'],
  clearMocks: true,
  // El primer render carga el runtime nativo simulado dentro de Docker.
  testTimeout: 15000,
};
