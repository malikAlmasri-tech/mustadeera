# ============================================================
#  embed-onb-photo.ps1 — يضمّن صورة هيرو صفحة البداية في app.css كـbase64
#
#  لماذا base64 ولا ملف/رابط؟ التطبيق **مدمج داخل الـAPK** (webDir=www،
#  والبناء ملف واحد `www/index.html`) ⇒ رابط خارجي يفشل بلا إنترنت، وملف
#  منفصل يحتاج خطوة نسخ في كل بناء. الصورة داخل CSS = تعمل دائمًا.
#
#  المصدر: صورة Pexels (رخصة مجانية) بعد تصغيرها وضغطها.
#  الاستعمال: powershell -ExecutionPolicy Bypass -File app\native\embed-onb-photo.ps1 -Src <path.jpg>
#  قابل لإعادة التشغيل: يستبدل سطر `  --onb-photo:` كاملًا في كل مرة.
# ============================================================
param(
  [string]$Src = "",
  [int]$Width = 1000,
  [int]$Quality = 68
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$css = "C:\Users\malik\OneDrive\Desktop\koora\app\native\app.css"
if(-not (Test-Path $Src)){ throw "لم أجد الصورة المصدر: $Src" }

# ===== تصغير + ضغط =====
$img = [System.Drawing.Image]::FromFile($Src)
$h   = [int]([math]::Round($img.Height * ($Width / $img.Width)))
$bmp = New-Object System.Drawing.Bitmap $Width, $h
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, 0, 0, $Width, $h)
$g.Dispose(); $img.Dispose()

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$prm   = New-Object System.Drawing.Imaging.EncoderParameters 1
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, $codec, $prm)
$bmp.Dispose()
$bytes = $ms.ToArray(); $ms.Dispose()
$b64 = [Convert]::ToBase64String($bytes)

# ===== حقن في app.css (استبدال السطر كاملًا — قابل لإعادة التشغيل) =====
$lines = [IO.File]::ReadAllLines($css)
$newLine = '  --onb-photo:url("data:image/jpeg;base64,' + $b64 + '");'
$found = $false
for($i=0; $i -lt $lines.Length; $i++){
  if($lines[$i] -match '^\s*--onb-photo:'){ $lines[$i] = $newLine; $found = $true; break }
}
if(-not $found){ throw "لم أجد سطر --onb-photo في app.css" }
$enc = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllLines($css, $lines, $enc)

Write-Host ("  صورة الهيرو: {0}px عرضًا · جودة {1} · {2:N0} KB ⇒ base64 {3:N0} KB — حُقنت في app.css" -f $Width, $Quality, ($bytes.Length/1KB), ($b64.Length/1KB)) -ForegroundColor Green
