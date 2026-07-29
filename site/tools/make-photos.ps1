# ============================================================
#  make-photos.ps1 - prepares the marketing photographs.
#
#  Reads the originals that ship with the app's onboarding and writes
#  web-sized, compressed copies into site\static\assets\photos\.
#
#  WHY COPY INSTEAD OF POINTING AT app\assets\onb\ :
#  the one rule of this repository is that a product never reads out of
#  another product's folder (README). The site build reading its logos
#  from app\ is exactly the inverted dependency the 2026-07-29
#  reorganisation removed - it would have broken the site silently the
#  first time the app's assets moved. So the site keeps its own copies.
#
#  The output is committed, so a normal build never depends on GDI+.
#  Re-run only when the source photographs change:
#    powershell -ExecutionPolicy Bypass -File site\tools\make-photos.ps1
#
#  *** ASCII ONLY *** - same PS 5.1 + BOM trap as build-site.ps1.
# ============================================================
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Tools = $PSScriptRoot
$Site  = Split-Path -Parent $Tools
$Root  = Split-Path -Parent $Site
$Src   = Join-Path $Root 'app\assets\onb'
$Out   = Join-Path $Site 'static\assets\photos'

if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out -Force | Out-Null }

# name = the stable filename the CSS/markup refers to. Renaming the source
# photograph must not change the markup, so the mapping lives here.
# w    = widths to emit · q = JPEG quality.
#
# The two roles get different treatment on purpose:
#  - pitch-night is a DECORATIVE layer: it sits behind a gradient at low
#    opacity, so quality 62 at a single width is indistinguishable from 78 at
#    two, and it is the only one on the critical path (above the fold).
#  - the players photographs are CONTENT images that a reader actually looks
#    at, and they are lazy-loaded further down, so they get 78 and two widths.
$Jobs = @(
    @{ src = 'night-pitch-16826134.jpg'; name = 'pitch-night';  w = @(1000);      q = 62 },
    @{ src = 'players-3148452.jpg';      name = 'players-run';  w = @(720, 1100); q = 78 },
    @{ src = 'players-16588259.jpg';     name = 'players-kick'; w = @(720, 1100); q = 78 }
)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }

$total = 0
foreach ($job in $Jobs) {
    $srcFile = Join-Path $Src $job.src
    if (-not (Test-Path $srcFile)) { Write-Warning ("missing source: {0}" -f $job.src); continue }

    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [int]$job.q)

    $img = [System.Drawing.Image]::FromFile($srcFile)
    try {
        foreach ($w in $job.w) {
            # Never upscale: a 720-wide source blown up to 1280 costs bytes and
            # buys blur. Emit the source width instead and let the browser pick.
            $tw = [math]::Min($w, $img.Width)
            $th = [int][math]::Round($img.Height * $tw / $img.Width)

            $bmp = New-Object System.Drawing.Bitmap $tw, $th
            $g   = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode  = 'HighQualityBicubic'
            $g.PixelOffsetMode    = 'HighQuality'
            $g.SmoothingMode      = 'HighQuality'
            $g.CompositingQuality = 'HighQuality'
            $g.DrawImage($img, 0, 0, $tw, $th)

            $dst = Join-Path $Out ("{0}-{1}.jpg" -f $job.name, $tw)
            $bmp.Save($dst, $codec, $encParams)
            $g.Dispose(); $bmp.Dispose()

            $kb = [math]::Round((Get-Item $dst).Length / 1KB)
            $total += (Get-Item $dst).Length
            Write-Host ("  [photo] {0,-24} {1,5}px  {2,4} KB" -f (Split-Path $dst -Leaf), $tw, $kb) -ForegroundColor DarkGray
        }
    } finally { $img.Dispose(); $encParams.Dispose() }
}

Write-Host ("  [photo] total {0:N0} KB in {1}" -f ($total / 1KB), $Out) -ForegroundColor Cyan
