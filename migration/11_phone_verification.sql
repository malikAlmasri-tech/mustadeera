-- ═══════════════════════════════════════════════════════════════════════════
--  11 — تأكيد رقم الهاتف بكود (اللاعب، عند أوّل تسجيل)
--
--  لماذا دالّتان وليس جدولًا يكتب فيه التطبيق؟
--  ──────────────────────────────────────────
--  الكود سرٌّ مشترك بين الخادم والهاتف. لو كتبه المتصفّح أو قرأه، لما أثبت شيئًا:
--  من يستطيع قراءة الصفّ يستطيع «التحقّق» من رقم ليس رقمه. فالتوليد والمقارنة
--  كلاهما داخل القاعدة، والجدولان أدناه **لا سياسة قراءة لهما إطلاقًا** ⇒ لا
--  `anon` ولا `authenticated` يرى منهما صفًّا واحدًا. الوصول عبر الدالّتين وحدهما.
--
--  ولماذا الكود **مُجزَّأ** (sha256 + ملح) لا نصًّا؟
--  نسخة القاعدة الاحتياطية تُنسخ وتُنقل. كودٌ صالح عشر دقائق في نسخة مسرَّبة
--  يكفي لاختطاف تأكيد. التجزئة تجعل النسخة عديمة النفع، والملح يمنع جدول
--  قوس قزح على مليون احتمال (وهو مليون فقط — ستّ خانات).
--
--  🔴 خانة الإرسال فارغة عمدًا
--  ──────────────────────────
--  لا توجد وسيلة **مجانية** موثوقة لإرسال SMS. فالدالّة لا تدّعي إرسالًا لا يقع:
--  ما دام `sms_provider` فارغًا في `app_settings` فهي تردّ
--      { success:true, sent:false, reason:'no_provider' }
--  ولا تكتب في الطابور ولا تولّد كودًا أصلًا (كودٌ لا يصل = سرٌّ مخزَّن بلا فائدة).
--  والتطبيق يقول ذلك للمستخدم صراحةً ولا يمنعه من الحجز. حين يشتري المالك
--  مزوّدًا: املأ المفتاح، فعّل الطابور (§6 في آخر الملفّ)، وينقلب السلوك وحده.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1) العَلَم على الحساب
--    القيمة الافتراضية `false` تصف الواقع: كل الحسابات القائمة (والمستورَدة)
--    غير مؤكَّدة، لأن أحدًا لم يؤكّدها فعلًا. وضعُها `true` بأثر رجعي كذبٌ
--    على مالك اللوحة قبل أن يكون كذبًا على اللاعب.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

comment on column public.profiles.phone_verified is
  'أثبت صاحب الحساب أنه يملك الرقم بإدخال كود وصله عليه. لا يُضبَط إلا من verify_phone_code().';

-- ───────────────────────────────────────────────────────────────────────────
-- 2) إعدادات لا تُنشر: مفتاح المزوّد
--    قيمته الفارغة هي الحالة اليوم، وهي التي تجعل request_phone_code تقول
--    «لا مزوّد» بدل أن تصمت أو تكذب.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;   -- بلا أي سياسة ⇒ محجوب عن الجميع

insert into public.app_settings (key, value) values
  ('sms_provider', ''),          -- '' | 'twilio' | 'whatsapp' | أيّ اسم يفهمه الطابور
  ('sms_sender',   '')           -- الرقم/المعرّف الذي تظهر الرسالة منه
on conflict (key) do nothing;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) الأكواد — صفٌّ واحد لكل مستخدم (الطلب الجديد يلغي القديم)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.phone_verification (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  code_hash    text        not null,
  salt         text        not null,
  expires_at   timestamptz not null,
  attempts     smallint    not null default 0,     -- محاولات إدخال خاطئة على هذا الكود
  last_sent_at timestamptz not null default now(),
  window_start timestamptz not null default now(), -- بداية نافذة الساعة لحدّ الإرسال
  sends        smallint    not null default 0      -- كم أُرسل داخل هذه النافذة
);
alter table public.phone_verification enable row level security;   -- بلا أي سياسة

-- ───────────────────────────────────────────────────────────────────────────
-- 4) طابور الرسائل — يملؤه الخادم، ويفرغه المزوّد (Edge Function بمفتاح service_role)
--    ⚠️ الجسم يحمل الكود نصًّا بالضرورة (الرسالة نفسها). لذلك: لا يُكتب صفّ
--    إلا حين يوجد مزوّد فعلًا، ويُنظَّف بعد عشر دقائق بـ purge_expired_codes().
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.sms_outbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  phone      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);
alter table public.sms_outbox enable row level security;           -- بلا أي سياسة
create index if not exists sms_outbox_pending_idx
  on public.sms_outbox (created_at) where sent_at is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) الدالّتان
