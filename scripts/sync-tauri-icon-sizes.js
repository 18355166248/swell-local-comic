import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "src-tauri", "icons");
const sourceIcon = join(__dirname, "..", "swell-local-comic-icon.png");

if (existsSync(join(iconsDir, "128x128@2x.png"))) {
  copyFileSync(join(iconsDir, "128x128@2x.png"), join(iconsDir, "256x256.png"));
  console.log("Synced 256x256.png from 128x128@2x.png");
}

if (existsSync(sourceIcon)) {
  copyFileSync(sourceIcon, join(iconsDir, "1024x1024.png"));
  console.log("Synced 1024x1024.png from swell-local-comic-icon.png");
}

const publicDir = join(__dirname, "..", "public");
const publicIcon = join(publicDir, "app-icon.png");
const icon64 = join(iconsDir, "64x64.png");
if (existsSync(icon64)) {
  mkdirSync(publicDir, { recursive: true });
  copyFileSync(icon64, publicIcon);
  console.log("Synced public/app-icon.png from 64x64.png");
}
