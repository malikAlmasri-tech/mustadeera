-- ═══════════════════════════════════════════════════════════════════════════
--  دليل التعديل اليومي — المستديرة على Postgres
--  كل وصفة هنا تُلصق في: لوحة Supabase ← SQL Editor ← Run
--  وأغلبها له بديل بالفأرة في: Table Editor (يشبه جدول البيانات تمامًا)
--
--  ⚑ قاعدة عامة: كل تعديل هنا يُسجَّل تلقائيًّا في public.audit_log (قبل/بعد).
--    التعديل من لوحة Supabase يُسجَّل بـactor_id فارغ (لأنه بصلاحية النظام لا بحساب).
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 1) خدمات/مرافق مكان                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- بالفأرة: Table Editor ← places ← عدّل الخليّة مباشرةً (كما كنت تفعل في الشيت).
-- القيم كما هي في الشيت: 'Free' · 'Paid' · 'Available' · أو فارغ (لا تُعرض الخدمة).

update public.places set
  amenity_water     = 'Free',
  amenity_vests     = 'Available',
  amenity_ball      = 'Paid',
  amenity_bathrooms = 'Available',
  amenity_parking   = 'Free'
where name = 'ملعب الخطوة الأولى';

-- إخفاء خدمة واحدة فقط:
update public.places set amenity_ball = null where name = 'ملعب ميار';

-- استعراض المرافق الحالية لكل مكان:
select name, amenity_water, amenity_vests, amenity_ball, amenity_bathrooms, amenity_parking
from public.places order by name;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 2) صور الملاعب                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- الطريقة (أ) — رابط خارجي، كما هو الحال اليوم:
update public.fields set image_url = 'https://.../photo.jpg'
where legacy_id = '101';

-- الطريقة (ب) — ارفع الصورة إلى Supabase Storage (1GB مجانًا) بدل الاعتماد على روابط غيرك.
--   خطوة لمرّة واحدة: أنشئ الحاوية العامة
insert into storage.buckets (id, name, public) values ('fields', 'fields', true)
on conflict (id) do nothing;
--   ثمّ: لوحة Supabase ← Storage ← fields ← Upload ← انسخ الـURL العام ← ضعه في image_url أعلاه.

-- عرض الملاعب بلا صورة (لتعرف ما ينقص):
select f.legacy_id, p.name as place, f.name as field
from public.fields f join public.places p on p.id = f.place_id
where coalesce(f.image_url,'') = '' order by p.name;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 3) الحجوزات                                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- ★ المفضّل: **لا تحذف** — غيّر الحالة. الإلغاء يُفرِّغ الخانة فورًا (القيد الفريد
--   لا يشمل cancelled/rejected)، ويُبقي السجلّ للإحصاءات والمحاسبة.

-- ابحث أولًا عن الحجز المقصود:
select id, booking_date, hour, time_label, customer_name, customer_phone, status, price
from public.bookings_full
where booking_date = '2026-07-25'
order by hour;

-- إلغاء حجز واحد:
update public.bookings
set status = 'cancelled', cancel_reason = 'ألغي من الإدارة'
where id = '00000000-0000-0000-0000-000000000000';   -- ← ضع الـid من الاستعلام أعلاه

-- تأكيد حجز:
update public.bookings set status = 'confirmed' where id = '…';

-- الحذف النهائي (نادرًا — لحجز تجريبي مثلًا). محتواه الكامل يبقى محفوظًا في audit_log
-- تحت action='delete' فيمكن استرجاعه يدويًّا:
delete from public.bookings where id = '…';

-- حذف كل الحجوزات التجريبية القديمة دفعةً واحدة (احذر — راجع بـselect أولًا):
-- select * from public.bookings where customer_phone = '2222';
-- delete   from public.bookings where customer_phone = '2222';


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 4) كلمات السر                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- ⚠️ تغيّر جوهري: كلمات السر **لم تعد قابلة للقراءة من أحد، ولا منك**.
--    تُخزَّن مُجزَّأة (bcrypt) داخل auth.users. لا يمكنك «رؤية» كلمة سرّ —
--    يمكنك فقط **تعيين واحدة جديدة**. هذا هو الفرق بين قاعدة بيانات وجدول بيانات.

-- تعيين كلمة سرّ جديدة لمستخدم (بالرقم):
update auth.users
set encrypted_password = extensions.crypt('كلمة_السر_الجديدة', extensions.gen_salt('bf')),
    updated_at = now()
where email = '962795097771@mustadeera.app';   -- البريد = الرقم + @mustadeera.app

-- من هم المستخدمون ومن أي دور:
select p.phone, p.role, p.name, p.active, u.last_sign_in_at
from public.profiles p join auth.users u on u.id = p.id
order by p.role, p.phone;

-- ترقية/تنزيل دور:
update public.profiles set role = 'owner' where phone = '962…';

-- تعطيل حساب بلا حذفه:
update public.profiles set active = false where phone = '962…';

-- بديل بالفأرة: Authentication ← Users ← اختر المستخدم ← تعديل.
-- ملاحظة: «إعادة تعيين بالبريد» لن تعمل لأن البريد مشتقّ من الرقم ولا يستقبل شيئًا.


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 5) إضافة مكان / ملعب / صاحب ملعب جديد                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
insert into public.places (name, city, region, type, phone, active)
values ('ملعب جديد', 'عمان', 'طبربور', 'عشب صناعي', '962790000000', true);

