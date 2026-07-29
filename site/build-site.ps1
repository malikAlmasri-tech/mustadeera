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

# ---- start from a clean output tree ----
# Without this, a page or asset that stops being generated lingers in public/
# and keeps getting served. That is how a withdrawn service worker or an old
# route can outlive the decision to remove it.
if (Test-Path $Out) { Remove-Item (Join-Path $Out '*') -Recurse -Force }

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
    @{ name = 'places';   path = '/places/';   title = 'metaPlacesTitle';   desc = 'metaPlacesDesc';   prio = '0.9' },
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

# ---- venue directory data, pulled from Postgres at build time ----
# The anon key is public by design: it is already shipped inside the APK and
# the SPA, and every table behind it is governed by row-level security.
# Only rows the database itself exposes anonymously can be read here.
$SbUrl = 'https://nxqddfuwtrsabprxcfez.supabase.co/rest/v1'
$SbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cWRkZnV3dHJzYWJwcnhjZmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNDkwNDcsImV4cCI6MjEwMDYyNTA0N30.SOL5yoyeDZpJOEneH9rgqGc5P6HswMw5fR9d76Uh0wA'
$DataCache = Join-Path $SiteDir 'data\places.json'

function Get-Sb([string]$q) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $r = Invoke-WebRequest -Uri ($SbUrl + $q) -Headers @{ apikey = $SbKey; Authorization = "Bearer $SbKey" } -UseBasicParsing -TimeoutSec 25
    # Decode explicitly as UTF-8: PowerShell 5.1 otherwise falls back to
    # Latin-1 for a body it is unsure about, which mangles every Arabic name.
    $txt = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $txt | ConvertFrom-Json
}

$PlacesData = $null
try {
    $pl = Get-Sb '/places?select=*&active=is.true&order=name'
    $fl = Get-Sb '/fields?select=*&active=is.true'
    $st = Get-Sb '/place_stats?select=*'
    $PlacesData = @{ places = $pl; fields = $fl; stats = $st }
    $dd = Split-Path -Parent $DataCache
    if (-not (Test-Path $dd)) { New-Item -ItemType Directory -Path $dd -Force | Out-Null }
    Write-Text $DataCache ($PlacesData | ConvertTo-Json -Depth 8)
    Write-Host ("  [db]     {0} places, {1} fields fetched" -f @($pl).Count, @($fl).Count) -ForegroundColor DarkGray
} catch {
    # A build must never fail because the database blinked. Fall back to the
    # last good snapshot; only warn if there isn't one.
    if (Test-Path $DataCache) {
        $PlacesData = (Read-Text $DataCache) | ConvertFrom-Json
        Write-Warning ("database unreachable - using cached snapshot ({0})" -f (Get-Item $DataCache).LastWriteTime)
    } else {
        Write-Warning 'database unreachable and no cached snapshot - /places will be skipped'
    }
}

