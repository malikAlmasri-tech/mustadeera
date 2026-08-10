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

# ---- HTML comments are for whoever edits site\pages, not for the visitor ----
# They were 7.5 KB on the home page alone - a quarter of its markup budget -
# and rode along on every one of the 28 pages. Source keeps every word; the
# output does not carry any of it. Same reasoning that moved the stylesheet
# and the script out to /build/: pay once, or better, do not pay at all.
#
# Script and style bodies are lifted out before the comment regex runs and put
# back after. Without that, a naive "<!--.*?-->" sweep runs over JavaScript,
# where both "<!--" and "-->" are ordinary characters inside a string literal
# and deleting the span between them would silently corrupt the script. The
# MatchEvaluator form is deliberate too: it treats its return value literally,
# so a "$1" inside the restored JS is never read as a capture reference.
function Remove-HtmlComments([string]$h) {
    $sep  = [char]1                       # cannot occur in HTML source
    $keep = New-Object System.Collections.ArrayList
    $h = [regex]::Replace($h, '(?is)<(script|style)\b[^>]*>.*?</\1\s*>', {
        $i = $keep.Add($args[0].Value)
        "$sep$i$sep"
    })
    $h = [regex]::Replace($h, '(?s)<!--.*?-->', '')
    $h = [regex]::Replace($h, "$sep(\d+)$sep", { $keep[[int]$args[0].Groups[1].Value] })
    # a removed block leaves its blank line behind; collapse runs back to one
    $h = [regex]::Replace($h, '(\r?\n)[ \t]*(\r?\n)([ \t]*\r?\n)+', '$1$2')
    return $h
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

# ---- which sports have at least one live field ----
# Same rule the app applies, against the same rows: a sport is open when a live
# field of that sport sits in a live venue. Both lists were already filtered to
# active=true above, so membership of this table IS the "open" flag.
#
# A field row with no 'sport' property reads as football, which is what every
# row is before migration 13 adds the column - so this is correct both before
# and after that migration runs.
$SportLive = @{}
if ($null -ne $PlacesData) {
    $livePlaceIds = @{}
    foreach ($p in @($PlacesData.places)) { $livePlaceIds[[string]$p.id] = $true }
    foreach ($f in @($PlacesData.fields)) {
        if (-not $livePlaceIds.ContainsKey([string]$f.place_id)) { continue }
        $sp = [string]$f.sport
        if ([string]::IsNullOrWhiteSpace($sp)) { $sp = 'football' }
        $SportLive[$sp] = $true
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
$Js        = Read-Text (Join-Path $SiteDir 'scripts\site.js')

$CssMin = $Css -replace '(?s)/\*.*?\*/', ''
$CssMin = $CssMin -replace '(?m)^\s+', '' -replace '(?m)\s+$', ''
$CssMin = ($CssMin -split "`r?`n" | Where-Object { $_ -ne '' }) -join ''
$CssMin = $CssMin -replace ';\}', '}' -replace '\s*([{}:;,>])\s*', '$1'

# ---- CSS and JS ship as external files named after their own content ----
# They used to be inlined into every page. That bought one less round-trip
# and no unstyled first paint, and it was the right call while the sheet was
# small - the note here said "revisit past ~20KB". It passed: the stylesheet
# repeated across 28 pages had pushed the home page to 41KB, over its budget.
#
# A <link> in <head> is render-blocking too, so the unstyled-paint argument
# survives the move. What changes is that the bytes are fetched once for the
# whole site instead of once per page.
#
# The filename carries a hash of the content, so the file can be cached for a
# year and still be impossible to serve stale: change the source and the URL
# changes with it. That is why these live under /build/ and not /assets/ -
# the logos there keep their filenames and so must keep a shorter cache.
# JS is NOT minified: a regex minifier cannot tell a comment from a "//"
# inside a string, and gzip already collapses the difference to a rounding
# error. Correctness over a few hundred bytes.
function Get-Hash8([string]$s) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash($Utf8NoBom.GetBytes($s))
        (($bytes | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 8)
    } finally { $sha.Dispose() }
}

$CssName = 'site.' + (Get-Hash8 $CssMin) + '.css'
$JsName  = 'site.' + (Get-Hash8 $Js)     + '.js'
$CssHref = '/build/' + $CssName
$JsHref  = '/build/' + $JsName
Write-Text (Join-Path $Out ('build\' + $CssName)) $CssMin
Write-Text (Join-Path $Out ('build\' + $JsName))  $Js

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

# ---- app screenshots on /download ----
# Installing an APK from outside the store is the highest trust barrier in the
# product. The page explains the Android warning well and states the checksum,
# but a visitor never SEES what they are about to install - trust is built by
# looking, not by reassurance.
#
# This builds the MECHANISM only. No image is invented and no alt text is
# written for a picture nobody has seen (m5): the alt line says what the file
# IS - a screenshot of the app - and claims nothing about its contents.
#
# The whole <section>, heading included, lives inside the generated variable,
# so an EMPTY FOLDER MEANS NO SECTION - never a heading over a blank strip.
# Drop files in site/static/assets/shots/ named shot-<n>-<lang>.png and they
# appear at the next build, in numeric order, with no edit here.
$script:ShotCount = 0
function Render-Shots($T, [string]$langCode, [string]$base) {
    $dir = Join-Path $SiteDir 'static\assets\shots'
    if (-not (Test-Path $dir)) { return '' }
    $files = @(Get-ChildItem -Path $dir -File -Filter "shot-*-$langCode.png" |
               Sort-Object { [int](($_.BaseName -split '-')[1]) })
    if ($files.Count -eq 0) { return '' }
    $script:ShotCount = $files.Count
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<section class="sec sec-alt"><div class="wrap">')
    [void]$sb.Append('<div class="rv"><span class="eyebrow">' + (HtmlEnc (Tx $T 'dlShotsEyebrow')) + '</span>')
    [void]$sb.Append('<h2 class="h2">' + (HtmlEnc (Tx $T 'dlShotsTitle')) + '</h2>')
    [void]$sb.Append('<p class="lead">' + (HtmlEnc (Tx $T 'dlShotsLead')) + '</p></div>')
    [void]$sb.Append('<div class="dl-shots">')
    $i = 0
    foreach ($f in $files) {
        $i++
        $n = ($f.BaseName -split '-')[1]
        # width/height declared so the page does not jump while they load, and
        # everything below the first one is lazy.
        $alt = (Tx $T 'dlShotAlt').Replace('{n}', [string]$n)
        [void]$sb.Append('<figure class="dl-shot"><img src="' + $base + '/assets/shots/' + $f.Name +
            '" alt="' + (HtmlEnc $alt) + '" width="390" height="844" decoding="async"' +
            $(if ($i -gt 1) { ' loading="lazy"' } else { '' }) + '></figure>')
    }
    [void]$sb.Append('</div></div></section>')
    $sb.ToString()
}

function Render-PlacesList($model, $T, [string]$base) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<div class="pl-grid">')
    foreach ($p in $model) {
        $href = $base + '/places/' + [uri]::EscapeDataString($p.slug) + '/'
        # data-area drives the filter chips; data-q is the haystack the search
        # box matches against. Both are plain attributes so the filter needs no
        # second copy of the data and the page still works with JS switched off.
        # The axis is the REGION, not the city: measured on today's data, all
        # six venues share one city and sit in six different regions, so city
        # chips would have been a filter that filters nothing.
        # data-price is the same number the card prints ("from N"), so sorting
        # and the range filter agree with what the visitor reads. data-rating is
        # written ONLY when the venue has been rated: a zero here would sort an
        # unrated venue below a one-star one, which is a claim the data does not
        # make. Absent means absent - the sort drops it to the end instead.
        $q = ($p.name + ' ' + $p.city + ' ' + $p.region + ' ' + $p.type)
        $attrs = ' data-area="' + (HtmlEnc $p.region) + '" data-q="' + (HtmlEnc $q) + '" data-price="' + ([int]$p.priceMin) + '"'
        if ($p.hasRating) { $attrs += ' data-rating="' + ('{0:0.#}' -f $p.rating) + '"' }
        [void]$sb.Append('<article class="pl-card"' + $attrs + '>')
        [void]$sb.Append('<a class="pl-link" href="' + $href + '">')
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

# Region chips for the directory filter. They come from the data, so a new
# region in the database becomes a new chip at the next build with no edit here.
# Rendered only when they would actually narrow anything: one region filters
# nothing, and past a dozen the chip row is worse than the search box.
function Render-Areas($model) {
    @($model | ForEach-Object { $_.region } | Where-Object { $_ -ne '' } | Sort-Object -Unique)
}

function Render-PlaceChips($model, $T) {
    $areas = Render-Areas $model
    if ($areas.Count -lt 2 -or $areas.Count -gt 12) { return '' }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<div class="pl-chips">')
    foreach ($a in $areas) {
        [void]$sb.Append('<button class="pl-chip" type="button" aria-pressed="false" data-area="' +
                         (HtmlEnc $a) + '">' + (HtmlEnc $a) + '</button>')
    }
    [void]$sb.Append('</div>')
    $sb.ToString()
}

# The numbers band on the home page. Every figure is counted from the rows the
# build just read - none is typed by hand, and an empty database renders no
# band at all rather than a row of zeros (honesty rule 5).
#
# The labels are definite plural nouns ("the venues", not "N venues") on
# purpose. Arabic changes the counted noun with the number - 3-10 takes the
# plural, 11+ the singular accusative - so a label that follows a live figure
# would read as broken Arabic half the time. A standing noun under the number
# is correct for every value, in both languages.
function Render-Stats($model, $T) {
    if ($model.Count -eq 0) { return '' }
    $fields = ($model | ForEach-Object { $_.fields.Count } | Measure-Object -Sum).Sum
    $areas  = (Render-Areas $model).Count
    $rows = @(
        @{ n = $model.Count; k = 'statPlaces' },
        @{ n = $fields;      k = 'statFields' },
        @{ n = $areas;       k = 'statAreas' }
    )
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<div class="stats">')
    $i = 0
    foreach ($r in $rows) {
        [void]$sb.Append('<div class="stat rv" style="--i:' + $i + '">')
        # The final number is in the markup: it is what a reader sees with the
        # counter script absent or motion switched off. The count-up is decoration.
        [void]$sb.Append('<span class="stat-n" data-count="' + $r.n + '">' + $r.n + '</span>')
        [void]$sb.Append('<span class="stat-k">' + (Tx $T $r.k) + '</span></div>')
        $i++
    }
    [void]$sb.Append('</div>')
    $sb.ToString()
}

function Render-PlaceBody($p, $T, [string]$base) {
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<section class="sec"><div class="wrap">')
    [void]$sb.Append('<a class="pl-back" href="' + $base + '/places/">' +
                     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
                     (Tx $T 'plBackToList') + '</a>')
    [void]$sb.Append('<h1 class="h1-page">' + (HtmlEnc $p.name) + '</h1>')
    [void]$sb.Append('<p class="lead">' + (HtmlEnc $p.region) + ' &middot; ' + (HtmlEnc $p.city) + ' &middot; ' + (HtmlEnc $p.type) + '</p>')
    if ($p.hasRating) { [void]$sb.Append('<p class="pl-rate-row">' + (Render-Stars $p $T) + '</p>') }

    [void]$sb.Append('<div class="pl-facts">')
    [void]$sb.Append('<div class="pl-fact"><span class="k">' + (Tx $T 'plPitches') + '</span><span class="v">' + $p.fields.Count + '</span></div>')
    # The range is wrapped in <bdi dir="ltr"> and the currency is left outside it.
    # Without that, an Arabic page renders "40 - 60" as "60 - 40": the dash is a
    # bidi-neutral character between two European numbers, so the surrounding RTL
    # direction wins and the two numbers swap - the page shows the highest price
    # first and the lowest second. Measured on rendered pixels, not assumed; the
    # DOM string is correct either way, which is exactly why this survived.
    # An en dash (U+2013), matching the home page's pricing tile: the same two
    # numbers are printed in both places and had drifted to two separators.
    $priceTxt = $(if ($p.priceMin -eq $p.priceMax) { (Fmt-Price $p.priceMin) } else { (Fmt-Price $p.priceMin) + [char]0x2013 + (Fmt-Price $p.priceMax) })
    [void]$sb.Append('<div class="pl-fact"><span class="k">' + (Tx $T 'plPriceHour') + '</span><span class="v"><bdi dir="ltr">' + $priceTxt + '</bdi> ' + (Tx $T 'plCurrency') + '</span></div>')
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
    # HtmlEnc escapes the quote so the attribute cannot be broken out of, but it
    # says nothing about the SCHEME - and a href is not safer than a src. The app
    # already gates image_url on http(s) (fieldImages); map_link never was, on
    # either surface. Whitelist the scheme; a link we will not vouch for is not
    # rendered at all rather than rendered broken.
    if ($p.map -and $p.map -match '^(?i)https?://') {
        [void]$sb.Append('<a class="btn btn-sec btn-lg" href="' + (HtmlEnc $p.map) + '" rel="noopener nofollow">' + (Tx $T 'plMapCta') + '</a>')
    }
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
            cssHref    = $CssHref
            jsHref     = $JsHref
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

        # ---- the "download the app" call to action ----
        # It points straight at the APK once a release exists, and falls back to
        # /download/ while none does - a button that downloads nothing is worse
        # than a button that explains why. Both states come from release.txt, so
        # neither is typed by hand.
        #
        # The `download` attribute is ignored cross-origin; GitHub Releases send
        # Content-Disposition: attachment, which is what actually saves the file.
        #
        # Going straight to the APK skips the page carrying the SHA-256 and the
        # sideload instructions, so ctaDlNote puts a link to them under the
        # button - present only when the button itself bypasses that page.
        if ($RelLive) {
            $vars['ctaDl']     = $Rel['url']
            $vars['ctaDlAttr'] = ' download rel="noopener"'
            $vars['ctaDlNote'] = ' <a class="in-link" href="' + $lang.base + '/download/">' +
                                 (Tx $T 'heroInstallGuide') + '</a>'
        } else {
            $vars['ctaDl']     = $lang.base + '/download/'
            $vars['ctaDlAttr'] = ''
            $vars['ctaDlNote'] = ''
        }

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
        $vars['placesChips'] = $(if ($PlaceModel.Count -gt 0) { Render-PlaceChips $PlaceModel $T } else { '' })
        $vars['statsBand']   = Render-Stats $PlaceModel $T
        $vars['appShots']    = Render-Shots $T $lang.code $lang.base
        # The counter's starting text is rendered with the real total, so the
        # line reads correctly before - and without - any script.
        $vars['plCountInit'] = (Tx $T 'plCountTpl').Replace('{n}', [string]$PlaceModel.Count)

        # ---- the pricing tile's figures ----
        # The real span of every listed pitch price, read from the same rows the
        # venue pages print. Nothing here is typed by hand: with no rows the
        # tile is not built at all (honesty rule m5), which is why priceSpan is
        # empty rather than "0" when the model is empty.
        # ---- which sports are actually open ----
        # Decision 7: the app is the single source of truth for what is bookable,
        # and the site mirrors it. In the app a sport is open when it has at
        # least one live field - not because a boolean was typed somewhere. So
        # this reads the same rows, and the two can no longer disagree: the site
        # cannot promise a sport the app does not serve.
        #
        # $SportLive is built once from the fetched fields (see above). Before
        # migration 13 the column does not exist, every field reads as football,
        # and the section renders exactly as it did before this change.
        foreach ($sk in @('football','padel','basket','tennis','volley')) {
            $on = $SportLive.ContainsKey($sk)
            $vars['sportSt' + $sk]  = $(if ($on) { Tx $T 'sportLive' } else { Tx $T 'sportSoon' })
            $vars['sportCls' + $sk] = $(if ($on) { ' sport-live' } else { '' })
        }

        # ---- the join form's closed lists (2.3) ----
        # Cities and regions come from the SAME rows the directory prints, not
        # from a hand-typed list. Free text would create "Amman" twice in two
        # spellings, and the site's own region filter splits silently on that -
        # the exact failure the admin panel's closed lists were built to stop.
        # The "other" escape is a real option, so a new value is a decision.
        $cityOpts = ''; $regionOpts = ''
        if ($PlaceModel.Count -gt 0) {
            foreach ($c in (@($PlaceModel | ForEach-Object { $_.city })  | Where-Object { $_ -ne '' } | Sort-Object -Unique)) {
                $cityOpts += '<option value="' + (HtmlEnc $c) + '">' + (HtmlEnc $c) + '</option>'
            }
            foreach ($r in (@($PlaceModel | ForEach-Object { $_.region }) | Where-Object { $_ -ne '' } | Sort-Object -Unique)) {
                $regionOpts += '<option value="' + (HtmlEnc $r) + '">' + (HtmlEnc $r) + '</option>'
            }
        }
        $vars['joinCityOpts']   = $cityOpts
        $vars['joinRegionOpts'] = $regionOpts
        # Sport labels come from the strings files, so both languages stay in step.
        $sportOpts = ''
        $sportKeyMap = [ordered]@{ football='sportFootball'; padel='sportPadel'; basket='sportBasket'; tennis='sportTennis'; volley='sportVolley' }
        foreach ($sk in $sportKeyMap.Keys) {
            $sportOpts += '<option value="' + $sk + '">' + (HtmlEnc (Tx $T $sportKeyMap[$sk])) + '</option>'
        }
        $vars['joinSportOpts'] = $sportOpts
        $vars['sbBase'] = ($SbUrl -replace '/rest/v1$', '')
        $vars['sbKey']  = $SbKey

        $vars['priceSpan'] = ''
        if ($PlaceModel.Count -gt 0) {
            $allPrices = @($PlaceModel | ForEach-Object { $_.fields } | ForEach-Object { [double]$_.price })
            $pLo = ($allPrices | Measure-Object -Minimum).Minimum
            $pHi = ($allPrices | Measure-Object -Maximum).Maximum
            # An en dash, not a hyphen: this is a numeric range, and the dash has
            # to read the same in an RTL line as in an LTR one.
            $vars['priceSpan'] = $(if ($pLo -eq $pHi) { (Fmt-Price $pLo) } else { (Fmt-Price $pLo) + [char]0x2013 + (Fmt-Price $pHi) })
        }

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

        $html = Remove-HtmlComments (Expand-Tpl $html $vars $T)

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
        $pHtml = Remove-HtmlComments (Expand-Tpl $pHtml $pv $T)

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
    # The dashboard links the same hashed stylesheet and script as the site, so
    # every change to the site's tokens, buttons, theme switch and motion
    # reaches it automatically instead of drifting into a second design.
    $av = @{
        cssHref    = $CssHref
        jsHref     = $JsHref
        sbBase     = $SbUrl -replace '/rest/v1$', ''
        sbKey      = $SbKey
        buildStamp = $BuildStamp
        year       = (Get-Date -Format 'yyyy')
    }
    Write-Text (Join-Path $Out 'admin\index.html') (Remove-HtmlComments (Expand-Tpl (Read-Text $adminSrc) $av $Strings['ar']))
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

# ---- static passthrough: assets ----
# _headers and _redirects lived here until 2026-08-09. They were Cloudflare
# Pages syntax on a Vercel deployment (owner decision 3), so nothing ever read
# them - and they had drifted into claiming protection the site did not have:
# HSTS and the /ar/* redirect were in them and NOT in vercel.json. Two files
# describing the same contract will always disagree eventually; the one that
# is not enforced is the one that lies. vercel.json is now the only source.
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
# (it spoke to Apps Script/Sheets while the app speaks to Postgres - that
# backend has been dead since 2026-08-06), which is exactly the double-booking
# hazard stage (D) existed to close.
# Removing it closes that hazard without touching the live app.
# /app/* now redirects to the download page - see "redirects" in vercel.json.

# ---- report ----
$totalBytes = (Get-ChildItem $Out -Recurse -File | Measure-Object Length -Sum).Sum
$homeChars  = (Read-Text (Join-Path $Out 'index.html')).Length
Write-Host ''
Write-Host ("  [site]   {0} pages -> public\  ({1:N0} KB total)" -f $written, ($totalBytes / 1KB)) -ForegroundColor Cyan
Write-Host ("  [build]  {0} ({1:N1} KB) + {2} ({3:N1} KB) - cached once for the whole site" -f `
            $CssName, ($CssMin.Length / 1KB), $JsName, ($Js.Length / 1KB)) -ForegroundColor DarkGray
# The budget is per page and the stylesheet no longer counts against it, so
# this now measures actual markup. Today's home page is ~21,700 chars; 28,000
# leaves room for a section or two before the page needs a second look.
Write-Host ("  [home]   {0:N0} chars of markup  (budget 28,000)" -f $homeChars) -ForegroundColor $(if ($homeChars -gt 28000) { 'Red' } else { 'Green' })
Write-Host ("  [origin] {0}" -f $SiteOrigin) -ForegroundColor DarkGray
# One line so the owner learns what is missing without reading any code. Zero
# is not a failure - it means the download page simply has no screenshot strip.
Write-Host ("  [shots]  {0} on /download - add more as site\static\assets\shots\shot-<n>-<lang>.png (390x844)" -f $script:ShotCount) `
           -ForegroundColor $(if ($script:ShotCount -gt 0) { 'Green' } else { 'DarkYellow' })
if ($script:Missing.Count -gt 0) {
    $uniq = $script:Missing | Sort-Object -Unique
    Write-Warning ("unresolved placeholders ({0}): {1}" -f $uniq.Count, ($uniq -join ', '))
} else {
    Write-Host '  [keys]   all placeholders resolved' -ForegroundColor Green
}
Write-Host ''
