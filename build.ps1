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

# Inlining is a string splice, so any of these sequences inside the sources
# would close the tag early: the rest of the script becomes markup, the native
# layer lands in the middle of a function, and THE BUILD STILL SUCCEEDS. The
# only symptom is a broken APK on a device.
# Zero occurrences today - which is exactly when to add the guard, because the
# thing that introduces one is ordinary: an SVG icon, a comment describing a
# tag, an I18N string quoting HTML.
# HTML ends a raw-text element at "</script" / "</style" regardless of what
# follows, so match the prefix, not the well-formed tag.
foreach ($pair in @(@{n='app.js'; t=$aj; m='</script'}, @{n='app.css'; t=$ac; m='</style'},
                    @{n='app.js'; t=$aj; m='</body>'}, @{n='app.css'; t=$ac; m='</body>'})) {
    if ($pair.t -match [regex]::Escape($pair.m)) {
        throw ("BUILD ABORTED: {0} contains '{1}'. Inlining would close the tag early and " -f $pair.n, $pair.m) +
              "ship a silently broken APK. Escape it (e.g. '<' + '/script>') and rebuild."
    }
}

# The guard above watches what gets INJECTED; this one watches what it is injected
# INTO. .NET's String.Replace swaps EVERY occurrence, so a second "</body>" anywhere
# in app.html - including inside an HTML comment - injects the whole native layer
# twice. The CSS duplicate is harmless; native.js running twice is not: it registers
# the Android back-button listener, the status-bar MutationObserver and the
# notification listener a second time, so one back gesture navigates twice.
# Measured 2026-08-10: a comment that quoted the literal tag did exactly this, and
# the build reported success (+19,398 native instead of +9,699).
$bodyCloses = ([regex]::Matches($ah, [regex]::Escape('</body>'))).Count
if ($bodyCloses -ne 1) {
    throw ("BUILD ABORTED: app.html contains {0} occurrences of '</body>' (expected exactly 1). " -f $bodyCloses) +
          "String.Replace is global, so the native layer would be injected once per occurrence " +
          "and native.js would run more than once. Do not write the literal tag in comments."
}

$appWeb = $ah.Replace('<link rel="stylesheet" href="app.css">', "<style>`r`n$ac`r`n</style>").Replace('<script src="app.js"></script>', "<script>`r`n$aj`r`n</script>")

# The native layer (haptics, back button, status bar, safe areas) is injected
# last so it can override anything above it. It is inert in a browser.
$ncss = [IO.File]::ReadAllText((Join-Path $Src 'native.css'))
$njs  = [IO.File]::ReadAllText((Join-Path $Src 'native.js'))
foreach ($pair in @(@{n='native.js'; t=$njs; m='</script'}, @{n='native.css'; t=$ncss; m='</style'})) {
    if ($pair.t -match [regex]::Escape($pair.m)) {
        throw ("BUILD ABORTED: {0} contains '{1}' - see the note above the first guard." -f $pair.n, $pair.m)
    }
}
$nativeBlock = "<style>`r`n/* ===== NATIVE LAYER (app only) ===== */`r`n$ncss`r`n</style>`r`n<script>`r`n$njs`r`n</script>`r`n</body>"
$app = $appWeb.Replace('</body>', $nativeBlock)

if (-not (Test-Path $Www)) { New-Item -ItemType Directory $Www | Out-Null }
[IO.File]::WriteAllText((Join-Path $Www 'index.html'), $app, $enc)

# Fonts are the one thing NOT inlined, and deliberately so: 268 KB of base64
# would sit in every parse of a 4,700-line HTML file for no gain, while a
# file:// read of a .woff2 beside index.html costs nothing. They ship inside
# the APK either way - which is the whole point (see the note in app.html).
# Generated by tools/fetch-fonts.mjs and committed, so a build never needs
# the network.
$assetsSrc = Join-Path $Root 'app\assets'
$assetsDst = Join-Path $Www 'assets'
if (Test-Path $assetsSrc) {
    if (Test-Path $assetsDst) { Remove-Item $assetsDst -Recurse -Force }
    Copy-Item $assetsSrc $assetsDst -Recurse -Force
}
$fontSheet = Join-Path $assetsDst 'fonts\fonts.css'
if (-not (Test-Path $fontSheet)) {
    throw "BUILD ABORTED: app\assets\fonts\fonts.css is missing. The app would fall back to a system font. Run: node tools\fetch-fonts.mjs"
}
# The preview is served from app\src\, so it needs its own copy beside it.
$previewAssets = Join-Path $Src 'assets'
if (Test-Path $assetsSrc) {
    if (Test-Path $previewAssets) { Remove-Item $previewAssets -Recurse -Force }
    Copy-Item $assetsSrc $previewAssets -Recurse -Force
}

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