# ---- normalise the directory into one model, shared by both languages ----
function HtmlEnc([string]$s) {
    if ($null -eq $s) { return '' }
    $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

function New-Slug([string]$s) {
    $x = ([string]$s).Trim()
    $x = $x -replace '[\\/:*?"<>|#%&+.,()\[\]]', ''
    $x = $x -replace '\s+', '-'
    $x = $x -replace '-+', '-'
    $x.Trim('-')
}

function Fmt-Price($n) {
    $d = [double]$n
    if ($d -eq [math]::Floor($d)) { [string][int]$d } else { $d.ToString('0.##') }
}

$PlaceModel = @()
if ($null -ne $PlacesData) {
    $statBy = @{}
    foreach ($s in @($PlacesData.stats)) { $statBy[[string]$s.place_id] = $s }
    $fieldBy = @{}
    foreach ($f in @($PlacesData.fields)) {
        $k = [string]$f.place_id
        if (-not $fieldBy.ContainsKey($k)) { $fieldBy[$k] = @() }
        $fieldBy[$k] += $f
    }
    $usedSlugs = @{}
    foreach ($p in @($PlacesData.places)) {
        # NOT $pid - that is a read-only automatic variable (the process id).
        $placeId = [string]$p.id
        $fs      = @($fieldBy[$placeId])
        # Same rule the app applies: a venue with no bookable pitch is not shown.
        if ($fs.Count -eq 0) { continue }

        $slug = New-Slug $p.name
        if ($usedSlugs.ContainsKey($slug)) { $slug = $slug + '-' + [string]$p.legacy_id }
        $usedSlugs[$slug] = $true

        $prices = @($fs | ForEach-Object { [double]$_.price })
        $st = $statBy[$placeId]
        # hasRating: a venue nobody has rated shows no stars at all - the same
        # decision made in the app (item 6), repeated here on purpose.
        $hasRating = ($null -ne $st -and [int]$st.reviews_count -gt 0)

        $am = @()
        if ($p.amenity_water)     { $am += 'amWater' }
        if ($p.amenity_vests)     { $am += 'amVests' }
        if ($p.amenity_ball)      { $am += 'amBall' }
        if ($p.amenity_bathrooms) { $am += 'amBathrooms' }
        if ($p.amenity_parking)   { $am += 'amParking' }

        $PlaceModel += @{
            id = $placeId; name = [string]$p.name; city = [string]$p.city; region = [string]$p.region
            type = [string]$p.type; map = [string]$p.map_link; slug = $slug
            fields = $fs; priceMin = ($prices | Measure-Object -Minimum).Minimum
            priceMax = ($prices | Measure-Object -Maximum).Maximum
            hasRating = $hasRating
            rating = $(if ($hasRating) { [double]$st.rating } else { 0 })
            reviews = $(if ($hasRating) { [int]$st.reviews_count } else { 0 })
            amenities = $am
        }
    }
}

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

# ---- directory markup (generated from data, so it holds no placeholders) ----
function Tx($T, [string]$k) { if ($T.ContainsKey($k)) { $T[$k] } else { "[[$k]]" } }

# Arabic changes the counted noun with the number, so "1 pitches" is not a
# typo to shrug at - it reads as broken Arabic. 1 = singular, 2 = dual,
# 3-10 = plural, 11+ = singular accusative. English just needs 1 vs many.
function Pitches([int]$n, $T) {
    if ($n -eq 1)  { return (Tx $T 'plPitchOne') }
    if ($n -eq 2)  { return (Tx $T 'plPitchTwo') }
    if ($n -le 10) { return "$n " + (Tx $T 'plPitchesFew') }
    "$n " + (Tx $T 'plPitchesMany')
}

function Render-Stars($p, $T) {
    if (-not $p.hasRating) { return '' }
    $r = ('{0:0.#}' -f $p.rating)
    '<span class="pl-rate"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.5 6.3.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.4l6.3-.9Z"/></svg>' +
    $r + '<span class="pl-rate-n">(' + $p.reviews + ')</span></span>'
}

function Render-PlacesList($model, $T, [string]$base) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<div class="pl-grid">')
    foreach ($p in $model) {
        $href = $base + '/places/' + [uri]::EscapeDataString($p.slug) + '/'
        [void]$sb.Append('<article class="pl-card"><a class="pl-link" href="' + $href + '">')
        [void]$sb.Append('<h2 class="pl-name">' + (HtmlEnc $p.name) + '</h2></a>')
        [void]$sb.Append('<p class="pl-meta">' + (HtmlEnc $p.region) + ' &middot; ' + (HtmlEnc $p.city) + '</p>')
        [void]$sb.Append('<p class="pl-tags"><span class="pl-tag">' + (HtmlEnc $p.type) + '</span>')
        [void]$sb.Append('<span class="pl-tag">' + (Pitches $p.fields.Count $T) + '</span></p>')
        [void]$sb.Append('<p class="pl-foot"><span class="pl-price">' + (Tx $T 'plPriceFrom') + ' ' + (Fmt-Price $p.priceMin) + ' ' + (Tx $T 'plCurrency') + '</span>')
        [void]$sb.Append((Render-Stars $p $T) + '</p>')
        [void]$sb.Append('</article>')
    }
    [void]$sb.Append('</div>')
    $sb.ToString()
}