-- ───────────────────────────────────────────────────────────────────────────

/* طلب كود.
   الحدّان مقصودان ومختلفان:
     • 60 ثانية بين رسالتين  — يمنع الضغط المتكرّر على «إعادة الإرسال»
     • 5 رسائل في الساعة     — يمنع استنزاف رصيد الرسائل من حسابٍ واحد
   وكلاهما **في القاعدة** لا في الواجهة: عدّاد الواجهة يُتجاوَز بإعادة التحميل.  */
create or replace function public.request_phone_code()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_phone    text;
  v_provider text;
  v_row      public.phone_verification;
  v_num      int;
  v_code     text;
  v_salt     text;
  v_wait     int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'سجّل دخولك أول');
  end if;

  select phone into v_phone from public.profiles where id = v_uid;
  if v_phone is null or v_phone = '' then
    return jsonb_build_object('success', false, 'message', 'ما في رقم هاتف على هذا الحساب');
  end if;

  -- مؤكَّد من قبل؟ لا نرسل شيئًا ولا نعدّه فشلًا.
  if exists (select 1 from public.profiles where id = v_uid and phone_verified) then
    return jsonb_build_object('success', true, 'sent', false, 'reason', 'already_verified');
  end if;

  select value into v_provider from public.app_settings where key = 'sms_provider';

  -- ★ لا مزوّد ⇒ لا كود ولا طابور. تُقال الحقيقة ويُترك القرار للتطبيق.
  if coalesce(v_provider, '') = '' then
    return jsonb_build_object('success', true, 'sent', false, 'reason', 'no_provider');
  end if;

  select * into v_row from public.phone_verification where user_id = v_uid;

  -- حدّ الستّين ثانية
  if found and v_row.last_sent_at > now() - interval '60 seconds' then
    v_wait := ceil(extract(epoch from (v_row.last_sent_at + interval '60 seconds' - now())));
    return jsonb_build_object('success', false, 'reason', 'too_soon',
                              'retry_after', v_wait,
                              'message', 'استنّى شوي قبل ما تطلب كود جديد');
  end if;

  -- حدّ الخمس رسائل في الساعة (النافذة تُصفَّر بعد ساعة من أوّل رسالة فيها)
  if found and v_row.window_start > now() - interval '1 hour' and v_row.sends >= 5 then
    v_wait := ceil(extract(epoch from (v_row.window_start + interval '1 hour' - now())));
    return jsonb_build_object('success', false, 'reason', 'rate_limited',
                              'retry_after', v_wait,
                              'message', 'طلبت أكواد كثيرة، جرّب بعد شوي');
  end if;

  -- كود من مصدر عشوائي تشفيري لا من random()
  v_num  := ((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::int) & 2147483647);
  v_code := lpad((v_num % 1000000)::text, 6, '0');
  v_salt := encode(gen_random_bytes(16), 'hex');

  insert into public.phone_verification
    (user_id, code_hash, salt, expires_at, attempts, last_sent_at, window_start, sends)
  values
    (v_uid, encode(digest(v_code || v_salt, 'sha256'), 'hex'), v_salt,
     now() + interval '10 minutes', 0, now(), now(), 1)
  on conflict (user_id) do update set
    code_hash    = excluded.code_hash,
    salt         = excluded.salt,
    expires_at   = excluded.expires_at,
    attempts     = 0,                                  -- كود جديد ⇒ محاولات جديدة
    last_sent_at = now(),
    -- النافذة تُستأنف إن كانت حيّة، وتبدأ من جديد إن انقضت الساعة
    window_start = case when public.phone_verification.window_start > now() - interval '1 hour'
                        then public.phone_verification.window_start else now() end,
    sends        = case when public.phone_verification.window_start > now() - interval '1 hour'
                        then public.phone_verification.sends + 1 else 1 end;

  insert into public.sms_outbox (user_id, phone, body)
  values (v_uid, v_phone,
          'كود التحقق في المستديرة: ' || v_code || E'\nصالح 10 دقائق. لا تعطِه لأحد.');

  return jsonb_build_object('success', true, 'sent', true,
                            'expires_in', 600, 'retry_after', 60);
end;
$$;

/* إدخال الكود.
   خمس محاولات على الكود الواحد ثمّ يُحرَق (يُحذف الصفّ) — وإلّا فمليون احتمال
   تُجرَّب آليًّا في دقائق. والفشل لا يقول «الكود غلط» فقط بل كم بقي، لأن
   المستخدم الصادق يخطئ في الرقم لا في الهوية.  */
