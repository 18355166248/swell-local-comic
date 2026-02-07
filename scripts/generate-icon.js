import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import toIco from "to-ico";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconsDir = join(__dirname, "..", "src-tauri", "icons");

// 读取多个尺寸的 PNG 文件来生成 ICO
// ICO 文件通常包含多个尺寸以获得最佳显示效果
const sizes = [16, 32, 48, 64, 128, 256];
const pngBuffers = [];

console.log("🖼️  正在读取 PNG 图标文件...");

for (const size of sizes) {
  const pngPath = join(iconsDir, `${size}x${size}.png`);
  try {
    const buffer = readFileSync(pngPath);
    pngBuffers.push(buffer);
    console.log(`✅ 已读取 ${size}x${size}.png`);
  } catch (error) {
    console.warn(`⚠️  无法读取 ${size}x${size}.png，跳过此尺寸`);
  }
}

if (pngBuffers.length === 0) {
  console.error("❌ 没有找到任何 PNG 图标文件！");
  process.exit(1);
}

console.log("🔨 正在生成 icon.ico 文件...");

// 生成 ICO 文件
toIco(pngBuffers)
  .then((buf) => {
    const icoPath = join(iconsDir, "icon.ico");
    writeFileSync(icoPath, buf);
    console.log(`✅ 成功生成 icon.ico 文件: ${icoPath}`);
    console.log(`📦 文件大小: ${(buf.length / 1024).toFixed(2)} KB`);
  })
  .catch((error) => {
    console.error("❌ 生成 ICO 文件失败:", error);
    process.exit(1);
  });
