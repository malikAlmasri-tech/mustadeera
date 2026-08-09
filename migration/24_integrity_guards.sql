-- ═══════════════════════════════════════════════════════════════════════════
--  24 — حرّاس السلامة: ما تعجز عنه السياسة، يفعله المُشغِّل
--
--  🔴 لماذا هذا الملفّ أوّل ما يُشغَّل من المعلَّق
--  ─────────────────────────────────────────────
--  القاعدة المكتوبة في `CLAUDE.md` منذ الترحيل 09 — **«سياسة RLS تحكم الصفوف
--  لا الأعمدة»** — مطبَّقة على `bookings.payment_*` (‏12) و`notifications` (‏14)
--  و`bookings.no_show` (‏16) و`bookings.price` (‏18)، **ومفقودة على الأعمدة
--  الثلاثة التي تفصل المنصّة عن تصعيد صلاحيات كامل**:
--
--    ① `profiles.role`   — `profiles_self_update` تسمح لصاحب الصفّ بالتحديث
--                          بلا قيد عمود ⇒ `PATCH {"role":"admin"}` على صفّي.
--                          وبعدها `is_admin()` تصير `true`، فتنفتح كلّ
--                          الحجوزات بأرقام هواتفها، وسجلّ التدقيق، والكتابة
--                          على `places`/`fields`، **ويُتجاوَز كل حارسٍ كُتب
--                          قبل هذا الملفّ** — لأنّ كلًّا منها يبدأ بـ
--                          `if public.is_admin() then return new`.
--    ② `profiles.active` — الرايةُ نفسها هي كلّ ما يفعله «إيقاف الحساب» في
--                          `/admin` و«حذف الحساب» في التطبيق ⇒ الموقوف يكتب
--                          `{"active":true}` فيعود. وهو ما يجعل فحص `inactive`
--                          في `join_open_game` (‏22) بلا معنى عملي.
--    ③ `bookings.status` — `bookings_insert_player` تفحص `player_id` ولا تفحص
--                          الحالة ⇒ `POST {"status":"confirmed"}` يمرّ. والأثر
--                          يتجاوز «حجزٌ بلا موافقة»: القيد ① في تصميم المباريات
--                          المفتوحة (‏22) مبنيٌّ على `status='confirmed'` داخل
--                          العرض — صحيحٌ في موضعه، لكنّ الشرط الذي يستند إليه
--                          كان بيد العميل.
--
--  ومعها ثلاث فحوصات **كانت موجودة في `backend/Code.gs`** وسقطت في الترحيل إلى
--  Postgres بلا بديل: التاريخ الماضي · الملعب التابع لمكان آخر · ساعة خارج
--  `slots`. رسائلها الثلاث ما زالت في `API_MESSAGE_MAP` بالتطبيق تنتظر ردًّا
--  لا يأتي. وحارسٌ رابع لم يوجد قطّ: **الحجز على خانة مغلقة** (‏17 يحرس اتّجاهًا
--  واحدًا فقط: إغلاقٌ يبتلع حجزًا. والعكس — حجزٌ يقع على يوم مغلق — مفتوح،
--  وليس نظريًّا: المالك يُغلق السادسة، ولاعبٌ يضغط «احجز» في الثانية التالية).
--
--  🔒 المبدأ الواحد الذي يحكم الملفّ كلّه
--  ─────────────────────────────────────
--  **لا يُوسَّع أيّ `with check`.** تعبيرٌ في سياسة يردّ الخرقَ «صفًّا فارغًا
--  مع 200» — العملية «نجحت» ولم يحدث شيء، فلا يملك العميل رمزًا يقرؤه ولا
--  سببًا يقوله. كلّ حارسٍ هنا **مُشغِّل يرفع خطأً له اسم** تترجمه الواجهة إلى
--  جملة صادقة، أو **يُسنِد القيمةَ القديمة صامتًا** حين لا يكون للمستخدم قرارٌ
--  أصلًا (لم يطلب تغيير العمود؛ العميل المعدَّل وحده يفعل).
--
--  مستقلّ عن الترتيب: يعيد تعريف دوالّ التوقيت بنفس أجسامها في 15 و17، فلا
--  يضرّ تشغيله قبلها ولا بعدها. وقسم الإغلاق يُفحَص وجودُه لا يُفترَض.
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
--  0) دوالّ التوقيت — نسخة مطابقة لما في 15 و17
--
--  ⚠️ `current_date` في القاعدة **بتوقيت UTC**، ويسبق يوم الأردن ثلاث ساعات
--     ⇒ يقبل موعدًا ماضيًا بين منتصف الليل والثالثة فجرًا. وهو بالضبط الوقت
--     الذي تُحجَز فيه مباريات الليلة التالية.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.amman_date() returns date
language sql stable as $$ select (now() at time zone 'Asia/Amman')::date $$;