function Render-PlaceBody($p, $T, [string]$base) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<section class="sec"><div class="wrap">')
    [void]$sb.Append('<a class="pl-back" href="' + $base + '/places/">' + (Tx $T 'plBackToList') + '</a>')
    [void]$sb.Append('<h1 class="h1-page">' + (HtmlEnc $p.name) + '</h1>')
    [void]$sb.Append('<p class="lead">' + (HtmlEnc $p.region) + ' &middot; ' + (HtmlEnc $p.city) + ' &middot; ' + (HtmlEnc $p.type) + '</p>')
    if ($p.hasRating) { [void]$sb.Append('<p class="pl-rate-row">' + (Render-Stars $p $T) + '</p>') }

    [void]$sb.Append('<div class="pl-facts">')
    [void]$sb.Append('<div class="pl-fact"><span class="k">' + (Tx $T 'plPitches') + '</span><span class="v">' + $p.fields.Count + '</span></div>')
    $priceTxt = $(if ($p.priceMin -eq $p.priceMax) { (Fmt-Price $p.priceMin) } else { (Fmt-Price $p.priceMin) + ' - ' + (Fmt-Price $p.priceMax) })
    [void]$sb.Append('<div class="pl-fact"><span class="k">' + (Tx $T 'plPriceHour') + '</span><span class="v">' + $priceTxt + ' ' + (Tx $T 'plCurrency') + '</span></div>')
    [void]$sb.Append('<div class="pl-fact"><span class="k">' + (Tx $T 'plSurface') + '</span><span class="v">' + (HtmlEnc $p.type) + '</span></div>')
    [void]$sb.Append('</div>')

    [void]$sb.Append('<h2 class="h2 pl-h2">' + (Tx $T 'plFieldsTitle') + '</h2><ul class="pl-fields">')
    foreach ($f in $p.fields) {
        [void]$sb.Append('<li><span class="fn">' + (HtmlEnc $f.name) + '</span>')
        if ($f.size) { [void]$sb.Append('<span class="fs">' + (HtmlEnc $f.size) + '</span>') }
        [void]$sb.Append('<span class="fp">' + (Fmt-Price $f.price) + ' ' + (Tx $T 'plCurrency') + '</span></li>')
    }
    [void]$sb.Append('</ul>')

    if ($p.amenities.Count -gt 0) {
        [void]$sb.Append('<h2 class="h2 pl-h2">' + (Tx $T 'plAmenities') + '</h2><ul class="pl-am">')
        foreach ($a in $p.amenities) { [void]$sb.Append('<li>' + (Tx $T $a) + '</li>') }
        [void]$sb.Append('</ul>')
    }

    [void]$sb.Append('<div class="hero-cta cta-start"><a class="btn btn-pri btn-lg" href="' + $base + '/download/">' + (Tx $T 'plBookCta') + '</a>')
    if ($p.map) { [void]$sb.Append('<a class="btn btn-sec btn-lg" href="' + (HtmlEnc $p.map) + '" rel="noopener nofollow">' + (Tx $T 'plMapCta') + '</a>') }
    [void]$sb.Append('</div>')
    [void]$sb.Append('<p class="pl-updated">' + (Tx $T 'plUpdated') + ' ' + $BuildStamp + ' &middot; ' + (Tx $T 'plLiveNote') + '</p>')
    [void]$sb.Append('</div></section>')
    $sb.ToString()
}

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

        $vars['placesList']  = $(if ($PlaceModel.Count -gt 0) { Render-PlacesList $PlaceModel $T $lang.base } else { '' })
        $vars['placesCount'] = [string]$PlaceModel.Count

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

    # ---- one page per venue: the only pages here with content search engines
    # cannot get anywhere else (name, area, surface, pitch sizes, real prices).
    foreach ($p in $PlaceModel) {
        $enc      = [uri]::EscapeDataString($p.slug)
        $pPath    = '/places/' + $enc + '/'
        $pTitle   = $p.name + ' - ' + $p.region + ' | ' + (Tx $T 'brandName')
        $pDesc    = (Tx $T 'plMetaDescA') + ' ' + $p.name + ' ' + (Tx $T 'plMetaDescB') + ' ' + $p.region + ' - ' +
                    $p.type + ', ' + (Pitches $p.fields.Count $T) + ', ' +
                    (Tx $T 'plPriceFrom') + ' ' + (Fmt-Price $p.priceMin) + ' ' + (Tx $T 'plCurrency') + '.'

        $pv = @{}
        foreach ($k in $vars.Keys) { $pv[$k] = $vars[$k] }
        $pv['title']     = HtmlEnc $pTitle
        $pv['desc']      = HtmlEnc $pDesc
        $pv['path']      = $pPath
        $pv['canonical'] = $SiteOrigin + $lang.base + $pPath
        $pv['altUrl']    = $SiteOrigin + $lang.altBase + $pPath
        $pv['arUrl']     = $SiteOrigin + $pPath
        $pv['enUrl']     = $SiteOrigin + '/en' + $pPath
        $pv['pageName']  = 'place'
        foreach ($q in $Pages) { $pv["cur_$($q.name)"] = $(if ($q.name -eq 'places') { ' aria-current="page"' } else { '' }) }

        $pBody = Render-PlaceBody $p $T $lang.base
        $pHtml = "<!DOCTYPE html>`r`n<html lang=`"$($lang.code)`" dir=`"$($lang.dir)`">`r`n<head>`r`n" +
                 $TplHead + "`r`n</head>`r`n<body class=`"p-place`">`r`n" +
                 $TplHeader + "`r`n<main id=`"main`">`r`n" + $pBody + "`r`n</main>`r`n" +
                 $TplFooter + "`r`n</body>`r`n</html>`r`n"
        $pHtml = Expand-Tpl $pHtml $pv $T

        # On disk the folder carries the RAW slug, never the percent-encoded one:
        # a server decodes the request path before it looks for the file, so an
        # encoded folder name would only ever be reachable by double-encoding.
        $diskDir = ($lang.base + '/places/' + $p.slug).TrimStart('/')
        Write-Text (Join-Path $Out ($diskDir.Replace('/', '\') + '\index.html')) $pHtml
        $written++
        [void]$sitemap.Add(@{ loc = $pv['canonical']; prio = '0.7'; ar = $pv['arUrl']; en = $pv['enUrl'] })
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

# ---- /admin: a standalone page, deliberately outside the site template.
# It shares the stylesheet but none of the marketing chrome, and it is
# excluded from the sitemap and from robots.txt. The exclusion is tidiness,
# not security - the actual guard is row-level security in the database.
$adminSrc = Join-Path $SiteDir 'admin.html'
if (Test-Path $adminSrc) {
    $av = @{
        css        = $CssMin
        sbBase     = $SbUrl -replace '/rest/v1$', ''
        sbKey      = $SbKey
        buildStamp = $BuildStamp
        year       = (Get-Date -Format 'yyyy')
    }
    Write-Text (Join-Path $Out 'admin\index.html') (Expand-Tpl (Read-Text $adminSrc) $av $Strings['ar'])
}

# ---- no service worker, no web-app manifest ----
# Owner decision (2026-07-28): the project has exactly two faces - this
# marketing site, and the Android app. A PWA would have been a third,
# installable thing to keep in step with both.

# ---- robots.txt ----
Write-Text (Join-Path $Out 'robots.txt') @"
User-agent: *
Allow: /
Disallow: /admin

Sitemap: $SiteOrigin/sitemap.xml
"@

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
# The logos used to sit in app\ even though only the site consumes them, which
# made them look like app assets. They moved to site\static\assets in the
# 2026-07-29 reorganisation; og-default.png was already there.
foreach ($f in @('logo-nav.png', 'logo-nav-dark.png', 'logo-mark.png', 'logo-mark-dark.png', 'logo-fav.png')) {
    $src = Join-Path $SiteDir "static\assets\$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $assetsOut $f) -Force }
}

# ---- the SPA is NOT published here ----
# Owner decision (2026-07-28): booking happens in the Android app only.
# A browser copy would be a second front-end writing to a second database
# (it still speaks to Apps Script/Sheets while the app speaks to Postgres),
# which is exactly the double-booking hazard stage (D) existed to close.
# Removing it closes that hazard without touching the live app.
# /app/* now redirects to the download page - see site/static/_redirects.

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
