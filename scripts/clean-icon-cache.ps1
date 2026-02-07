# Windows 图标缓存清理脚本
# 需要管理员权限运行

Write-Host "🧹 开始清理 Windows 图标缓存..." -ForegroundColor Cyan

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 需要管理员权限！" -ForegroundColor Red
    Write-Host "💡 请右键点击 PowerShell，选择'以管理员身份运行'，然后执行此脚本" -ForegroundColor Yellow
    exit 1
}

# 停止资源管理器进程（会重启）
Write-Host "🔄 正在重启 Windows 资源管理器..." -ForegroundColor Yellow
Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 清理图标缓存文件
$cachePaths = @(
    "$env:LOCALAPPDATA\IconCache.db",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*.db",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db"
)

$cleaned = 0
foreach ($path in $cachePaths) {
    $files = Get-ChildItem -Path $path -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        try {
            Remove-Item -Path $file.FullName -Force -ErrorAction Stop
            Write-Host "✅ 已删除: $($file.FullName)" -ForegroundColor Green
            $cleaned++
        } catch {
            Write-Host "⚠️  无法删除: $($file.FullName) - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# 重建图标缓存
Write-Host "`n🔨 正在重建图标缓存..." -ForegroundColor Yellow
try {
    ie4uinit.exe -show
    Write-Host "✅ 图标缓存已重建" -ForegroundColor Green
} catch {
    Write-Host "⚠️  无法运行 ie4uinit.exe，请手动运行: ie4uinit.exe -show" -ForegroundColor Yellow
}

Write-Host "`n✅ Windows 图标缓存清理完成！" -ForegroundColor Green
Write-Host "💡 如果图标仍未更新，请重启计算机" -ForegroundColor Cyan
