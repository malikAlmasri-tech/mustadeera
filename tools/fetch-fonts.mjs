/* Downloads the five font families the app uses and writes them into
 * app/assets/fonts/ together with a local @font-face sheet.
 *
 * WHY
 * ---
 * The app is bundled inside the APK, but its fonts were not: app.html pulled
 * them from fonts.googleapis.com at runtime. In a native app that means
 *
 *   • first launch without a network falls back to a system font, so the whole
 *     type hierarchy the design rests on simply is not there;
 *   • every user's IP reaches a third party on every cold start, which the
 *     privacy page does not mention and should not have to;
 *   • and it is the root of the `document.fonts.ready` trap already recorded in
 *     CLAUDE.md: the English face is not fetched until English is first used,
 *     so a measurement taken at language switch lands on fallback metrics.
 *
 * Bundling fixes all three at once, and the cost is bytes in an APK that is
 * already megabytes.
 *
 * SUBSETS
 * -------
 * Google serves one file per unicode-range. We keep `arabic` and `latin` and
 * drop the rest (cyrillic, greek, vietnamese, latin-ext): the UI ships in
 * exactly two languages, and a face nobody can trigger is dead weight.
 *
 *   node tools/fetch-fonts.mjs
 *
 * Re-run only when a weight is added to the design. The output is committed,
 * so an ordinary build never touches the network.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEEP = new Set(['arabic', 'latin']);

/* TWO PRODUCTS, ONE GENERATOR, TWO OUTPUTS.
 * ------------------------------------------------------------------
 * app/ and site/ must not read each other's assets (see README.md), so each
 * owns its own copy of the font files. Copying them by hand would create two
 * sources of truth: adding a weight here would silently leave the other side
 * a version behind. So this tool writes BOTH, from one download cache.
 *
 * The site keeps its per-language split on purpose: an Arabic page has no use
 * for Inter and an English one none for Tajawal - one stylesheet request and
 * one font file saved off the critical path. The app ships a single sheet
 * because it is one bundle that switches language in place.
 *
 * Weights are exactly what each side's CSS asks for - no more. An unused
 * weight is invisible in review but real on disk. */
const TARGETS = [
  { out: 'app/assets/fonts', sheet: 'fonts.css', families: [
      'Montserrat:wght@600;700;800;900',
      'Changa:wght@600;700;800',
      'Tajawal:wght@400;500;700;800',
      'Inter:wght@400;500;600;700;800',
  ]},
  { out: 'site/static/assets/fonts', sheet: 'fonts-ar.css', families: [
      'Tajawal:wght@400;500;700;800',
      'Montserrat:wght@700;800;900',
  ]},
  { out: 'site/static/assets/fonts', sheet: 'fonts-en.css', families: [
      'Inter:wght@400;500;600;700',
      'Montserrat:wght@700;800;900',
  ]},
];

/* A modern desktop UA is required, not cosmetic: Google returns TTF instead of
   WOFF2 to clients it does not recognise, roughly quadrupling the download. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* Shared across targets: the same face requested by two products is downloaded
   once. Keyed by the remote URL, and the file itself is keyed by CONTENT hash
   below, so the app and the site can even end up with byte-identical names. */
const fetched = new Map();   // src URL -> Buffer

for (const TARGET of TARGETS) {
const { out: OUT, sheet: SHEET, families: FAMILIES } = TARGET;

const url = 'https://fonts.googleapis.com/css2?' +
  FAMILIES.map(f => 'family=' + encodeURIComponent(f)).join('&') + '&display=swap';

const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();

fs.mkdirSync(OUT, { recursive: true });

/* Blocks arrive as: /* subset *\/ @font-face { ... }  - the comment before each
   block is the only place the subset name appears, so split on it. */
const blocks = css.split(/\/\*\s*([a-z-]+)\s*\*\//i).slice(1);
const out = [];
let kept = 0, skipped = 0, bytes = 0;
const seen = new Map();   // src URL -> local filename
const byHash = new Map(); // content hash -> local filename

for (let i = 0; i < blocks.length; i += 2) {
  const subset = blocks[i].trim();
  const body = blocks[i + 1] || '';
  if (!KEEP.has(subset)) { skipped++; continue; }

  const family = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
  const weight = (body.match(/font-weight:\s*(\d+)/) || [])[1];
  const src = (body.match(/url\((https:\/\/[^)]+)\)/) || [])[1];
  const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
  if (!family || !weight || !src) continue;

  /* Deduplicate by CONTENT, not by name. Montserrat, Inter, Cairo and Changa
     ship as variable fonts, so Google returns the *same bytes* for every weight
     of a family+subset - naming files by weight downloaded Montserrat four
     times and Inter five. Hashing collapses them and the @font-face rules just
     point at the same file, which is what a variable font is for. Measured:
     784 KB -> the number printed at the end. */
  const cached = seen.get(src);
  let file;
  if (cached) {
    file = cached;
  } else {
    let buf = fetched.get(src);
    if (!buf) {
      buf = Buffer.from(await (await fetch(src, { headers: { 'User-Agent': UA } })).arrayBuffer());
      fetched.set(src, buf);
    }
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
    file = `${family.toLowerCase()}-${subset}-${hash}.woff2`;
    const dest = path.join(OUT, file);
    if (!fs.existsSync(dest)) { fs.writeFileSync(dest, buf); bytes += buf.length; }
    byHash.set(hash, file);
    seen.set(src, file);
  }
  kept++;

  out.push(
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    /* swap, not block: the app must render immediately on first launch. The
       fonts are local now, so the swap window is a frame, not a network trip. */
    /* ⚠️ A bare filename, NOT 'assets/fonts/…'. A url() inside a stylesheet
       resolves against the STYLESHEET, not the document — so the qualified
       path produced assets/fonts/assets/fonts/… and every face 404'd while
       the page still rendered, in a fallback font, with no error but thirteen
       silent 404s. Caught by loading the preview, not by reading the code. */
    `font-display:swap;src:url('${file}') format('woff2');` +
    (range ? `unicode-range:${range.trim()};` : '') + '}'
  );
}

/* Measured from disk, not from what this run happened to download: existing
   files are skipped, so counting only new bytes reported "0 KB" on a re-run
   and made the sheet's own header lie about its size. */
const total = fs.readdirSync(OUT)
  .filter(f => f.endsWith('.woff2'))
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);

fs.writeFileSync(
  path.join(OUT, SHEET),
  '/* GENERATED by tools/fetch-fonts.mjs - do not edit by hand.\n' +
  '   Filenames are bare: url() resolves against THIS stylesheet, not the document.\n' +
  `   ${kept} @font-face rules over ${byHash.size} files (arabic + latin only); ${(total / 1024).toFixed(0)} KB in this folder.\n` +
  '   Fewer files than rules is correct: a variable font serves every weight from one file. */\n' +
  out.join('\n') + '\n'
);

console.log(`${OUT}/${SHEET}: ${kept} rules over ${byHash.size} files, ${skipped} subsets skipped, folder ${(total / 1024).toFixed(0)} KB`);
}
