import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: ':memory:',
      JWT_SECRET: 'test-secret-vitest-12345',
      NODE_ENV: 'test',
    },
  },
});
