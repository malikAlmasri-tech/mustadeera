-- ═══════════════════════════════════════════════════════════════════════════
--  14 — الإشعارات: طلبٌ يصل المالك، وتأكيدٌ يصل اللاعب
--
--  ما الذي يفعله هذا الملفّ فعلًا؟
--  ─────────────────────────────
--  يجعل الحجز **حوارًا** بعد أن كان رسالةً في اتّجاه واحد. اليوم يرسل اللاعب
--  طلبه ثمّ لا يعرف شيئًا حتى يفتح «حجوزاتي» بنفسه؛ والمالك لا يعرف بالطلب
--  إلّا إن صادف أن لوحته مفتوحة (‏`refreshOwnerSilent` تستطلع كل دقيقة).
--  بعد هذا الملفّ يكتب **الخادم** صفَّ إشعار عند كل حدث يهمّ طرفًا، فيصل
--  حتى لو كان التطبيق مغلقًا وقتها — ويقرؤه صاحبه عند أوّل فتح.
--
--  🔒 لماذا مُشغِّل داخل القاعدة لا كتابة من التطبيق؟
--  ────────────────────────────────────────────────
--  لأن الطرف الذي **يستفيد** من الإشعار ليس هو الطرف الذي يُنشئ الحدث:
--  اللاعب يُدرِج الحجز، والإشعار يخصّ المالك. ولو كتبه التطبيق لاحتاج اللاعبُ
--  صلاحيةَ الكتابة في صفوف غيره — أي أن يستطيع أيّ أحد إغراق أيّ أحد. ولو
--  نسي التطبيقُ الكتابةَ (انقطاع شبكة بعد نجاح الحجز) لضاع الإشعار وبقي
--  الحجز. المُشغِّل يكتب في **نفس معاملة** الحجز: إمّا يقعان معًا أو لا يقع
--  أيّهما. ولا سياسة `insert` لأحد ⇒ لا يستطيع أيّ عميل تلفيق إشعار.
--
--  🌍 ولماذا لا يُخزَّن نصّ الإشعار؟
--  ───────────────────────────────
--  التطبيق ثنائي اللغة، والنصّ المخزَّن يُجمَّد على لغة **لحظة الكتابة**:
--  من بدّل لغته بعدها يقرأ إشعاراته القديمة بلغته السابقة إلى الأبد. لذلك
--  يُخزَّن `kind` ومعطياته (`data`) فقط، **وتُكتب الجملة في الواجهة** من
--  ملفّ اللغة الحالي. ولا حرف عربي واحد في هذا الملفّ خارج التعليقات.
--
--  ⚠️ التطبيق يعمل بلا هذا الترحيل
--  ──────────────────────────────
--  الجدول غير موجود ⇒ PostgREST يردّ 404/`PGRST205` على كل قراءة، والتطبيق
--  **يمسك ذلك ويقول سببه صراحةً** في مركز الإشعارات («الإشعارات غير مُفعّلة
--  على الخادم بعد») بدل قائمة فارغة تُوهم بأنه لا جديد. الحجز والتأكيد
--  والإلغاء تعمل كلّها كما هي.
--
--  📵 وما لا يفعله هذا الملفّ
--  ─────────────────────────
--  **لا يوقظ هاتفًا مغلقًا.** إيقاظ جهاز يتطلّب خدمة دفع (FCM) بمشروع
--  Firebase ومفتاح خادم — وهي بنية تحتية عند المالك لا سطرُ SQL. ما يفعله
--  هذا الملفّ أن الإشعار **موجودٌ ومحفوظ** حين يُفتح التطبيق، والتطبيق
--  يُظهره عندها إشعارَ جهاز حقيقيًّا (‏`@capacitor/local-notifications`).
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null,
  booking_id   uuid references public.bookings(id) on delete cascade,
  place_id     uuid references public.places(id)   on delete cascade,
  -- معطيات الجملة لا الجملة: place_name / field_name / booking_date /
  -- time_label / price / customer_name / cancel_reason
  data         jsonb not null default '{}'::jsonb,
  read_at      timestamptz,          -- فتحه صاحبه في مركز الإشعارات
  delivered_at timestamptz           -- أُظهر إشعارَ جهاز (كي لا يتكرّر إظهاره)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_kind_chk') then
    alter table public.notifications add constraint notifications_kind_chk
      check (kind in ('booking_new','booking_confirmed','booking_rejected',
                      'booking_cancelled','booking_moved'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notifications_data_obj_chk') then
    alter table public.notifications add constraint notifications_data_obj_chk
      check (jsonb_typeof(data) = 'object');
  end if;
end $$;

-- القراءة دائمًا «صفوفي، الأحدث أوّلًا» ⇒ فهرس مركّب على الاثنين معًا.
create index if not exists notifications_owner_idx
  on public.notifications(profile_id, created_at desc);
-- والاستعلام الأكثر تكرارًا: «هل عندي غير مقروء؟» — فهرس جزئي صغير.
create index if not exists notifications_unread_idx
  on public.notifications(profile_id) where read_at is null;

-- ───────────────────────────────────────────────────────────────────────────
--  RLS — لا أحد يكتب، وكلٌّ يرى صفوفه
-- ───────────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists notif_read     on public.notifications;
drop policy if exists notif_mark     on public.notifications;
drop policy if exists notif_clear    on public.notifications;

create policy notif_read on public.notifications for select
  using (profile_id = auth.uid());

-- ⚠️ سياسة RLS تحكم **الصفوف لا الأعمدة** (نفس درس الترحيل 09 و12): هذه
--    السياسة تسمح لصاحب الصفّ بتحديثه، ولا تمنعه من تحديث `kind` أو `data`
--    أو `profile_id` — أي أن يعيد كتابة إشعاره أو يهديه لغيره. المُشغِّل
--    أدناه هو الذي يقصر التحديث على `read_at`/`delivered_at` فعلًا.
create policy notif_mark on public.notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy notif_clear on public.notifications for delete
  using (profile_id = auth.uid());

-- لا سياسة `insert` إطلاقًا ⇒ لا `anon` ولا `authenticated` يستطيع إنشاء صفّ.
-- الكاتب الوحيد هو المُشغِّل أدناه، وهو `security definer` فيتجاوز RLS.

create or replace function public.fn_notif_guard()
returns trigger language plpgsql as $$
begin
  -- ما عدا العَلَمين، كل حقل يعود إلى قيمته القديمة قسرًا. لا نرفع خطأ:
  -- الواجهة لا ترسل غيرهما أصلًا، والرفض يكسر «علّم الكل كمقروء» بلا داعٍ.
  new.id         := old.id;
  new.created_at := old.created_at;
  new.profile_id := old.profile_id;
  new.kind       := old.kind;
  new.booking_id := old.booking_id;
  new.place_id   := old.place_id;
  new.data       := old.data;
  return new;
end $$;

drop trigger if exists t_notif_guard on public.notifications;
create trigger t_notif_guard before update on public.notifications
  for each row execute function public.fn_notif_guard();

-- ───────────────────────────────────────────────────────────────────────────
--  المُشغِّل: من الحجز إلى الإشعار
--
--  ثلاث قواعد تحكم «من يُشعَر»، وكلّها من نفس المبدأ:
--  **لا يُشعَر أحدٌ بفعلٍ فعله بنفسه.** إشعارُك بما فعلتَه قبل ثانية ضجيج
--  يُدرِّب صاحبه على تجاهل الإشعارات كلّها — ومنها التي تهمّه.
--    ① طلبٌ جديد ⇒ لمُلّاك المكان، إلّا إذا كان المُدرِج أحدهم (حجز يدوي).
--    ② تأكيد/رفض/إلغاء ⇒ للّاعب، إلّا إذا كان هو من ألغى.
--    ③ نقل موعد ⇒ للمُلّاك، إلّا إذا كانوا هم من نقله.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_notify_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
  actor   uuid := auth.uid();
begin
  -- أسماء المكان والملعب تُلتقط **الآن** لا وقت القراءة: الإشعار سجلّ لحظته،
  -- ولو أُعيدت تسمية الملعب غدًا وجب أن يبقى الإشعار صادقًا عمّا حدث.
  select jsonb_build_object(
           'place_name',    p.name,
           'field_name',    f.name,
           'sport',         f.sport,
           'booking_date',  new.booking_date,
           'time_label',    new.time_label,
           'hour',          new.hour,
           'price',         new.price,
           'customer_name', new.customer_name,
           'cancel_reason', coalesce(new.cancel_reason, '')
         )
    into payload
    from public.places p, public.fields f
   where p.id = new.place_id and f.id = new.field_id;

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.notifications(profile_id, kind, booking_id, place_id, data)
      select po.profile_id, 'booking_new', new.id, new.place_id, payload
        from public.place_owners po
       where po.place_id = new.place_id
         and po.profile_id is distinct from actor;   -- حجزٌ أدخله المالك بنفسه
    end if;
    return new;
  end if;

  -- تغيّرت الحالة ⇒ اللاعب هو المعنيّ (والحجز اليدوي بلا `player_id` فلا مُعلَم له)
  if new.status is distinct from old.status and new.player_id is not null then
    if new.status = 'confirmed' then
      insert into public.notifications(profile_id, kind, booking_id, place_id, data)
      values (new.player_id, 'booking_confirmed', new.id, new.place_id, payload);
    elsif new.status = 'rejected' then
      insert into public.notifications(profile_id, kind, booking_id, place_id, data)
      values (new.player_id, 'booking_rejected', new.id, new.place_id, payload);
    elsif new.status = 'cancelled' and new.player_id is distinct from actor then
      insert into public.notifications(profile_id, kind, booking_id, place_id, data)
      values (new.player_id, 'booking_cancelled', new.id, new.place_id, payload);
    end if;
  end if;

  -- نُقل الموعد (ترحيل 09) ⇒ المُلّاك هم من يحتاج معرفته: خانتهم تغيّرت.
  if (new.booking_date is distinct from old.booking_date
      or new.hour is distinct from old.hour
      or new.field_id is distinct from old.field_id) then
    insert into public.notifications(profile_id, kind, booking_id, place_id, data)
    select po.profile_id, 'booking_moved', new.id, new.place_id,
           payload || jsonb_build_object('from_date', old.booking_date,
                                         'from_time', old.time_label)
      from public.place_owners po
     where po.place_id = new.place_id
       and po.profile_id is distinct from actor;
  end if;

  return new;
end $$;

drop trigger if exists t_notify_bookings on public.bookings;
create trigger t_notify_bookings after insert or update on public.bookings
  for each row execute function public.fn_notify_booking();

-- ───────────────────────────────────────────────────────────────────────────
--  البثّ الحيّ (اختياري — التطبيق يستطلع أيضًا)
--
--  بإدراج الجدول في نشر `supabase_realtime` يصل الإشعار **في نفس اللحظة**
--  لتطبيق مفتوح، بدل انتظار دورة الاستطلاع. وRLS يُطبَّق على البثّ كما على
--  القراءة ⇒ `notif_read` وحدها تكفي، ولا يصل أحدًا صفُّ غيره.
--  ⚠️ ونجاح الاشتراك ليس دليلًا على وصول شيء (درس الترحيل 08) — التطبيق
--     يبقي الاستطلاع عاملًا في الحالتين، فالبثّ تسريعٌ لا شرط.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① الجدول موجود وسياساته الثلاث فقط (لا سياسة insert):
--      select policyname, cmd from pg_policies where tablename = 'notifications';
--    المتوقّع: notif_read (SELECT) · notif_mark (UPDATE) · notif_clear (DELETE)
--
-- ② أنشئ حجزًا من التطبيق بحساب لاعب، ثمّ:
--      select kind, profile_id, data->>'place_name' from public.notifications
--      order by created_at desc limit 5;
--    المتوقّع صفّ `booking_new` لكل مالك مربوط بذلك المكان.
--
-- ③ أكّد الحجز من لوحة المالك ⇒ يظهر صفّ `booking_confirmed` باسم اللاعب.
--
-- ④ أن العميل لا يستطيع التلفيق (بالمفتاح العام، بجلسة لاعب):
--      POST /rest/v1/notifications  ⇒ المتوقّع 401/403، لا 201.
