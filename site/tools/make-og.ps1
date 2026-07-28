# ============================================================
#  make-og.ps1 - renders the 1200x630 sharing image (Open Graph).
#
#  Run when the brand or the tagline changes; the output is committed
#  so a normal build never depends on GDI+ being available.
#    powershell -ExecutionPolicy Bypass -File site\tools\make-og.ps1
#
#  *** ASCII ONLY *** - the Arabic wording is READ from site\strings\ar.txt,
#  never written here. Same reason as build-site.ps1 (PS 5.1 + BOM).
# ============================================================
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Tools = $PSScriptRoot
$Site  = Split-Path -Parent $Tools
$Root  = Split-Path -Parent $Site
$OutFile = Join-Path $Site 'static\assets\og-default.png'

function Get-Str([string]$file, [string]$key) {
    foreach ($line in ([IO.File]::ReadAllText($file) -split "`r?`n")) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $i = $line.IndexOf('=')
        if ($line.Substring(0, $i).Trim() -eq $key) { return $line.Substring($i + 1).Trim() }
    }
    ''
}

$ar      = Join-Path $Site 'strings\ar.txt'
$tagline = Get-Str $ar 'footerTagline'

$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.InterpolationMode = 'HighQualityBicubic'

# Teal field with a soft lime glow bottom-start - the brand's two colours, flat.
$teal = [System.Drawing.Color]::FromArgb(15, 75, 83)
$deep = [System.Drawing.Color]::FromArgb(7, 40, 46)
$lime = [System.Drawing.Color]::FromArgb(140, 198, 62)

$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $teal, $deep, 135.0
$g.FillRectangle($brush, $rect)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(-260, 300, 900, 900)
$glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
$glow.CenterColor    = [System.Drawing.Color]::FromArgb(56, 140, 198, 62)
$glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 140, 198, 62))
$g.FillPath($glow, $path)

# Logo lockup (the brand name is artwork inside it - no font dependency).
$logoPath = Join-Path $Root 'app\logo-nav-dark.png'
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $lw = 560; $lh = [int]($logo.Height * $lw / $logo.Width)
    $g.DrawImage($logo, [int](($W - $lw) / 2), 190, $lw, $lh)
    $logo.Dispose()
}

# Lime rule under the mark
$pen = New-Object System.Drawing.Pen $lime, 7
$g.DrawLine($pen, ($W / 2 - 90), 415, ($W / 2 + 90), 415)

# Tagline - Segoe UI ships with Windows and shapes Arabic correctly.
if ($tagline -ne '') {
    $font = New-Object System.Drawing.Font 'Segoe UI', 30, ([System.Drawing.FontStyle]::Bold)
    $fmt  = New-Object System.Drawing.StringFormat
    $fmt.Alignment     = 'Center'
    $fmt.LineAlignment = 'Center'
    $fmt.FormatFlags   = [System.Drawing.StringFormatFlags]::DirectionRightToLeft
    $tb   = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 240, 238))
    $box  = New-Object System.Drawing.RectangleF 120, 450, ($W - 240), 90
    $g.DrawString($tagline, $font, $tb, $box, $fmt)
    $font.Dispose(); $tb.Dispose()
}

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose(); $bmp.Dispose(); $brush.Dispose(); $glow.Dispose(); $path.Dispose(); $pen.Dispose()

$kb = [math]::Round((Get-Item $OutFile).Length / 1KB)
Write-Host ("  [og]  {0}x{1}  {2} KB  ->  {3}" -f $W, $H, $kb, $OutFile) -ForegroundColor Cyan
