# ============================================================
#  build-site.ps1 - static site generator for AL-Mustadira
#
#  IN : site/{strings,partials,pages,styles,static}
#  OUT: public/  (Cloudflare Pages output directory)
#
#  *** ASCII ONLY ***
#  This file must contain ZERO non-ASCII characters. PowerShell 5.1
#  mis-decodes UTF-8 source without a BOM, and BOMs are easy to lose
#  through editors. All Arabic/English copy lives in site/strings/*.txt
#  and site/pages/*.html, which are read with [IO.File]::ReadAllText
#  (BOM-agnostic) - so the encoding trap cannot reach the code.
#
#  Usage: powershell -ExecutionPolicy Bypass -File site\build-site.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

$SiteDir = $PSScriptRoot
$Root    = Split-Path -Parent $SiteDir
$Out     = Join-Path $Root 'public'

# ---- single source of truth: canonical, hreflang, sitemap and og:image all
# derive from this one line. Point it at whatever host is ACTUALLY serving the
# site - a canonical URL on a host that does not exist is worse than none.
# Vercel today; flip to the pages.dev (or a bought domain) the moment
# Cloudflare Pages is connected. See PLAN-2-website.md decision 1.
$SiteOrigin = 'https://mustadeera.vercel.app'
$BuildStamp = Get-Date -Format 'yyyy-MM-dd'

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Read-Text([string]$p) { [IO.File]::ReadAllText($p) }

function Write-Text([string]$p, [string]$s) {
    $dir = Split-Path -Parent $p
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::WriteAllText($p, $s, $Utf8NoBom)
}

