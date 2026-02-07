import { existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { platform } from "os";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, "..");
const tauriDir = join(rootDir, "src-tauri");
const targetDir = join(tauriDir, "target");
const distDir = join(rootDir, "dist");
const releaseDir = join(rootDir, "release");

console.log("🧹 开始清理缓存...\n");

// 清理 Tauri target 目录
if (existsSync(targetDir)) {
  console.log("🗑️  清理 Tauri 构建缓存 (target)...");
  try {
    rmSync(targetDir, { recursive: true, force: true });
    console.log("✅ 已清理 target 目录\n");
  } catch (error) {
    console.error("❌ 清理 target 目录失败:", error.message);
    console.log("💡 提示: 如果文件被占用，请关闭正在运行的应用后重试\n");
  }
} else {
  console.log("ℹ️  target 目录不存在，跳过\n");
}

// 清理前端构建目录
if (existsSync(distDir)) {
  console.log("🗑️  清理前端构建缓存 (dist)...");
  try {
    rmSync(distDir, { recursive: true, force: true });
    console.log("✅ 已清理 dist 目录\n");
  } catch (error) {
    console.error("❌ 清理 dist 目录失败:", error.message);
  }
} else {
  console.log("ℹ️  dist 目录不存在，跳过\n");
}

// 清理 release 目录
if (existsSync(releaseDir)) {
  console.log("🗑️  清理 release 目录...");
  try {
    rmSync(releaseDir, { recursive: true, force: true });
    console.log("✅ 已清理 release 目录\n");
  } catch (error) {
    console.error("❌ 清理 release 目录失败:", error.message);
  }
} else {
  console.log("ℹ️  release 目录不存在，跳过\n");
}

console.log("✅ 项目缓存清理完成！");

// Windows 系统提示
if (platform() === "win32") {
  const iconCacheScript = join(__dirname, "clean-icon-cache.ps1");
  console.log("\n💡 Windows 图标缓存清理:");
  console.log("   如果应用图标仍未更新，请运行以下命令清理 Windows 图标缓存:");
  console.log(`   powershell -ExecutionPolicy Bypass -File "${iconCacheScript}"`);
  console.log("\n   或者手动执行以下步骤:");
  console.log("   1. 重启资源管理器: 任务管理器 -> 重启 Windows 资源管理器");
  console.log("   2. 清理图标缓存: 以管理员身份运行 PowerShell，执行:");
  console.log("      ie4uinit.exe -show");
  console.log("   3. 删除图标缓存文件:");
  console.log("      - %LocalAppData%\\IconCache.db");
  console.log("      - %LocalAppData%\\Microsoft\\Windows\\Explorer\\iconcache*.db");
  console.log("   4. 重新安装应用以更新图标");
}
