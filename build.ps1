# ============================================================
#  build.ps1 - one command, two products.
#
#    (1) the Android app:  app\src\  ->  app\www\index.html   (Capacitor webDir)
#    (2) the public site:  site\     ->  public\              (what Vercel serves)
#
#  Run it from anywhere:  powershell -ExecutionPolicy Bypass -File build.ps1
#
#  ---------------------------------------------------------------------------
#  Two conventions this file follows on purpose - do not "tidy" them away:
#
#  * ZERO Arabic characters in any .ps1 in this repo. PowerShell 5.1 mis-decodes
#    UTF-8 without a BOM, and the BOM is lost the moment any editor rewrites the
#    file. Keeping the scripts pure ASCII removes the failure mode entirely.
#    All user-facing Arabic lives in site\strings\{ar,en}.txt, read at build time.
#
#  * Paths are derived from $PSScriptRoot, never hard-coded. The previous version
#    pinned an absolute C:\Users\... path, so the build only ran on one machine
#    and from one folder.
#
#  The browser SPA that used to be built here was withdrawn on 2026-07-28
#  (booking is app-only; two front-ends on two databases could double-book).
#  Its sources were deleted in the 2026-07-29 reorganisation and live on in git
#  history if they are ever needed again.
# ============================================================
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$Src  = Join-Path $Root 'app\src'
$Www  = Join-Path $Root 'app\www'
$enc  = New-Object System.Text.UTF8Encoding $false   # UTF-8 no BOM for outputs

# ===== 1) the Android app =====================================================
# One HTML file with the CSS and JS inlined: the app is bundled inside the APK,
# so a separate file per asset would only add file:// round-trips at startup.
$ah = [IO.File]::ReadAllText((Join-Path $Src 'app.html'))
$ac = [IO.File]::ReadAllText((Join-Path $Src 'app.css'))
$aj = [IO.File]::ReadAllText((Join-Path $Src 'app.js'))
$appWeb = $ah.Replace('<link rel="stylesheet" href="app.css">', "<style>`r`n$ac`r`n</style>").Replace('<script src="app.js"></script>', "<script>`r`n$aj`r`n</script>")

# The native layer (haptics, back button, status bar, safe areas) is injected
# last so it can override anything above it. It is inert in a browser.
$ncss = [IO.File]::ReadAllText((Join-Path $Src 'native.css'))
$njs  = [IO.File]::ReadAllText((Join-Path $Src 'native.js'))
$nativeBlock = "<style>`r`n/* ===== NATIVE LAYER (app only) ===== */`r`n$ncss`r`n</style>`r`n<script>`r`n$njs`r`n</script>`r`n</body>"
$app = $appWeb.Replace('</body>', $nativeBlock)

if (-not (Test-Path $Www)) { New-Item -ItemType Directory $Www | Out-Null }
[IO.File]::WriteAllText((Join-Path $Www 'index.html'), $app, $enc)

# Local preview: same build plus the flag Capacitor would set on a device, so
# touch feedback and native-only styling are visible in a desktop browser.
$previewFlag = "<script>try{document.body.classList.add('native');}catch(e){}</script>`r`n</body>"
[IO.File]::WriteAllText((Join-Path $Src '_preview_app.html'), $app.Replace('</body>', $previewFlag), $enc)

$injected = $app.Length - $appWeb.Length
Write-Host ""
Write-Host ("  [app]    {0,9:N0} chars  ->  app\www\index.html  (+{1:N0} native)" -f $app.Length, $injected) -ForegroundColor Green
if ($injected -le 0) { Write-Warning "native layer was NOT injected - is </body> still present in app\src\app.html?" }
Write-Host "  preview: server on app\src\  then  _preview_app.html" -ForegroundColor DarkGray
Write-Host "  to APK:  npx cap sync android   then   cd android; .\gradlew.bat assembleDebug" -ForegroundColor DarkGray

# ===== 2) the public site =====================================================
# build-site.ps1 locates itself and wipes public\ before writing, so a file
# dropped from the generator stops being served instead of lingering forever.
& (Join-Path $Root 'site\build-site.ps1')