# ---- strings: "key = value" per line; '#' comments; blanks ignored ----
function Read-Strings([string]$p) {
    $h = @{}
    foreach ($line in (Read-Text $p) -split "`r?`n") {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*$') { continue }
        $i = $line.IndexOf('=')
        if ($i -lt 1) { continue }
        $h[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim()
    }
    $h
}

# ---- template expansion: {{t.key}} = copy, {{var}} = build variable ----
$script:Missing = New-Object System.Collections.ArrayList

function Expand-Tpl([string]$tpl, [hashtable]$vars, [hashtable]$T) {
    # Copy may use **bold**; it is the only markup allowed inside a string.
    # Everything else must stay plain text - the strings are injected raw, so
    # a literal angle bracket in ar.txt/en.txt would become markup.
    $tpl = [regex]::Replace($tpl, '\{\{t\.([A-Za-z0-9_]+)\}\}', {
        $k = $args[0].Groups[1].Value
        if ($T.ContainsKey($k)) {
            [regex]::Replace($T[$k], '\*\*(.+?)\*\*', '<strong>$1</strong>')
        } else { [void]$script:Missing.Add("t.$k"); "[[$k]]" }
    })
    $tpl = [regex]::Replace($tpl, '\{\{([A-Za-z0-9_]+)\}\}', {
        $k = $args[0].Groups[1].Value
        if ($vars.ContainsKey($k)) { $vars[$k] } else { [void]$script:Missing.Add($k); '' }
    })
    $tpl
}

# ---- page map: path is language-agnostic; 'en' build prefixes /en ----
$Pages = @(
    @{ name = 'index';    path = '/';          title = 'metaHomeTitle';     desc = 'metaHomeDesc';     prio = '1.0' },
    @{ name = 'download'; path = '/download/'; title = 'metaDownloadTitle'; desc = 'metaDownloadDesc'; prio = '0.9' },
    @{ name = 'owners';   path = '/owners/';   title = 'metaOwnersTitle';   desc = 'metaOwnersDesc';   prio = '0.8' },
    @{ name = 'about';    path = '/about/';    title = 'metaAboutTitle';    desc = 'metaAboutDesc';    prio = '0.5' },
    @{ name = 'contact';  path = '/contact/';  title = 'metaContactTitle';  desc = 'metaContactDesc';  prio = '0.5' },
    @{ name = 'privacy';  path = '/privacy/';  title = 'metaPrivacyTitle';  desc = 'metaPrivacyDesc';  prio = '0.3' },
    @{ name = 'terms';    path = '/terms/';    title = 'metaTermsTitle';    desc = 'metaTermsDesc';    prio = '0.3' }
)

# Fonts are per-language on purpose: an Arabic page has no use for Inter and
# an English one none for Tajawal. Shipping one family less is a whole
# stylesheet request and a font file saved on the critical path.
$FontAr = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Montserrat:wght@700;800;900&display=swap'
$FontEn = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&display=swap'

$Langs = @(
    @{ code = 'ar'; dir = 'rtl'; base = '';    alt = 'en'; altBase = '/en'; font = $FontAr; nameOther = 'English'  },
    @{ code = 'en'; dir = 'ltr'; base = '/en'; alt = 'ar'; altBase = '';    font = $FontEn; nameOther = 'Arabic'   }
)

# ---- load shared parts ----
$Strings  = @{}
foreach ($l in $Langs) { $Strings[$l.code] = Read-Strings (Join-Path $SiteDir "strings\$($l.code).txt") }

# Release metadata for /download. An empty 'url' means "not published yet",
# and the page renders the honest unavailable state instead of inventing a
# version or a hash. See site/release.txt.
$Rel = Read-Strings (Join-Path $SiteDir 'release.txt')
$RelLive = ($Rel.ContainsKey('url') -and $Rel['url'] -ne '')

# Contact channels, same idea: empty file means the page says so rather than
# printing a made-up number. See site/contact.txt.
$Contact   = Read-Strings (Join-Path $SiteDir 'contact.txt')
$WaDigits  = $(if ($Contact.ContainsKey('whatsapp')) { $Contact['whatsapp'] -replace '[^0-9]', '' } else { '' })
$MailAddr  = $(if ($Contact.ContainsKey('email'))    { $Contact['email'] }                        else { '' })
$ContactLive = ($WaDigits -ne '' -or $MailAddr -ne '')

$TplHead   = Read-Text (Join-Path $SiteDir 'partials\head.html')
$TplHeader = Read-Text (Join-Path $SiteDir 'partials\header.html')
$TplFooter = Read-Text (Join-Path $SiteDir 'partials\footer.html')
$Css       = Read-Text (Join-Path $SiteDir 'styles\site.css')

# CSS is inlined in every page rather than linked. Reason: the whole
# stylesheet is small enough that one round-trip beats cross-page caching,
# and it removes any chance of an unstyled first paint. Revisit past ~20KB.
$CssMin = $Css -replace '(?s)/\*.*?\*/', ''
$CssMin = $CssMin -replace '(?m)^\s+', '' -replace '(?m)\s+$', ''
$CssMin = ($CssMin -split "`r?`n" | Where-Object { $_ -ne '' }) -join ''
$CssMin = $CssMin -replace ';\}', '}' -replace '\s*([{}:;,>])\s*', '$1'

$sitemap = New-Object System.Collections.ArrayList
$written = 0

foreach ($lang in $Langs) {
    $T = $Strings[$lang.code]

    foreach ($page in $Pages) {
        $bodyFile = Join-Path $SiteDir "pages\$($page.name).html"
        if (-not (Test-Path $bodyFile)) { continue }

        $canonical = $SiteOrigin + $lang.base + $page.path
        $altUrl    = $SiteOrigin + $lang.altBase + $page.path

        $vars = @{
            lang       = $lang.code
            dir        = $lang.dir
            base       = $lang.base
            altBase    = $lang.altBase
            altLang    = $lang.alt
            origin     = $SiteOrigin
            canonical  = $canonical
            altUrl     = $altUrl
            arUrl      = $SiteOrigin + $page.path
            enUrl      = $SiteOrigin + '/en' + $page.path
            path       = $page.path
            pageName   = $page.name
            buildStamp = $BuildStamp
            year       = (Get-Date -Format 'yyyy')
            fontHref   = $lang.font
            css        = $CssMin
            title      = $(if ($T.ContainsKey($page.title)) { $T[$page.title] } else { '' })
            desc       = $(if ($T.ContainsKey($page.desc))  { $T[$page.desc]  } else { '' })
        }
        # aria-current for the active nav item
        foreach ($p in $Pages) {
            $vars["cur_$($p.name)"] = $(if ($p.name -eq $page.name) { ' aria-current="page"' } else { '' })
        }

        $vars['relVersion'] = $(if ($Rel.ContainsKey('version')) { $Rel['version'] } else { '' })
        $vars['relDate']    = $(if ($Rel.ContainsKey('date'))    { $Rel['date'] }    else { '' })
        $vars['relSize']    = $(if ($Rel.ContainsKey('size'))    { $Rel['size'] }    else { '' })
        $vars['relSha']     = $(if ($Rel.ContainsKey('sha256'))  { $Rel['sha256'] }  else { '' })
        $vars['relUrl']     = $(if ($Rel.ContainsKey('url'))     { $Rel['url'] }     else { '' })

        # wa.me links carry a prefilled opener, and it differs by who is writing
        # (a player with a booking problem vs an owner registering a pitch), so
        # the text comes from the language's own dictionary.
        $vars['waUrlGeneral'] = ''
        $vars['waUrlOwner']   = ''
        $vars['waDisplay']    = ''
        $vars['mailUrl']      = ''
        $vars['mailDisplay']  = $MailAddr
        if ($WaDigits -ne '') {
            $mg = $(if ($T.ContainsKey('waMsgGeneral')) { $T['waMsgGeneral'] } else { '' })
            $mo = $(if ($T.ContainsKey('waMsgOwner'))   { $T['waMsgOwner'] }   else { '' })
            $vars['waUrlGeneral'] = "https://wa.me/$WaDigits" + '?text=' + [uri]::EscapeDataString($mg)
            $vars['waUrlOwner']   = "https://wa.me/$WaDigits" + '?text=' + [uri]::EscapeDataString($mo)
            # Shown with a leading + so it reads as an international number.
            $vars['waDisplay']    = '+' + $WaDigits
        }
        if ($MailAddr -ne '') { $vars['mailUrl'] = 'mailto:' + $MailAddr }

        $body = Read-Text $bodyFile
        $body = $body.Replace('{{include:contact}}', $(if ($ContactLive) { '{{include:contact-live}}' } else { '{{include:contact-soon}}' }))

        # Partial includes run BEFORE expansion so the included markup's own
        # {{t.key}} placeholders are resolved in the same pass.
        $body = $body.Replace('{{include:release}}', $(if ($RelLive) { '{{include:dl-available}}' } else { '{{include:dl-unavailable}}' }))
        $body = [regex]::Replace($body, '\{\{include:([a-z0-9-]+)\}\}', {
            $f = Join-Path $SiteDir ("partials\" + $args[0].Groups[1].Value + '.html')
            if (Test-Path $f) { [IO.File]::ReadAllText($f) } else { '' }
        })
        $html = "<!DOCTYPE html>`r`n<html lang=`"$($lang.code)`" dir=`"$($lang.dir)`">`r`n<head>`r`n" +
                $TplHead + "`r`n</head>`r`n<body class=`"p-$($page.name)`">`r`n" +
                $TplHeader + "`r`n<main id=`"main`">`r`n" + $body + "`r`n</main>`r`n" +
                $TplFooter + "`r`n</body>`r`n</html>`r`n"

        $html = Expand-Tpl $html $vars $T

        # NOTE: not $rel - PowerShell variable names are case-insensitive, so
        # $rel and the release hashtable $Rel are the same variable.
        $relPath = ($lang.base + $page.path).TrimStart('/')
        if ($relPath -eq '') { $relPath = 'index.html' } else { $relPath = $relPath.TrimEnd('/') + '/index.html' }
        Write-Text (Join-Path $Out $relPath) $html
        $written++

        [void]$sitemap.Add(@{ loc = $canonical; prio = $page.prio; ar = $vars.arUrl; en = $vars.enUrl })
    }
}

# ---- sitemap.xml (with reciprocal hreflang on every entry) ----
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">')
foreach ($u in $sitemap) {
    [void]$sb.AppendLine('  <url>')
    [void]$sb.AppendLine("    <loc>$($u.loc)</loc>")
    [void]$sb.AppendLine("    <lastmod>$BuildStamp</lastmod>")
    [void]$sb.AppendLine("    <priority>$($u.prio)</priority>")
    [void]$sb.AppendLine("    <xhtml:link rel=`"alternate`" hreflang=`"ar`" href=`"$($u.ar)`"/>")
    [void]$sb.AppendLine("    <xhtml:link rel=`"alternate`" hreflang=`"en`" href=`"$($u.en)`"/>")
    [void]$sb.AppendLine("    <xhtml:link rel=`"alternate`" hreflang=`"x-default`" href=`"$($u.ar)`"/>")
    [void]$sb.AppendLine('  </url>')
}
[void]$sb.AppendLine('</urlset>')
Write-Text (Join-Path $Out 'sitemap.xml') $sb.ToString()

# ---- robots.txt ----
Write-Text (Join-Path $Out 'robots.txt') "User-agent: *`nAllow: /`n`nSitemap: $SiteOrigin/sitemap.xml`n"

# ---- static passthrough: _headers, _redirects, assets ----
$staticDir = Join-Path $SiteDir 'static'
if (Test-Path $staticDir) {
    Get-ChildItem -Path $staticDir -File -Recurse | ForEach-Object {
        $relFile = $_.FullName.Substring($staticDir.Length).TrimStart('\')
        $dst = Join-Path $Out $relFile
        $dstDir = Split-Path -Parent $dst
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        Copy-Item $_.FullName $dst -Force
    }
}

$assetsOut = Join-Path $Out 'assets'
if (-not (Test-Path $assetsOut)) { New-Item -ItemType Directory -Path $assetsOut -Force | Out-Null }
foreach ($f in @('logo-nav.png', 'logo-nav-dark.png', 'logo-mark.png', 'logo-mark-dark.png', 'logo-fav.png')) {
    $src = Join-Path $Root "app\$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $assetsOut $f) -Force }
}

# ---- the SPA lives at /app (the root build stays untouched for the old host) ----
$spa = Join-Path $Root 'index.html'
if (Test-Path $spa) {
    $appDir = Join-Path $Out 'app'
    if (-not (Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir -Force | Out-Null }
    Copy-Item $spa (Join-Path $appDir 'index.html') -Force
}

# ---- report ----
$totalBytes = (Get-ChildItem $Out -Recurse -File | Measure-Object Length -Sum).Sum
$homeChars  = (Read-Text (Join-Path $Out 'index.html')).Length
Write-Host ''
Write-Host ("  [site]   {0} pages -> public\  ({1:N0} KB total)" -f $written, ($totalBytes / 1KB)) -ForegroundColor Cyan
Write-Host ("  [css]    {0:N0} chars inlined per page" -f $CssMin.Length) -ForegroundColor DarkGray
Write-Host ("  [home]   {0:N0} chars  (budget 40,000)" -f $homeChars) -ForegroundColor $(if ($homeChars -gt 40000) { 'Red' } else { 'Green' })
Write-Host ("  [origin] {0}" -f $SiteOrigin) -ForegroundColor DarkGray
if ($script:Missing.Count -gt 0) {
    $uniq = $script:Missing | Sort-Object -Unique
    Write-Warning ("unresolved placeholders ({0}): {1}" -f $uniq.Count, ($uniq -join ', '))
} else {
    Write-Host '  [keys]   all placeholders resolved' -ForegroundColor Green
}
Write-Host ''
