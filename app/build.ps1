# ============================================================
#  build.ps1 — بناءان مستقلّان (فصل كامل: موقع + تطبيق)
#
#  (1) الموقع (مُجمّد) — من ثلاثي الموقع:
#        app\index-new.html + app\style-new.css + app\app.js
#      المخرَج: المستديرة محدث.txt + app\_preview_mohdath.html
#
#  (2) التطبيق (تطوير نشط) — من ثلاثي التطبيق المستقل:
#        app\native\app.html + app\native\app.css + app\native\app.js
#        + طبقة native تُحقن: app\native\native.css + native.js
#      المخرَج: www\index.html (webDir للـAPK) + app\native\_preview_app.html
#
#  النشر: جذر index.html = بناء الموقع (Vercel للزوّار).
#  التطبيق مدمج داخل الـAPK (webDir=www، بلا server.url) ⇒ يفتح بلا اعتماد على الإنترنت.
#
#  ⚠️ هذا الملف UTF-8 مع BOM كي يقرأه PowerShell 5.1 صحيحًا.
#  الاستعمال: powershell -ExecutionPolicy Bypass -File app\build.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
$dir  = "C:\Users\malik\OneDrive\Desktop\koora\app"
$root = "C:\Users\malik\OneDrive\Desktop\koora"
$enc  = New-Object System.Text.UTF8Encoding $false   # UTF-8 بلا BOM للمخرجات

# ===== 1) بناء الموقع (من ثلاثي الموقع — لا يُلمس) =====
$wh = [IO.File]::ReadAllText("$dir\index-new.html")
$wc = [IO.File]::ReadAllText("$dir\style-new.css")
$wj = [IO.File]::ReadAllText("$dir\app.js")
$web = $wh.Replace('<link rel="stylesheet" href="style.css">', "<style>`r`n$wc`r`n</style>").Replace('<script src="app.js"></script>', "<script>`r`n$wj`r`n</script>")
[IO.File]::WriteAllText("$root\المستديرة محدث.txt", $web, $enc)
[IO.File]::WriteAllText("$dir\_preview_mohdath.html", $web, $enc)
# جذر index.html = بناء الموقع (هذا ما تنشره Vercel للزوّار — التطبيق لم يعد يعتمد عليه)
[IO.File]::WriteAllText("$root\index.html", $web, $enc)

# ===== 2) بناء التطبيق (من ثلاثي التطبيق المستقل) =====
$ah = [IO.File]::ReadAllText("$dir\native\app.html")
$ac = [IO.File]::ReadAllText("$dir\native\app.css")
$aj = [IO.File]::ReadAllText("$dir\native\app.js")
$appWeb = $ah.Replace('<link rel="stylesheet" href="app.css">', "<style>`r`n$ac`r`n</style>").Replace('<script src="app.js"></script>', "<script>`r`n$aj`r`n</script>")

# حقن طبقة native (تطبيق فقط) قبل </body>
$ncss = [IO.File]::ReadAllText("$dir\native\native.css")
$njs  = [IO.File]::ReadAllText("$dir\native\native.js")
$nativeBlock = "<style>`r`n/* ===== NATIVE LAYER (app only) ===== */`r`n$ncss`r`n</style>`r`n<script>`r`n$njs`r`n</script>`r`n</body>"
$app = $appWeb.Replace('</body>', $nativeBlock)

if(-not (Test-Path "$root\www")){ New-Item -ItemType Directory "$root\www" | Out-Null }
[IO.File]::WriteAllText("$root\www\index.html", $app, $enc)

# معاينة التطبيق المحلّية: نضيف علم native كي تعمل تفاعلات اللمس/السلوكيات في المتصفح
$previewFlag = "<script>try{document.body.classList.add('native');}catch(e){}</script>`r`n</body>"
$preview = $app.Replace('</body>', $previewFlag)
[IO.File]::WriteAllText("$dir\native\_preview_app.html", $preview, $enc)

# ===== تقرير =====
$injected = $app.Length - $appWeb.Length
Write-Host ""
Write-Host ("  [موقع]   {0,9:N0} محرف  ->  المستديرة محدث.txt + _preview_mohdath.html" -f $web.Length) -ForegroundColor Cyan
Write-Host ("  [تطبيق]  {0,9:N0} محرف  ->  www\index.html (+{1:N0} native) + native\_preview_app.html" -f $app.Length, $injected) -ForegroundColor Green
if($injected -le 0){ Write-Warning "لم تُحقَن طبقة native! تحقّق من وجود </body> في native\app.html" }
Write-Host ""
Write-Host "  معاينة التطبيق:  خادم على app\native\  ثم  _preview_app.html" -ForegroundColor Yellow
Write-Host "  تحديث الـAPK:    npx cap sync android  ثم بناء APK" -ForegroundColor Yellow
Write-Host "  (النشر/Vercel + server.url = خطوة المرحلة 7 عند الشحن)" -ForegroundColor DarkGray

# ===== 3) Official site (site\ -> public\) — Cloudflare Pages output =====
& "$root\site\build-site.ps1"