create or replace function public.amman_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Asia/Amman')::timestamp $$;

-- ───────────────────────────────────────────────────────────────────────────
--  1) `profiles` — الدور والراية خارج يد صاحبهما
--
--  🔓 ولماذا يُسمح بـ`active: true ⇒ false` ولا يُسمح بالعكس؟
--     لأن **«حذف الحساب» في التطبيق هو هذا السطر حرفيًّا** (‏`app.js`:
--     `PATCH /profiles {active:false}`). تجميدُ العمود كان سيكسر المسار الوحيد
--     الذي يملك المستخدم فيه أن يُغلق حسابه بنفسه. والاتّجاه الآخر — أن يعيد
--     الموقوفُ تفعيلَ نفسه — هو الخرق. **فالقيد اتّجاهيّ لا مطلق.**
--
--  📛 و`phone` مجمَّدة كذلك: هويّة الدخول مشتقّة منها (بريد داخلي)، فتغييرها
--     من هنا يفصل الصفَّ عن `auth.users` ⇒ حسابٌ لا يستطيع صاحبه الدخول إليه
--     ولا نحن إصلاحه إلّا بمحرّر SQL. ولا يوجد في التطبيق مسارٌ يغيّرها أصلًا
--     (المسارات الثلاثة: `{name}` · `{active:false}` · `phone_verified` من
--     دالّة الترحيل 11 — ولا واحد منها يمسّ العمود).
--
--  🧭 والتجاوز بـ`auth.uid() is null` مقصود وآمن: يعني «لا سياق مستخدم» —
--     أي محرّر SQL أو `service_role` أو ترحيلات الاستيراد (‏02/03). ولا يفتح
--     بابًا للمفتاح العام: بلا `uid` لا تمرّ `profiles_insert_self`
--     (‏`id = auth.uid()`) ولا `profiles_self_update` أصلًا.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- التسجيل ينشئ لاعبًا. رفعُ الدور فعلٌ إداري له مساره في `/admin`.
    new.role   := 'player';
    new.active := true;
    return new;
  end if;

  new.role      := old.role;
  new.phone     := old.phone;
  new.legacy_id := old.legacy_id;
  -- إغلاق الحساب مسموح، وإعادة فتحه ليست.
  if not old.active then
    new.active := false;
  end if;
  return new;
end $$;

drop trigger if exists t_profiles_guard on public.profiles;
create trigger t_profiles_guard before insert or update on public.profiles
  for each row execute function public.fn_profiles_guard();

