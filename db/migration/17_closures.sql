-- ═══════════════════════════════════════════════════════════════════════════
--  17 — إغلاق يوم (أو ساعات منه): «هذا الوقت غير متاح» بدائيّةٌ لم تكن موجودة
--
--  ما الذي كان يفعله المالك قبل هذا الملفّ؟
--  ────────────────────────────────────────
--  **يزوّر حجزًا يدويًّا في كل خانة.** صيانة · مطر · بطولة خاصّة · عطلة —
--  كلّها تُغلَق اليوم بثماني حجوزات وهمية باسم «حجز خارجي». وأثر ذلك ليس
--  إزعاجًا فحسب: تلك الحجوزات **تدخل الإيراد والإشغال ومتوسّط السعر**،
--  فيقرأ المالكُ يومَ صيانةٍ ممتلئًا ناجحًا. المقياس يتلف والبيانات تكذب.
--
--  🔑 والإغلاق ليس حجزًا، ولا يجوز أن يُخزَّن كحجز
--  ─────────────────────────────────────────────
--  الحجز بيعٌ لخانة، والإغلاق **سحبُها من العرض**. جدولان لأن السؤالين
--  مختلفان: «كم بعتَ؟» لا يجوز أن يشمل ما لم يُعرَض أصلًا، و«كم خانةً
--  فارغة؟» لا يجوز أن يعدّ ما كان مغلقًا (وإلّا قرأت اللوحة جمعةً مغلقة
--  «إيرادًا ضائعًا» إلى الأبد).
--
--  👁️ والقراءة **عامّة**، لا للمالك وحده
--  ────────────────────────────────────
--  اللاعب لا بدّ أن يرى **لماذا** اليوم مظلم. خانةٌ تختفي بلا سبب تُقرأ
--  عطلًا في التطبيق؛ وخانةٌ مكتوبٌ عليها «مغلق — صيانة» معلومةٌ يحترمها.
--  ولذلك تختلف عن المحجوزة في العرض: المحجوزة تُقال «محجوز»، والمغلقة
--  تُقال «مغلق» ومعها سببها.
--
--  🛡️ ولا يستطيع الإغلاق أن يُخفي حجزًا مؤكّدًا
--  ──────────────────────────────────────────
--  لاعبٌ يملك حجزًا مؤكّدًا اتّفق عليه الطرفان، وإخفاؤه بإغلاقٍ صامت يجعله
--  يصل الملعب فيجده مقفلًا. المُشغِّل أدناه **يرفض** الإغلاق ويسمّي الحجوزات
--  المتعارضة، ولا يُلغيها نيابةً عن المالك: الإلغاء قرارُه هو، ويجب أن يمرّ
--  بمسار الإلغاء المعتاد كي يصل اللاعبَ إشعارُه.
--
--  ⏱️ ونطاق الساعات **تداخل** لا احتواء
--  ───────────────────────────────────
--  الخانة ساعتان، فخانة تبدأ 18 تتعارض مع إغلاق [19,22) ولو بدأت قبله.
--  الاختبار: `slot_start < to_hour AND slot_start + 2 > from_hour`.
--  و`from_hour`/`to_hour` فارغتان معًا = **اليوم كلّه**.
--
--  مستقلّ تمامًا: لا يعتمد على 14 ولا 15 ولا 16.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.field_closures (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  field_id     uuid not null references public.fields(id) on delete cascade,
  closure_date date not null,
  -- فارغتان معًا = اليوم كلّه. وإلّا نطاق نصف مفتوح [from, to) بساعات الحائط.
  from_hour    smallint check (from_hour between 0 and 24),
  to_hour      smallint check (to_hour   between 0 and 24),
  reason       text not null default ''
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'field_closures_range_chk') then
    alter table public.field_closures add constraint field_closures_range_chk
      -- إمّا الاثنتان فارغتان (يوم كامل) وإمّا الاثنتان موجودتان ومرتّبتان.
      check ( (from_hour is null and to_hour is null)
              or (from_hour is not null and to_hour is not null and to_hour > from_hour) );
  end if;
end $$;

create index if not exists field_closures_lookup_idx
  on public.field_closures(field_id, closure_date);

-- ───────────────────────────────────────────────────────────────────────────
--  RLS — القراءة للجميع، والكتابة لمالك المكان أو الأدمن
-- ───────────────────────────────────────────────────────────────────────────
alter table public.field_closures enable row level security;

drop policy if exists closures_read  on public.field_closures;
drop policy if exists closures_write on public.field_closures;

-- عامّة عمدًا: اللاعب الزائر (بلا تسجيل دخول) يتصفّح الأوقات، ولا بدّ أن
-- يرى المغلق مغلقًا. ولا شيء شخصي في الصفّ — لا اسم ولا رقم.
create policy closures_read on public.field_closures for select using (true);

create policy closures_write on public.field_closures for all
  using (
    public.is_admin()
    or exists (select 1 from public.fields f
                where f.id = field_id and public.owns_place(f.place_id))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.fields f
                where f.id = field_id and public.owns_place(f.place_id))
  );

