import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Testy na wspólnej bazie (tests/db, tests/demo) nie mogą działać równolegle – seed demo czyści dane.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