-- ───────────────────────────────────────────────────────────────────────────
--  2) `bookings` عند الإدراج — الحالة، والاتّساق المرجعي، والزمن، والإغلاق
--
--  🔓 والمالك والأدمن مستثنيان من الزمن والخانة والإغلاق **لا من الاتّساق**:
--     • الحجز اليدوي قد يُسجَّل بأثر رجعي (دفترٌ قديم يُدخَل)، وقد يقع على
--       نصف ساعة متّفَق عليها خارج `slots`، وقد يقع على يومٍ أغلقه المالك
--       لنفسه — كلّها قرارات صاحب المكان في مكانه، تمامًا كما استُثني من
--       سلطة السعر (‏18) ومن مهلة الإلغاء (‏15).
--     • أمّا **ملعبٌ من مكانٍ آخر فليس قرارًا، بل صفٌّ يكذب**: كل تقرير يجمع
--       بـ`place_id` وكل عرضٍ يقرأ باسم الملعب سيتناقضان إلى الأبد. فالفحص
--       المرجعي يسري على الجميع بلا استثناء.
--
--  ⏳ وحدّ الزمن هنا **يومٌ لا ساعة**، وهو ما كان في `Code.gs` حرفيًّا. والقاعدة
--     الأدقّ («خانةٌ بدأت لا تُحجَز») مكتوبة معطَّلة في ذيل الملفّ: الواجهة لا
--     تُخفي اليوم ساعاتِ اليوم التي مضت، وتفعيلُها هنا قبلها يجعل الخادم يرفض
--     زرًّا يعرضه التطبيق — أسوأ من الثغرة نفسها.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fn_booking_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f          public.fields;
  privileged boolean;
  n_slots    int;
  matched    text;
  closed     int;
begin
  privileged := public.is_admin() or public.owns_place(new.place_id);

  -- ① الحالة: طلبٌ ينتظر ردًّا. من يستطيع الردّ هو المالك، ومن أدخله بيده
  --    مؤكَّدٌ أصلًا (اتّفاقٌ وقع خارج التطبيق).
  if not privileged then
    new.status := 'pending';
  end if;

  -- ② الملعب تابعٌ للمكان فعلًا — على الجميع، بلا استثناء (انظر أعلاه).
  select * into f from public.fields where id = new.field_id;
  if not found then
    raise exception 'field_missing' using errcode = 'P0001';
  end if;
  if f.place_id is distinct from new.place_id then
    raise exception 'field_not_in_place' using errcode = 'P0001';
  end if;

  if privileged then
    return new;
  end if;

  -- ③ التاريخ ليس ماضيًا — **بتوقيت عمّان** لا UTC.
  if new.booking_date < public.amman_date() then
    raise exception 'booking_date_past' using errcode = 'P0001';
  end if;

  -- ④ الساعة ضمن أوقات هذا الملعب. وملعبٌ بلا أوقات لا يُفحَص (نفس شرط
  --    `Code.gs`: `if (slotList.length && !matchedSlot)`) — الأوقات الفارغة
  --    تعني «غير مُعرَّفة» لا «ممنوعة».
  select count(*),
         max(e->>'label') filter (where (e->>'h')::int = new.hour)
    into n_slots, matched
    from jsonb_array_elements(coalesce(f.slots, '[]'::jsonb)) e;

  if n_slots > 0 then
    if matched is null then
      raise exception 'hour_not_in_slots' using errcode = 'P0001';
    end if;
    -- التسمية من الخادم لا من العميل: `time_label` تُعرَض في «حجوزاتي» وفي
    -- الإشعار وفي رسالة الواتساب، وقيمةٌ يرسلها العميل تجعل ثلاثتها تقول ما
    -- لم يُحجَز. (‏`Code.gs` كان يشتقّها كذلك: `matchedSlot.label`.)
    new.time_label := matched;
  end if;

  -- ⑤ خانة مغلقة لا تُباع. والفحص هنا لأن المُشغِّل في 17 يحرس الاتّجاه
  --    المعاكس وحده، ولأن الواجهة تفحص ما جلبَته قبل ثوانٍ: إغلاقٌ وقع بينهما
  --    يمرّ. **والتداخل لا الاحتواء** — نفس الشرط حرفيًّا كما في
  --    `fn_closure_guard` و`slotClosure` بالتطبيق: خانة تبدأ 18 تتعارض مع
  --    إغلاق [19,22) ولو بدأت قبله.
  if to_regclass('public.field_closures') is not null then
    execute
      'select count(*) from public.field_closures c
        where c.field_id = $1 and c.closure_date = $2
          and (c.from_hour is null or ($3 < c.to_hour and $3 + 2 > c.from_hour))'
      into closed using new.field_id, new.booking_date, new.hour;
    if closed > 0 then
      raise exception 'slot_closed' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists t_booking_insert_guard on public.bookings;
