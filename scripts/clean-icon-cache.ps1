# 清理 Windows 资源管理器图标缓存（需以管理员运行效果更佳）
$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Explorer..."
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 2

$paths = @(
  "$env:LOCALAPPDATA\IconCache.db",
  "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache_*.db",
  "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db"
)

foreach ($pattern in $paths) {
  Get-ChildItem -Path $pattern -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Removing $($_.FullName)"
    Remove-Item $_.FullName -Force
  }
}

Write-Host "Refreshing icon cache..."
ie4uinit.exe -show | Out-Null

Write-Host "Restarting Explorer..."
Start-Process explorer

Write-Host "Done. Reinstall the app or recreate desktop shortcuts if icons still look old."
