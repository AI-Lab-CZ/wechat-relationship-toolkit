$ErrorActionPreference = "Stop"

$Workspace = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$WebApp = Join-Path $Workspace "apps\export-ui"
$LogDir = Join-Path $Workspace "output"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$existing = netstat -ano | Select-String ":4789" | Select-String "LISTENING"
if (-not $existing) {
    Start-Process -FilePath node.exe `
        -ArgumentList @("server.js") `
        -WorkingDirectory $WebApp `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $LogDir "webapp-server.log") `
        -RedirectStandardError (Join-Path $LogDir "webapp-server.err.log")
    Start-Sleep -Seconds 2
}

Start-Process "http://127.0.0.1:4789"