create trigger t_booking_insert_guard before insert on public.bookings
  for each row execute function public.fn_booking_insert_guard();

-- ───────────────────────────────────────────────────────────────────────────
--  3) `bookings` عند إلغاء اللاعب — العمودان المسموحان، وما عداهما يُجمَّد
--
--  🎯 لماذا يكفي حراسة **انتقال الإلغاء** وحده لتغطية سطح اللاعب كلّه؟
--     لأن `bookings_update` تُلزم كلّ تحديثٍ يقوم به اللاعب بأن **ينتهي**
--     عند `status = 'cancelled'` (‏`with check`). فما من طريق REST يملكه
--     اللاعب لا يمرّ من هنا. والمسارات المشروعة الأخرى (نقل الموعد في 09،
--     المباراة المفتوحة في 22، الانضمام والانسحاب) دوالُّ `security definer`
--     لا تُغيّر الحالة إلى `cancelled` ⇒ لا يمسّها هذا المُشغِّل أصلًا.
--     وكذلك كنسةُ الانقضاء (‏15) تكتب `rejected` لا `cancelled`.
--
--  🔴 وأخطر ما كان يمرّ: `cancel_kind = 'expired'`.
--     القيد يقبل القيمة، ولا سياسة تحرسها ⇒ اللاعب يُلغي حجزه ويصمه
--     «طلبٌ لم يردّ عليه المالك». وهو **بالضبط** التمييز الذي بُني الترحيل 15
--     لأجله: «الأولى قرار، والثانية إهمالٌ يُقاس». و`/admin` تُخدَع فعلًا —
--     `summarize()` تفحص `cancel_kind` داخل فرعٍ يجمع `cancelled` و`rejected`
--     ⇒ يُحتسَب انقضاءً في «أين يتسرّب المال؟». (التطبيق محصَّن:
--     `isExpiredBooking` يشترط `rejected` معها.)
-- ───────────────────────────────────────────────────────────────────────────
--  🧩 والقائمة **بيضاء لا سوداء**، ومبنيّةٌ من الصفّ نفسه لا مكتوبةً عمودًا
--     عمودًا: كل عمود يعود قديمًا، ثمّ يُستثنى المسموحان. عدُّها بيدٍ كان
--     سيصير قائمةً تنسى أوّلَ عمودٍ يضيفه ترحيلٌ قادم — وهو نفس الدرس الذي
--     جعل `applySportScope` تقصّ البيانات بدل أن تفحص كلُّ دالّةِ عرضٍ
--     `State.sport` بنفسها. ولذلك يعمل هذا القسم على قاعدةٍ شُغِّل عليها 16
--     و22 وعلى قاعدةٍ لم يُشغَّلا عليها، بلا فرعٍ واحد.
create or replace function public.fn_booking_cancel_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or public.owns_place(new.place_id) then
    return new;
  end if;
  if new.player_id is distinct from auth.uid() then
    return new;
  end if;

  -- ‏`null::public.bookings` لا `old` كوسيطٍ أوّل: الوسيط الأوّل لتحديد النوع
  -- وحده، و`old` في مُشغِّل هو `record` قد لا يُحسَم نوعه في كل سياق.
  new := jsonb_populate_record(
           null::public.bookings,
           to_jsonb(old) || jsonb_build_object(
             'status',        new.status,        -- فرضتها السياسة: 'cancelled'
             'cancel_reason', new.cancel_reason  -- السبب المكتوب بيد
           ));
  return new;
end $$;

