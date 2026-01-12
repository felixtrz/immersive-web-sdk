import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/physics/physics-utils.ts', 'src/physics/math-utils.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
