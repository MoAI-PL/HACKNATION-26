import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // JSX jak w Next.js (automatyczny runtime) – potrzebne m.in. do testu PDF arkusza (Z16).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Testy na wspólnej bazie (tests/db, tests/demo) nie mogą działać równolegle – seed demo czyści dane.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