-- ⚠️ والترتيب مقصود لا مصادفة. مُشغِّلات `before` تُطلَق **بترتيب أسمائها**،
--    و`t_booking_cancel_fields` تسبق `t_booking_cancel_window` (‏f قبل w)
--    ⇒ الموعد يعود إلى قيمته الحقيقية **قبل** أن تُحسَب عليه مهلة الإلغاء.
--    بالترتيب المعاكس كان عميلٌ معدَّل يزحزح النافذة بإرسال `booking_date`
--    بعيدٍ في نفس طلب الإلغاء: يُحسَب الحقّ على موعدٍ مخترَع، ثمّ يُهمَل.
drop trigger if exists t_booking_cancel_fields on public.bookings;
create trigger t_booking_cancel_fields before update on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.fn_booking_cancel_fields();

commit;

-- ═══════════════════════════════════════════════════════════════════════════
--  تحقّق بعد التشغيل — كلّه بالمفتاح العام وتوكن لاعب عادي
--
--  ⚙️ والأسرع تشغيلُه دفعةً واحدة:  node tools/security-matrix.mjs
--     (يُنفّذ الصفوف العشرة أدناه ويقول أيّها مرّ وأيّها رُدّ.)
--
--  ① الدور لا يُرفَع — المتوقّع صفّ يعود بـ`role: "player"` لا "admin":
--      PATCH /rest/v1/profiles?id=eq.<uuid>   {"role":"admin"}
--      (‏Prefer: return=representation)
--
--  ② الموقوف لا يعيد تفعيل نفسه — المتوقّع `active: false`:
--      PATCH /rest/v1/profiles?id=eq.<uuid>   {"active":true}
--    ولا يُكسَر «حذف الحساب»: `{"active":false}` يمرّ ويعود `false`.
--
--  ③ اللاعب لا يؤكّد حجزه — المتوقّع `status: "pending"`:
--      POST /rest/v1/bookings   {..., "status":"confirmed"}
--
--  ④ تاريخ أمس يُردّ بـ400 و`booking_date_past`:
--      POST /rest/v1/bookings   {"booking_date":"<أمس>", …}
--
--  ⑤ ملعب من مكان آخر يُردّ بـ`field_not_in_place` — **حتى بتوكن مالك**:
--      POST /rest/v1/bookings   {"place_id":"<أ>","field_id":"<ملعب من ب>", …}
--
--  ⑥ ساعة خارج `slots` تُردّ بـ`hour_not_in_slots`:
--      POST /rest/v1/bookings   {"hour":3, …}
--
--  ⑦ خانة مغلقة تُردّ بـ`slot_closed` (بعد إغلاق ذلك اليوم من لوحة المالك):
--      POST /rest/v1/bookings   {"booking_date":"<اليوم المغلق>", …}
--
--  ⑧ «انقضت المهلة» لا تُزوَّر — المتوقّع `cancel_kind: ""`:
--      PATCH /rest/v1/bookings?id=eq.<حجزي>  {"status":"cancelled","cancel_kind":"expired"}
--
--  ⑨ ولا يُلوَّث صفٌّ في طريقه إلى الإلغاء — المتوقّع السعر القديم:
--      PATCH …  {"status":"cancelled","price":0,"customer_name":"x"}
--
--  ⑩ وما لم ينكسر: الحجز العادي يمرّ، والإلغاء داخل المهلة يمرّ، وحجز المالك
--     اليدوي يمرّ مؤكَّدًا بسعره المتّفَق عليه.
--
--  ⛔ القاعدة الأدقّ للزمن، معطَّلة عمدًا حتى تُخفي الواجهةُ ساعاتِ اليوم التي
--     مضت (وإلّا رفض الخادمُ زرًّا يعرضه التطبيق — أسوأ من الثغرة):
--       if public.slot_start_amman(new.booking_date, new.hour) <= public.amman_now() then
--         raise exception 'slot_started' using errcode = 'P0001';
--       end if;
-- ═══════════════════════════════════════════════════════════════════════════