create or replace function public.verify_phone_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.phone_verification;
  v_code text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'سجّل دخولك أول');
  end if;

  if exists (select 1 from public.profiles where id = v_uid and phone_verified) then
    return jsonb_build_object('success', true, 'message', 'رقمك مؤكَّد من قبل');
  end if;

  select * into v_row from public.phone_verification where user_id = v_uid;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'no_code',
                              'message', 'ما في كود مطلوب، اطلب كود أول');
  end if;

  if v_row.expires_at < now() then
    delete from public.phone_verification where user_id = v_uid;
    return jsonb_build_object('success', false, 'reason', 'expired',
                              'message', 'انتهت صلاحية الكود، اطلب كود جديد');
  end if;

  if v_row.attempts >= 5 then
    delete from public.phone_verification where user_id = v_uid;
    return jsonb_build_object('success', false, 'reason', 'too_many',
                              'message', 'حاولت كثير، اطلب كود جديد');
  end if;

  if encode(digest(v_code || v_row.salt, 'sha256'), 'hex') <> v_row.code_hash then
    update public.phone_verification set attempts = attempts + 1 where user_id = v_uid;
    return jsonb_build_object('success', false, 'reason', 'wrong',
                              'left', 4 - v_row.attempts,
                              'message', 'الكود غلط');
  end if;

  update public.profiles set phone_verified = true where id = v_uid;
  delete from public.phone_verification where user_id = v_uid;
  return jsonb_build_object('success', true, 'message', 'تم تأكيد رقمك');
end;
$$;

/* تنظيف: أكواد منتهية، ورسائل غادرت الطابور أو شاخت فيه.
   تُنادى يدويًّا أو من pg_cron إن فُعِّل. لا تعتمد عليها الدالّتان أعلاه —
   كلتاهما تفحص `expires_at` بنفسها، فالتنظيف للنظافة لا للصحّة. */
create or replace function public.purge_expired_codes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.phone_verification where expires_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  delete from public.sms_outbox
    where created_at < now() - interval '1 hour'
      and (sent_at is not null or created_at < now() - interval '1 day');
  return n;
end;
$$;

-- الدالّتان للمستخدم المسجَّل وحده. `anon` لا يملك حسابًا فلا معنى لندائه لهما.
revoke all on function public.request_phone_code()          from public, anon;
revoke all on function public.verify_phone_code(text)       from public, anon;
revoke all on function public.purge_expired_codes()         from public, anon, authenticated;
grant execute on function public.request_phone_code()    to authenticated;
grant execute on function public.verify_phone_code(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  6) 🔴 تفريغ الطابور — الخطوة الوحيدة الباقية على المالك
--
--  ① اشترِ مزوّدًا (Twilio أو WhatsApp Cloud API أو مزوّدًا أردنيًّا) وخذ مفاتيحه.
--  ② انشر Edge Function باسم `send-sms` تقرأ الطابور بمفتاح `service_role`:
--         select * from sms_outbox where sent_at is null order by created_at limit 20
--     ترسل كلّ صفّ، ثمّ تكتب `sent_at = now()` أو `error = '…'`.
--     ⚠️ لا تضع مفاتيح المزوّد في `app_settings` — مكانها أسرار المشروع
--        (Project Settings ← Edge Functions ← Secrets). الجدول للإعدادات
--        غير السرّية وحدها، وقيمة `sms_provider` مجرّد اسم.
--  ③ نادِها كل دقيقة بـpg_cron، أو فوريًّا بمُشغِّل pg_net (اشطب التعليق):
--
--     create extension if not exists pg_net with schema extensions;
--     create or replace function public.tg_sms_outbox_push()
--     returns trigger language plpgsql security definer set search_path = public, extensions as $t$
--     begin
--       perform net.http_post(
--         url     := 'https://nxqddfuwtrsabprxcfez.supabase.co/functions/v1/send-sms',
--         headers := jsonb_build_object('Content-Type','application/json',
--                                       'Authorization','Bearer ' || current_setting('app.fn_key', true)),
--         body    := jsonb_build_object('id', new.id));
--       return new;
--     end; $t$;
--     create trigger t_sms_outbox_push after insert on public.sms_outbox
--       for each row execute function public.tg_sms_outbox_push();
--
--  ④ أخيرًا شغّل المفتاح — وهذا وحده ما يقلب سلوك التطبيق:
--         update public.app_settings set value = 'twilio', updated_at = now()
--          where key = 'sms_provider';
--
--  حتى تكتمل الأربعة، التطبيق يعمل ويقول للمستخدم إن التأكيد غير مفعَّل بعد،
--  ولا يمنعه من الحجز. لا شاشة معطّلة ولا وعد كاذب.
-- ═══════════════════════════════════════════════════════════════════════════
