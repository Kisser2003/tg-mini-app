import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": "."
    }
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "app/api/**/*.ts",
        "lib/**/*.ts",
        "repositories/**/*.ts"
      ]
    }
  }
});