insert into public.fields (place_id, name, size, price, slots, active)
select id, 'ملعب 1', '6×6', 45,
       '[{"h":8,"label":"8:00 - 10:00 ص"},{"h":10,"label":"10:00 ص - 12:00 م"},
         {"h":12,"label":"12:00 - 2:00 م"},{"h":14,"label":"2:00 - 4:00 م"},
         {"h":16,"label":"4:00 - 6:00 م"},{"h":18,"label":"6:00 - 8:00 م"},
         {"h":20,"label":"8:00 - 10:00 م"},{"h":22,"label":"10:00 - 12:00 م"}]'::jsonb,
       true
from public.places where name = 'ملعب جديد';

-- صاحب ملعب جديد (حساب + ربطه بمكانه):
do $$
declare uid uuid := gen_random_uuid();
  v_phone text := '962790000000';        -- ← رقمه
  v_pass  text := 'كلمة_سر_قوية';         -- ← 6 محارف فأكثر
  v_name  text := 'اسم المالك';
  v_place text := 'ملعب جديد';           -- ← اسم مكانه
begin
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
                          created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
  values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',
          v_phone||'@mustadeera.app', extensions.crypt(v_pass, extensions.gen_salt('bf')),
          now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('name',v_name,'phone',v_phone), false, false);
  insert into auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values (gen_random_uuid(), uid, uid::text,
          jsonb_build_object('sub',uid::text,'email',v_phone||'@mustadeera.app','email_verified',true),
          'email', now(), now(), now());
  insert into public.profiles (id,role,name,phone,active) values (uid,'owner',v_name,v_phone,true);
  insert into public.place_owners (place_id, profile_id)
  select id, uid from public.places where name = v_place;
end $$;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 6) «من غيّر ماذا ومتى» — سجلّ التدقيق                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
-- آخر 50 حركة في النظام:
select at, entity, action, coalesce(actor_role,'لوحة الإدارة') as who,
       coalesce(after->>'customer_name', after->>'name', entity_id) as what
from public.audit_log order by at desc limit 50;

-- ما الذي تغيّر في حجز معيّن (قبل/بعد):
select at, action, before->>'status' as من, after->>'status' as إلى
from public.audit_log where entity = 'bookings' and entity_id = '…' order by at;

-- استرجاع محتوى صفّ محذوف:
select before from public.audit_log where action = 'delete' order by at desc limit 5;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 7) لوحة الأرقام السريعة                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
select * from public.admin_daily  limit 30;   -- حجوزات وإيراد وعمولة لكل يوم
select * from public.admin_places;            -- ترتيب الأماكن بالإيراد والتقييم

-- أكثر الساعات إشغالًا:
select hour, count(*) as حجوزات from public.bookings
where status in ('pending','confirmed') group by hour order by حجوزات desc;


-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║ 8) كلمات السرّ — ما يمكن وما لا يمكن                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════╝
--
-- ⛔ **لا يمكن رؤية كلمة سرّ أي مستخدم. لا أنت ولا Supabase ولا أنا.**
--    المخزَّن ليس كلمة السرّ بل بصمة bcrypt ذات اتجاه واحد: تُشتقّ منها بسهولة،
--    ولا تُشتقّ هي منها. جرّب بنفسك وسترى نصًّا كهذا لا كلمة سرّ:
select email, left(encrypted_password, 20) || '…' as البصمة
from auth.users order by created_at desc limit 5;
--
-- وهذا ليس نقصًا بل هو المطلوب: لو استطاعت لوحة الأدمن عرض كلمات السرّ، لاستطاع
-- ذلك أيضًا كل من يخترق حساب الأدمن أو يسرّب نسخة من القاعدة. والمستخدمون
-- يعيدون استعمال كلمات سرّهم في أماكن أخرى، فالتسريب يتجاوز هذا التطبيق.
--
-- ✅ **ما يمكن فعله: إعادة التعيين.** تضع كلمة سرّ جديدة وتُبلغ صاحبها بها.
--    استبدل الرقم والكلمة الجديدة، ثم شغّل السطرين معًا:
update auth.users
   set encrypted_password = crypt('الكلمة-الجديدة-هنا', gen_salt('bf')),
       updated_at         = now()
 where email = '962790000000@mustadeera.app';   -- ← الرقم بصيغة 962…
--
-- تحقّق أن صفًّا واحدًا فقط تأثّر (UPDATE 1). إن كان 0 فالبريد غلط:
select id, email, updated_at from auth.users
 where email = '962790000000@mustadeera.app';
--
-- ⚠️ الجلسات المفتوحة على أجهزة أخرى تبقى صالحة حتى تنتهي. لإخراجها فورًا:
delete from auth.refresh_tokens where user_id =
  (select id from auth.users where email = '962790000000@mustadeera.app');
--
-- 📋 من يستطيع تغيير كلمة سرّه بنفسه: **كل مستخدم** من صفحة «حسابي» في التطبيق
--    (تبويب الحساب ← بطاقة «تغيير كلمة السر»)، ويُطلب منه كلمة السرّ الحالية.
