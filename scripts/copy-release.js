import { existsSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// 获取当前文件的目录路径（ES Module 中 __dirname 的等价物）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 源目录：Tauri 默认的打包输出目录
const sourceDir = join(
  __dirname,
  "..",
  "src-tauri",
  "target",
  "release",
  "bundle"
);
// 目标目录：根目录下的 release 文件夹
const targetDir = join(__dirname, "..", "release");

// 检查源目录是否存在
if (!existsSync(sourceDir)) {
  console.error("❌ 打包输出目录不存在:", sourceDir);
  console.error("请先运行 tauri build 命令");
  process.exit(1);
}

// 如果目标目录已存在，先删除
if (existsSync(targetDir)) {
  console.log("🗑️  删除旧的 release 目录...");
  rmSync(targetDir, { recursive: true, force: true });
}

// 复制整个 bundle 目录到 release
console.log("📦 复制打包结果到 release 目录...");
cpSync(sourceDir, targetDir, { recursive: true });

console.log("✅ 打包结果已复制到:", targetDir);
console.log("📁 您可以在根目录的 release 文件夹中找到打包结果");
