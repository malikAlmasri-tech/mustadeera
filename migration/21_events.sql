-- ═══════════════════════════════════════════════════════════════════════════
--  21 — قياس ما لم يحدث: بحثٌ بلا نتيجة، وزيارةٌ بلا حجز
--
--  كل ما نقيسه اليوم هو النجاح
--  ───────────────────────────
--  `bookings` تعرف من حجز. ولا شيء في المنتج يعرف **من أراد ولم يجد**:
--    • بحثٌ عن منطقة لا ملعب فيها = **خريطة توسّع**. اسمُ المنطقة الذي يتكرّر
--      بلا نتيجة هو المكان الذي يستحقّ مندوبًا، وهو معروفٌ اليوم لصاحب
--      البحث وحده ثمّ يضيع.
--    • مكانٌ يُفتَح كثيرًا ولا يُحجَز = مشكلة تحويل: سعرٌ أو صورة أو أوقات.
--  ولا يُقاس أيٌّ منهما بأثر رجعي — إمّا يُسجَّل حين يقع أو لا يوجد أبدًا.
--
--  🔒 الخصوصية: **جدولٌ ضيّق عمدًا**
--  ────────────────────────────────
--  لا رقم هاتف · لا اسم · لا موقع · لا نصّ حرّ من المستخدم إلّا **كلمةَ بحثٍ
--  مُطبَّعة** (‏وهي ما نقيسه أصلًا). و`profile_id` يُكتبه الخادم من الجلسة ولا
--  يُقبَل من العميل — كي لا ينسب أحدٌ حدثًا لغيره. والقراءة **للأدمن وحده**؛
--  المُرسِل نفسه لا يقرأ ما أرسل.
--  والقائمة **مغلقة**: نوعٌ خارجها يُرفَض بقيد، فلا يتسلّل حقلٌ جديد بلا مراجعة.
--
--  ⚡ ولا يُبطئ شيئًا ولا يكسر شيئًا
--  ───────────────────────────────
--  الإدراج **دفعةً واحدة** كل بضع ثوانٍ، بلا انتظار، ويُبتلع فشلُه بصمت.
--  ولا حدث واحد على مسار الحجز يسبق الحجزَ نفسه. غياب القياس مقبول؛
--  حجزٌ يتعثّر لأن سطر تحليلات فشل ليس مقبولًا.
--
--  مستقلّ تمامًا. (‏العرض `admin_slot_demand` يذكر `slot_watch` من ترحيل 20،
--  ويُنشأ فقط إن كان موجودًا — والباقي يعمل بدونه.)
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.events (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  kind       text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  payload    jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_kind_chk') then
    -- مرآة `EV` في app/src/app.js — لا نوع في أحدهما بلا الآخر.
    alter table public.events add constraint events_kind_chk
      check (kind in ('search_empty','place_view','booking_started','booking_submitted','slot_watch'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_payload_chk') then
    -- سقفُ حجمٍ على الحمولة: الجدول مفتوح للإدراج من `anon`، وبلا سقف يصير
    -- قناةَ تخزينٍ مجّانية لأي أحد.
    alter table public.events add constraint events_payload_chk
      check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 500);
  end if;
end $$;

create index if not exists events_kind_at_idx on public.events(kind, at desc);

alter table public.events enable row level security;

drop policy if exists ev_insert on public.events;
drop policy if exists ev_admin  on public.events;

create policy ev_insert on public.events for insert to anon, authenticated with check (true);
create policy ev_admin  on public.events for all using (public.is_admin()) with check (public.is_admin());

grant insert on public.events to anon, authenticated;
grant select on public.events to authenticated;   -- وRLS تقصرها على الأدمن

-- الخادم يملأ `profile_id` و`at`، ويطهّر الحمولة. عميلٌ يرسل `profile_id`
-- لغيره أو `at` قديمًا لا يُصدَّق.
create or replace function public.fn_events_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.profile_id := auth.uid();
  new.at         := now();
  if new.payload is null or jsonb_typeof(new.payload) <> 'object' then
    new.payload := '{}'::jsonb;
  end if;
  -- كلمة البحث وحدها نصٌّ حرّ، ولها سقف. وما عداها مفاتيح معرّفة.
  if new.payload ? 'q' then
    new.payload := jsonb_set(new.payload, '{q}', to_jsonb(left(new.payload->>'q', 60)));
  end if;
  return new;
end $$;

drop trigger if exists t_events_guard on public.events;
create trigger t_events_guard before insert on public.events
  for each row execute function public.fn_events_guard();

-- ───────────────────────────────────────────────────────────────────────────
--  العروض — التجميع في القاعدة لا في المتصفّح
--
--  ⚠️ ولكلّ رقمٍ **نافذته ومقامه** في العرض نفسه، لا في تعليقٍ فوق الجدول:
--     «٣٠٪ تحويل» بلا «من كم؟» و«خلال متى؟» رقمٌ لا يُقارَن بشيء.
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.admin_funnel with (security_invoker = on) as
  select date_trunc('day', at at time zone 'Asia/Amman')::date as d,
         count(*) filter (where kind = 'place_view')        as viewed,
         count(*) filter (where kind = 'booking_started')   as started,
         count(*) filter (where kind = 'booking_submitted') as submitted
    from public.events
   where at > now() - interval '90 days'
   group by 1 order by 1 desc;

create or replace view public.admin_empty_searches with (security_invoker = on) as
  select payload->>'q' as q, count(*) as n, max(at) as last_at
    from public.events
   where kind = 'search_empty' and coalesce(payload->>'q','') <> ''
     and at > now() - interval '90 days'
   group by 1 order by n desc, last_at desc;

do $$
begin
  if to_regclass('public.slot_watch') is null then
    raise notice 'ترحيل 20 غير مُشغَّل ⇒ لا عرض «الخانات المطلوبة». وبقيّة الملفّ تعمل.';
    return;
  end if;
  execute $v$
    create or replace view public.admin_slot_demand with (security_invoker = on) as
      select w.field_id, f.name as field_name, p.name as place_name,
             w.watch_date, w.hour, count(*) as wants,
             count(*) filter (where w.notified_at is null) as still_waiting
        from public.slot_watch w
        join public.fields f on f.id = w.field_id
        join public.places p on p.id = f.place_id
       where w.watch_date >= (now() at time zone 'Asia/Amman')::date - 30
       group by 1,2,3,4,5
       order by wants desc, w.watch_date;
  $v$;
end $$;

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ⚠️ ① **الجدول غير مقروء بالمفتاح العام.** من نافذة خاصّة بلا تسجيل دخول:
--      GET /rest/v1/events?select=*                 ⇒ المتوقّع 401/403 لا 200
--      GET /rest/v1/events?select=id&order=at.desc  ⇒ نفس الشيء
--    والإدراج يمرّ:
--      POST /rest/v1/events  [{"kind":"place_view","payload":{"place_id":"…"}}] ⇒ 201
--
-- ② نوعٌ خارج القائمة يُرفَض:
--      POST … [{"kind":"whatever"}]   ⇒ 400 (‏events_kind_chk)
--
-- ③ `profile_id` لا يُزوَّر: أرسل `"profile_id":"<uuid آخر>"` بتوكن لاعب،
--    ثمّ تحقّق (بحساب أدمن) أن المكتوب هو `auth.uid()` لا ما أُرسل.
--
-- ④ بحثٌ عن منطقة لا ملعب فيها من التطبيق ⇒ **صفٌّ واحد** لا صفٌّ لكل حرف:
--      select q, n from public.admin_empty_searches limit 10;
--
-- ⑤ القمع يُطابق `bookings` في نفس النافذة (فرقٌ صغير طبيعي: الحجز اليدوي
--    الذي يُدخله المالك لا يمرّ بالتطبيق فلا حدث له):
--      select * from public.admin_funnel limit 7;
