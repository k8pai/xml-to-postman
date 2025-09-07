import { readdirSync } from "fs";
import { join } from "path";
import { defineConfig } from "tsup";

// Include only allowed folders/files in prod
const includeFolders = ["lib", "scripts"];
const entries = includeFolders.flatMap((folder) => {
  const fullPath = join("src", folder);
  return readdirSync(fullPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".json"))
    .map((file) => `${fullPath}/${file}`);
});

export default defineConfig({
  entry: ["src/index.ts", "src/types.ts", ...entries],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true, // Useful for debugging
  splitting: false, // Disable code splitting (good for libs)
  outDir: "dist",
  target: "es2022",
  skipNodeModulesBundle: true,
  shims: true,
});
