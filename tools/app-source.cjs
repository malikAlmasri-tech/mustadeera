/* ═══════════════════════════════════════════════════════════════════════════
   app-source — مصدر التطبيق كما يراه البناء، مجموعًا

   `app.js` كان ملفًّا واحدًا (٨٬٦٦٣ سطرًا) فصار **خمسة** يضمّها `build.ps1`
   بالترتيب. وسبعة أدواتٍ كانت تقرأ الملفّ الواحد؛ ولو نسخ كلٌّ منها قائمة
   الأجزاء لصار عندنا ثمانية مصادر لحقيقةٍ واحدة، وأوّلُ جزءٍ يُضاف يجعل
   سبعةً منها تكذب بصمت — وهو بالضبط الانحراف الذي بُنيت له حرّاس المرآة.

   فالقائمة تُقرأ **من `build.ps1` نفسه**: هو الذي يبني الـAPK، فهو صاحب
   القول في «ما هو مصدر التطبيق». وإن تغيّر الترتيب أو أُضيف جزء، تتبعه
   الأدوات كلُّها بلا لمسة.
   ⚠️ ولا يُقرأ المجلَّد بـglob: الترتيب **حامل**، وسردُ الملفّات أبجديًّا
      يبدو صحيحًا اليوم (‏1..5) ويصير خاطئًا عند أوّل اسمٍ لا يبدأ برقم.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'app', 'src');

function parts() {
  const ps = fs.readFileSync(path.join(ROOT, 'build.ps1'), 'utf8');
  const m = ps.match(/\$AppParts\s*=\s*@\(([\s\S]*?)\)/);
  if (!m) throw new Error('app-source: لم يُعثَر على $AppParts في build.ps1');
  const names = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (!names.length) throw new Error('app-source: قائمة $AppParts فارغة');
  for (const n of names) {
    if (!fs.existsSync(path.join(SRC, n))) throw new Error('app-source: جزءٌ مفقود ' + n);
  }
  return names;
}

/* النصّ المدموج — **نفس ما يُحقَن في index.html حرفًا بحرف**: بلا فاصل بين
   الأجزاء، وبنفس ترتيب البناء. فما يفحصه الحارس هو ما يُشحَن. */
function read() {
  return parts().map((n) => fs.readFileSync(path.join(SRC, n), 'utf8')).join('');
}

/* للحرّاس التي تريد أن تسمّي الملفّ والسطر: تُرجع القطع بإزاحاتها كي يُترجَم
   رقمُ سطرٍ في المدموج إلى «الملفّ الفلاني، السطر كذا». */
function readWithMap() {
  let line = 1;
  const map = [];
  const chunks = parts().map((n) => {
    const t = fs.readFileSync(path.join(SRC, n), 'utf8');
    map.push({ name: n, from: line, to: line + t.split('\n').length - 1 });
    line += t.split('\n').length - 1;
    return t;
  });
  return { text: chunks.join(''), map };
}

const locate = (map, line) => (map.find((p) => line >= p.from && line <= p.to) || { name: '?' , from: 1 });

module.exports = { parts, read, readWithMap, locate, SRC };
