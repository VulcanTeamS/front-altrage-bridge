import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: {
      '@altrage/bridge-core': path.resolve(__dirname, '../core/src'),
    },
  },
});
