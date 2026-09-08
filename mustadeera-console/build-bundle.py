# -*- coding: utf-8 -*-
"""يبني «المستديرة-الكود-الكامل.md» من الملفّات الخمسة.

هذا الملفّ هو ما يُرسَل للمالك ليلصقه في محرّر Apps Script — وكان يُجمَّع
بيد، ونسخةٌ بيدٍ من خمسة ملفّات **تنحرف**: أوّل تعديلٍ يُنسى فيها يجعل
المالك يلصق كودًا أقدم ممّا في المستودع بلا أن يصرخ شيء.

    python build-bundle.py
"""
import io, os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "المستديرة-الكود-الكامل.md")

# الترتيب هو ترتيب الأقسام في الملفّ، وأسماؤها كما تظهر في Apps Script
PARTS = [
    ("WebApp.gs",    "javascript"),
    ("Index.html",   "html"),
    ("Styles.html",  "html"),
    ("Model.html",   "html"),
    ("Script.html",  "html"),
]

HEAD = """# المستديرة — لوحة الإدارة على الويب

موقع Apps Script يقرأ ويكتب في نفس شيت «المستديرة». خمسة ملفّات، مجموعة هنا في ملفّ واحد للمراجعة.

**بنية المشروع الفعلية على Google Apps Script:**

| اسم الملفّ في Apps Script | النوع | يقابله هنا |
|---|---|---|
| `WebApp` | Script (.gs) | القسم ١ |
| `Index` | HTML | القسم ٢ |
| `Styles` | HTML | القسم ٣ |
| `Model` | HTML | القسم ٤ |
| `Script` | HTML | القسم ٥ |

`Index.html` يستدعي الثلاثة الباقية بـ `<?!= include('Styles'); ?>` وما شابه — فهي مُدمَجة عند التقديم لا عند التحرير.

⚠️ **هذا الملفّ مولَّد** بـ`python build-bundle.py` — لا تحرّره بيد، حرّر المصدر وأعد التوليد.

---
"""


def main():
    chunks = [HEAD]
    for i, (name, lang) in enumerate(PARTS, start=1):
        path = os.path.join(ROOT, name)
        with io.open(path, encoding="utf-8") as f:
            body = f.read().rstrip("\n")
        chunks.append("\n## القسم %d — `%s`\n\n```%s\n%s\n```\n\n---\n" % (i, name, lang, body))
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(chunks))
    size = os.path.getsize(OUT)
    print("wrote %s (%d bytes, %d parts)" % (os.path.basename(OUT), size, len(PARTS)))


if __name__ == "__main__":
    main()
