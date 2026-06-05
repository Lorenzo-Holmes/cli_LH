import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const desktopRoot = resolve(__dirname, "..");
const target = process.env.TAURI_TARGET_TRIPLE ?? "x86_64-pc-windows-msvc";
const extension = process.platform === "win32" ? ".exe" : "";
const outputName = `cli_LH-${target}${extension}`;
const outputPath = resolve(desktopRoot, "src-tauri", "binaries", outputName);
const tempPath = resolve(desktopRoot, "src-tauri", "binaries", `cli_LH-build${extension}`);

mkdirSync(dirname(outputPath), { recursive: true });
execFileSync("go", ["build", "-o", tempPath, "./cmd/server"], { cwd: repoRoot, stdio: "inherit" });

if (!existsSync(tempPath)) {
  throw new Error(`Go build did not create ${tempPath}`);
}

copyFileSync(tempPath, outputPath);
console.log(`Prepared sidecar: ${outputPath}`);