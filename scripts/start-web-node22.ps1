$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$web = Join-Path $root "apps\web"
$tools = Join-Path $root ".tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null

$nodeDir = Get-ChildItem -Path $tools -Directory -Filter "node-v22.*-win-x64" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $nodeDir) {
  $indexUrl = "https://nodejs.org/dist/latest-v22.x/"
  $html = Invoke-WebRequest -Uri $indexUrl -UseBasicParsing
  $match = [regex]::Match($html.Content, "node-v22\.[0-9]+\.[0-9]+-win-x64\.zip")
  if (-not $match.Success) {
    throw "Could not find the latest Node 22 Windows x64 archive."
  }

  $file = $match.Value
  $zipPath = Join-Path $tools $file
  Invoke-WebRequest -Uri ($indexUrl + $file) -OutFile $zipPath
  Expand-Archive -LiteralPath $zipPath -DestinationPath $tools -Force
  $nodeDir = Get-Item (Join-Path $tools ($file -replace "\.zip$", ""))
}

$node = Join-Path $nodeDir.FullName "node.exe"
$nextBin = Join-Path $root "node_modules\next\dist\bin\next"
$out = Join-Path $web ".growth-os-dev.out.log"
$err = Join-Path $web ".growth-os-dev.err.log"

$listeners = netstat -ano | Select-String ":3000\s+.*LISTENING"
foreach ($line in $listeners) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
  if ($parts.Length -gt 0) {
    Stop-Process -Id ([int]$parts[-1]) -Force -ErrorAction SilentlyContinue
  }
}

$nextPath = Join-Path $web ".next"
if (Test-Path $nextPath) {
  $resolvedNext = (Resolve-Path $nextPath).Path
  if ($resolvedNext -like "$web*") {
    Get-ChildItem -LiteralPath $resolvedNext -Recurse -Force -ErrorAction SilentlyContinue |
      ForEach-Object { $_.Attributes = "Normal" }
    Remove-Item -LiteralPath $resolvedNext -Recurse -Force
  } else {
    throw "Refusing to remove unexpected path: $resolvedNext"
  }
}

Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue
$env:NODE_ENV = "development"
$args = '"' + $nextBin + '" dev -p 3000 -H 127.0.0.1'
Start-Process -FilePath $node -ArgumentList $args -WorkingDirectory $web -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden

Write-Host "Started HomeReach web on http://127.0.0.1:3000 using $(& $node -v)"
