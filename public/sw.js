/* المستديرة — Service Worker
   الغرض الوحيد: أن يصير التثبيت من المتصفّح ممكنًا (آيفون خصوصًا، حيث لا APK)،
   وأن تفتح الصفحات إن انقطع الإنترنت لحظيًّا.

   ⚠️ الاستراتيجية مقصودة: **الشبكة أوّلًا للصفحات**.
   الكاش-أوّلًا كان سيُظهر نسخة قديمة من الموقع بعد كل نشر، والمستخدم لا يملك
   وسيلة لإبطالها. هنا الكاش شبكة أمان للانقطاع فقط، لا مصدرًا للمحتوى.

   2026-07-28 يُحقَن وقت البناء ⇒ كل نشر يُنشئ كاشًا جديدًا ويمسح القديم. */

const V = 'mustadeera-2026-07-28';
const OFFLINE_FALLBACK = '/';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V).then((c) => c.addAll(['/', '/places/', '/download/'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // الخطوط والصور الخارجية تُترك للمتصفّح

  // الصفحات: الشبكة أوّلًا، والكاش عند الفشل فقط
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(V).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE_FALLBACK)))
    );
    return;
  }

  // الأصول ذات العمر الطويل: الكاش أوّلًا مع تحديث صامت في الخلفية
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(V).then((c) => c.put(req, copy));
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
