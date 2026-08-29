-- ═══════════════════════════════════════════════════════════════════════════
--  09 — تعديل موعد الحجز من التطبيق (اللاعب)
--
--  لماذا دالّة وليس توسيع سياسة RLS؟
--  ──────────────────────────────────
--  السياسة الحالية (01_schema.sql §7) تسمح للاعب بتحديث حجزه إلى حالة واحدة:
--      with check ( (player_id = auth.uid() and status = 'cancelled') or … )
--  فأي PATCH يُبقي `status='pending'` يُرَدّ — ولهذا لا يعمل تعديل الموعد اليوم.
--
--  التوسيع الساذج «أضِف pending إلى with check» يفتح **كل الأعمدة** أمام اللاعب،
--  لا التاريخ والساعة وحدهما: `price` و`field_id` و`place_id` و`customer_name`.
--  أي لاعب يستطيع حينها إرسال PATCH بسعر 0 على حجزه. السياسة تحكم الصفوف،
--  لا الأعمدة — فالحلّ الصحيح دالّة تُعدّل ما تُعدّله فقط.
--
--  ما تتحقّق منه الدالّة (كلّه في القاعدة، لا في المتصفّح):
--    ① الحجز موجود   ② صاحبه هو المتّصل   ③ حالته `pending` وحدها
--    ④ الموعد الجديد لم يمضِ (بتوقيت عمّان لا UTC)
--    ⑤ الساعة من أوقات هذا الملعب نفسه   ⑥ ليست نفس الخانة الحالية
--    ⑦ التزامن يحسمه القيد الفريد `bookings_no_double_idx` كما في الإنشاء
--
--  🔒 SECURITY DEFINER يتجاوز RLS عمدًا — وهذا مقبول لأن الدالّة تفحص الملكية
--     بنفسها في ②. و`set search_path = public` يمنع خطف الأسماء (نفس نمط
--     `is_admin()` و`owns_place()` في 01).
--  📝 مُدقَّق: `t_audit_bookings` هو AFTER UPDATE ⇒ يسجّل التعديل بـactor_id
--     الحقيقي (auth.uid() تُقرأ من الـJWT وتبقى صحيحة داخل الدالّة).
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.player_reschedule_booking(
  p_booking     uuid,
  p_date        date,
  p_hour        smallint,
  p_time_label  text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b        public.bookings;
  slot_ok  boolean;
  now_amm  timestamp := (now() at time zone 'Asia/Amman');
begin
  -- ① الحجز
  select * into b from public.bookings where id = p_booking;
  if not found then
    return jsonb_build_object('success', false, 'message', 'ما لقينا الحجز');
  end if;

  -- ② الملكية — الفحص الذي يجعل تجاوز RLS أعلاه آمنًا
  if b.player_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'message', 'هذا الحجز مش تبعك');
  end if;

  -- ③ المعلّق وحده. المؤكّد اتّفق عليه الطرفان ⇒ تغييره من طرف واحد يكسر الاتفاق،
  --    والملغى/المرفوض انتهى أمره.
  if b.status <> 'pending' then
    return jsonb_build_object('success', false,
      'message', 'ما بتقدر تعدّل إلا الحجز اللي لسا بانتظار التأكيد');
  end if;

  -- ④ الموعد الجديد في المستقبل — **بتوقيت عمّان**. القاعدة تعمل بـUTC، و`current_date`
  --    فيها يسبق يوم الأردن ثلاث ساعات ⇒ كان سيقبل موعدًا ماضيًا بين منتصف الليل و3 فجرًا.
  if p_date <  now_amm::date
     or (p_date = now_amm::date and p_hour <= extract(hour from now_amm)) then
    return jsonb_build_object('success', false, 'message', 'ما بنفع تنقل الحجز لوقت راح');
  end if;

  -- ⑤ الساعة من جدول أوقات هذا الملعب — لا ساعة مخترَعة يرسلها عميل معدَّل
  select exists (
    select 1 from public.fields f, jsonb_array_elements(f.slots) s
    where f.id = b.field_id and (s->>'h')::int = p_hour
  ) into slot_ok;
  if not slot_ok then
    return jsonb_build_object('success', false, 'message', 'هذا الوقت مش متاح لهذا الملعب');
  end if;

  -- ⑥ نفس الخانة ⇒ لا عملية
  if p_date = b.booking_date and p_hour = b.hour then
    return jsonb_build_object('success', false, 'message', 'هذا نفس موعد حجزك');
  end if;

  -- ⑦ التعديل: عمودان اثنان لا غير (+ التسمية النصّية التابعة للساعة).
  --    السعر والملعب والمكان والاسم والحالة لا تُمَسّ.
  update public.bookings
     set booking_date = p_date,
         hour         = p_hour,
         time_label   = coalesce(nullif(p_time_label, ''), time_label)
   where id = p_booking;

  return jsonb_build_object('success', true, 'message', 'تم تعديل موعد حجزك');

exception
  -- خرق `bookings_no_double_idx` ⇒ سبقنا إليها حجز آخر بين العرض والحفظ.
  -- التزامن يُحسم في القاعدة لا في منطق التطبيق — كما في الإنشاء تمامًا.
  when unique_violation then
    return jsonb_build_object('success', false, 'message', 'هذا الوقت راح، اختار وقت ثاني');
end $$;

-- الضيف (anon) لا شأن له بها: الدالّة تفحص auth.uid() فتردّ عليه «مش تبعك» على أي حال،
-- لكن منع التنفيذ أصلًا أنظف من الاعتماد على الفحص الداخلي وحده.
revoke all on function public.player_reschedule_booking(uuid, date, smallint, text) from public, anon;
grant execute on function public.player_reschedule_booking(uuid, date, smallint, text) to authenticated;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ① وجود الدالّة (قبل التشغيل يردّ PostgREST 404/PGRST202، والتطبيق يقول ذلك صراحةً):
--    select proname from pg_proc where proname = 'player_reschedule_booking';
--
-- ② بالمفتاح العام وحده (بلا تسجيل دخول) — المفروض 401/403 لا 200:
--    curl -X POST -H "apikey: <anon>" -H "Authorization: Bearer <anon>" \
--         -H "Content-Type: application/json" \
--         -d '{"p_booking":"<uuid>","p_date":"2026-08-01","p_hour":20}' \
--         "https://<ref>.supabase.co/rest/v1/rpc/player_reschedule_booking"
--
-- ③ بحجز لاعب آخر (بتوكن لاعب مسجَّل) — المفروض {"success":false,"message":"هذا الحجز مش تبعك"}
--
-- ④ بعد تعديل ناجح، المفروض أن يظهر الصفّ في سجلّ التدقيق بـbefore/after مختلفَي التاريخ:
--    select at, actor_id, before->>'hour', after->>'hour'
--      from public.audit_log where entity = 'bookings' order by at desc limit 5;
