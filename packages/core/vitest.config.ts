import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/transform/**/*.ts',
        'src/physics/utils.ts',
        'src/camera/camera-utils.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
