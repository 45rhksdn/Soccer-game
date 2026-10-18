import { defineConfig } from "vitest/config";
export default defineConfig({
  // On GitHub Actions failures are also reported as annotations (readable from the PR / checks API).
  test: { maxWorkers: 2, include: ["tests/*.test.ts"], testTimeout: 180000, reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"] },
});