grant select on public.field_closures to anon, authenticated;
grant insert, delete, update on public.field_closures to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  الحارس: إغلاقٌ يبتلع حجزًا مؤكّدًا يُرفَض
--
--  ⚠️ وهو **مُشغِّل لا فحصٌ في الواجهة** لسببين: ① الواجهة تفحص ما جلبَته
--     قبل ثوانٍ، وحجزٌ وصل بينهما يمرّ · ② السياسة تحكم الصفوف لا الزمن،
--     فلا تستطيع التعبير عن «هل يتعارض هذا الصفّ مع صفٍّ في جدول آخر؟».
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_closure_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hits int;
begin
  select count(*) into hits
    from public.bookings b
   where b.field_id = new.field_id
     and b.booking_date = new.closure_date
     and b.status = 'confirmed'
     and ( new.from_hour is null
           or (b.hour < new.to_hour and b.hour + 2 > new.from_hour) );

  if hits > 0 then
    -- رمز آلي + العدد. والقائمة بالأسماء تأتي من الدالّة أدناه، لا من نصّ
    -- الخطأ: نصٌّ يُحشَر فيه اسمٌ عربي وتاريخ يصعب تفكيكه في الواجهة بأمان.
    raise exception 'closure_conflict:%', hits using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists t_closure_guard on public.field_closures;
create trigger t_closure_guard before insert or update on public.field_closures
  for each row execute function public.fn_closure_guard();

-- ───────────────────────────────────────────────────────────────────────────
--  الواجهة المريحة: تُرجع التعارض **مفصّلًا** بدل رمز خطأ عارٍ
--
--  المُشغِّل أعلاه هو الحارس الحقيقي (يعمل حتى على REST مباشر)، وهذه الدالّة
--  للاستعمال اليومي: تفحص أوّلًا وتردّ قائمة الحجوزات المتعارضة **بالاسم
--  والوقت** كي تعرضها اللوحة، فيقرّر المالك ماذا يفعل بها.
--  وتردّ كذلك عدد الطلبات **المعلّقة** على ذلك اليوم — لا تمنعها، لأنها ليست
--  اتفاقًا منعقدًا بعد، لكنّ تركها معلّقةً على يومٍ مغلق تناقض يجب أن يُقال.
-- ───────────────────────────────────────────────────────────────────────────
-- تاريخ اليوم بتوقيت عمّان. مستقلّة عن الترحيل 15 عمدًا — هذا الملفّ لا يعتمد
-- عليه، و`current_date` هنا كانت ستقبل إغلاق يومٍ مضى بين منتصف الليل والفجر.
create or replace function public.amman_date() returns date
language sql stable as $$ select (now() at time zone 'Asia/Amman')::date $$;

create or replace function public.owner_close_field(
  p_field  uuid,
  p_date   date,
  p_from   smallint default null,
  p_to     smallint default null,
  p_reason text     default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ok       boolean;
  conflict jsonb;
  pend     int;
  new_id   uuid;
begin
  select public.is_admin() or exists (
    select 1 from public.fields f where f.id = p_field and public.owns_place(f.place_id)
  ) into ok;
  if not ok then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  if p_date < public.amman_date() then
    return jsonb_build_object('success', false, 'reason', 'past');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', b.customer_name, 'phone', b.customer_phone,
           'time', b.time_label, 'hour', b.hour) order by b.hour), '[]'::jsonb)
    into conflict
    from public.bookings b
   where b.field_id = p_field and b.booking_date = p_date and b.status = 'confirmed'
     and (p_from is null or (b.hour < p_to and b.hour + 2 > p_from));

  if jsonb_array_length(conflict) > 0 then
    return jsonb_build_object('success', false, 'reason', 'conflict', 'bookings', conflict);
  end if;

  select count(*) into pend
    from public.bookings b
   where b.field_id = p_field and b.booking_date = p_date and b.status = 'pending'
     and (p_from is null or (b.hour < p_to and b.hour + 2 > p_from));

  insert into public.field_closures(field_id, closure_date, from_hour, to_hour, reason, created_by)
  values (p_field, p_date, p_from, p_to, coalesce(p_reason,''), auth.uid())
  returning id into new_id;

  return jsonb_build_object('success', true, 'id', new_id, 'pending', pend);
end $$;

revoke all on function public.owner_close_field(uuid, date, smallint, smallint, text) from public, anon;
grant execute on function public.owner_close_field(uuid, date, smallint, smallint, text) to authenticated;

commit;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① القراءة عامّة فعلًا (بالمفتاح العام، بلا تسجيل دخول) — المتوقّع 200:
--      GET /rest/v1/field_closures?select=id,field_id,closure_date,from_hour,to_hour,reason
--
-- ② والكتابة ليست كذلك — المتوقّع 401/403 لا 201:
--      POST /rest/v1/field_closures  {"field_id":"…","closure_date":"2026-09-01"}
--
-- ③ الحارس يعمل على REST المباشر لا على الدالّة وحدها. بتوكن مالك، على يوم
--    فيه حجز مؤكّد — المتوقّع 400 مع "closure_conflict:<n>":
--      POST /rest/v1/field_closures  {"field_id":"…","closure_date":"<يوم فيه حجز>"}
--
-- ④ والدالّة تردّ التعارض مفصّلًا بدل الرمز العاري:
--      POST /rest/v1/rpc/owner_close_field {"p_field":"…","p_date":"<نفس اليوم>"}
--      المتوقّع {"success":false,"reason":"conflict","bookings":[{"name":…,"time":…}]}
--
-- ⑤ ويومٌ نظيف يمرّ:
--      المتوقّع {"success":true,"id":"…","pending":0}
--
-- ⑥ مالك مكانٍ آخر لا يُغلق ملعبًا ليس له — المتوقّع {"success":false,"reason":"forbidden"}
