import { configDefaults, defineConfig } from "vitest/config";
import path from "path";
import { assertSafeTestDatabaseUrl } from "./scripts/test-environment";

assertSafeTestDatabaseUrl();

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      exclude: [
        "src/tests/**",
        "src/generated/**",
        "src/config/**",
        // Interactive presentation is exercised by Playwright. Hooks, reducers,
        // API modules, services and pure TypeScript remain in the Vitest scope.
        "src/features/**/*.tsx",
        "src/components/ui/**/*.tsx",
        "scripts/test-*.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
