param(
  [string]$Version = ""   # e.g. 1.0.1 ; used for the OTA manifest
)
$ErrorActionPreference = "Stop"
$mobile = $PSScriptRoot
$out = Join-Path (Split-Path $mobile -Parent) "apk"
New-Item -ItemType Directory -Force $out | Out-Null

# Use JDK 21 bundled with Android Studio (system Java 25 breaks Gradle 8.9)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Set-Location $mobile
npm run build
if ($LASTEXITCODE) { exit 1 }
npx cap sync android
Push-Location android
.\gradlew.bat assembleDebug
if ($LASTEXITCODE) { exit 1 }
Pop-Location
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "$out\VtopC.apk" -Force

# OTA bundle (zip of dist) + manifest
if ($Version) {
  Compress-Archive -Path "dist\*" -DestinationPath "$out\bundle-$Version.zip" -Force
  @{ version = $Version; url = "https://vtopcc.klouds.online/ota/bundle-$Version.zip" } |
    ConvertTo-Json | Set-Content "$out\version.json"
  Write-Host "OTA files: $out\bundle-$Version.zip and version.json"
}
Write-Host "Done -> $out\VtopC.apk"
