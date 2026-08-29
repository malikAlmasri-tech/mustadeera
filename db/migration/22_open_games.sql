-- ═══════════════════════════════════════════════════════════════════════════
--  22 — المباريات المفتوحة: مقاعد في حجزٍ قائم
--
--  ما هي؟
--  ──────
--  عند الحجز يختار اللاعب: **خاصّة** (الافتراضي — لا شيء يتغيّر عن اليوم) أو
--  **مفتوحة**، فيقول كم لاعبًا تحتاج المباراة وكم أحضر معه، والفرق يُنشر
--  مقاعدَ يأخذها لاعبون آخرون من التطبيق.
--
--  ══ ثلاثة قيود تحكم كلّ سطر في هذا الملفّ ══
--
--  ① **لا مقعد يُنشَر قبل أن يؤكّد الملعب.**
--     الحجز **طلبٌ** لا حجز. ونشرُ مقاعد في مباراة قد تُرفَض بيعُ مكانٍ في شيء
--     لا وجود له — أوضح خرقٍ ممكن لقاعدة الصدق، وأسوأ انطباعٍ أوّل لمن انضمّ.
--     ولذلك شرط العرض في `open_games` **`status = 'confirmed'`**، لا مجرّد
--     `visibility = 'open'`. والمضيف يختار «مفتوحة» وقت الحجز، وتُنشر مقاعده
--     لحظةَ التأكيد. وإن رُفض الطلب أو انقضت مهلته (ترحيل 15) فلم يُعرَض مقعدٌ
--     قطّ ولا أحد ليخيب ظنّه.
--
--  ② **لا مال يمرّ من هنا إطلاقًا.**
--     لا بوّابة دفع في المنتج أصلًا. أقصى ما يُعرَض **حصّةٌ تقديرية** = سعر
--     الخانة ÷ عدد اللاعبين، موسومةً بأنها معلومة، والتسوية بين اللاعبين
--     أنفسهم. ولا عمود «دفع» ولا رصيد ولا دَين — تحصيلُ مالٍ لا نستطيع
--     تحويله يجعلنا وسيطًا ماليًّا بلا أدوات وسيط مالي.
--     ⚠️ ولذلك `bookings.price` يبقى **لقطة**، والحصّة تُحسب منها في الواجهة
--        لا تُخزَّن: قاعدة تسعير تتغيّر غدًا لا يجوز أن تغيّر ما نُشر.
--
--  ③ **لا رقم هاتف يعبر هذا الباب.**
--     المنضمّ يرى **الاسم الأوّل** للمضيف، والمضيف يرى الأسماء الأولى للمنضمّين.
--     ولا شيء غير ذلك. `open_games` عرضٌ لا يحمل `customer_phone` ولا
--     `player_id`، وقائمةُ المنضمّين لا يراها إلّا المضيف ومن انضمّ.
--     ولا محادثة داخل التطبيق في هذه المرحلة — التنسيق عند الملعب.
--
--  🔁 والمقاعد **مشتقّة لا مخزَّنة**: `المطلوب − المُحضَر − عدد المنضمّين`.
--     عدّادٌ مخزَّن وجدولُ انضمامٍ يختلفان خلال أسبوع، ولا أحد يعرف أيّهما الصحيح.
--
--  ⚛️ والتزامن يُحسم بقفل الصفّ: لاعبان يضغطان آخر مقعد في الثانية نفسها هو
--     **الحالة العادية** عند التاسعة مساءً لا حالةٌ نادرة. `for update` على صفّ
--     الحجز يسلسل الاثنين، والقيد الفريد يمنع الانضمام مرّتين.
--
--  🔗 يعتمد على 14 (الإشعارات) اعتمادًا اختياريًّا محروسًا: بدونه تعمل المباريات
--     ولا يصل إشعار. ويُستحسن 15 (الانقضاء) كي لا تبقى مباراةٌ معلّقةٌ أبدًا.
--
--  التشغيل: Supabase ← SQL Editor ← الصق ← Run.  آمن لإعادة التشغيل.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────────────────
--  1) حقائق المباراة على الحجز نفسه
--     الافتراضي `private` ⇒ كل صفّ قائم، وكل صفّ يكتبه عميلٌ لا يعرف هذه
--     الميزة، مباراةٌ خاصّة — أي سلوك اليوم بالحرف.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists visibility       text     not null default 'private',
  add column if not exists players_needed   smallint,
  add column if not exists players_brought  smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_visibility_chk') then
    alter table public.bookings add constraint bookings_visibility_chk
      check (visibility in ('private','open'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_open_counts_chk') then
    -- المفتوحة تلزمها الأعداد، والخاصّة لا تحملها أصلًا: عمودان مملوءان على
    -- مباراة خاصّة بيانات لا معنى لها تُربك كل تقرير يقرؤها.
    alter table public.bookings add constraint bookings_open_counts_chk
      check (
        (visibility = 'private' and players_needed is null and players_brought is null)
        or (visibility = 'open'
            and players_needed between 2 and 40
            and players_brought between 1 and players_needed)
      );
  end if;
end $$;

create index if not exists bookings_open_idx
  on public.bookings(booking_date, hour)
  where visibility = 'open' and status = 'confirmed';

create table if not exists public.booking_players (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now()
);
-- الانضمام مرّتين مستحيلٌ في القاعدة لا في الواجهة.
create unique index if not exists booking_players_uniq
  on public.booking_players(booking_id, profile_id);
create index if not exists booking_players_who_idx on public.booking_players(profile_id);

-- ───────────────────────────────────────────────────────────────────────────
--  2) RLS
-- ───────────────────────────────────────────────────────────────────────────
alter table public.booking_players enable row level security;

drop policy if exists bp_read  on public.booking_players;
drop policy if exists bp_admin on public.booking_players;

-- صفوفي وحدها من الجدول الخام. قائمةُ رفاق المباراة تأتي من العرض أدناه
-- (أسماءَ أولى فقط) لا من هنا — الجدول الخام يحمل `profile_id` وهو مُعرّف شخص.
create policy bp_read on public.booking_players for select
  using (profile_id = auth.uid());
create policy bp_admin on public.booking_players for all
  using (public.is_admin()) with check (public.is_admin());
-- ولا سياسة `insert` ولا `delete` لأحد: الانضمام والانسحاب يمرّان بالدالّتين
-- أدناه وحدهما، وفيهما فحص المقاعد والحالة والزمن. إدراجٌ مباشر كان سيتخطّاها.

grant select on public.booking_players to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  3) العرض العامّ للمباريات — **الشكل الذي يراه الغريب**
--
--  ⚠️ عرضٌ عادي (‏security definer ضمنًا) عمدًا، كـ`booked_slots` في 01: هو
--     الطريقة الوحيدة لإظهار حجزٍ ليس لك بلا فتح `bookings` نفسها. ولذلك
--     **كل عمود هنا مقصود**، وما ليس مكتوبًا لا يخرج: لا `customer_phone`،
--     ولا `player_id`، ولا الاسم الكامل.
-- ───────────────────────────────────────────────────────────────────────────
create or replace view public.open_games as
  select b.id,
         b.place_id, b.field_id, b.booking_date, b.hour, b.time_label,
         b.price,
         -- الاسم الأوّل وحده. `split_part` على أوّل مسافة، والفارغ يبقى فارغًا.
         nullif(split_part(btrim(coalesce(b.customer_name,'')), ' ', 1), '') as host_name,
         b.players_needed,
         b.players_brought,
         greatest(b.players_needed - b.players_brought - coalesce(j.n, 0), 0) as seats_left,
         p.name as place_name, p.city, p.region,
         f.name as field_name, f.sport, f.size
    from public.bookings b
    join public.places p on p.id = b.place_id
    join public.fields f on f.id = b.field_id
    left join lateral (select count(*) as n from public.booking_players bp where bp.booking_id = b.id) j on true
   where b.visibility = 'open'
     and b.status = 'confirmed'                       -- ① لا مقعد قبل التأكيد
     -- 🔴 ومكانٌ أخفاه الأدمن لا تبقى مبارياته معروضة. العرض `security definer`
     --    ضمنًا (انظر أعلاه) ⇒ **لا يمرّ بـ`places_read`** التي تحجب غير النشط،
     --    فبلا هذين السطرين كان «إخفاء من التطبيق» يخفي المكان من الدليل ويترك
     --    مقاعده تُباع. والإخفاء يقع لسببٍ: نزاع · إغلاق · بيانات خاطئة —
     --    وأسوأ ما ينتج عنه لاعبٌ ينضمّ إلى ملعبٍ سُحب من المنصّة عمدًا.
     and p.active and f.active
     and (b.booking_date::timestamp + make_interval(hours => b.hour))
         > (now() at time zone 'Asia/Amman')::timestamp;

-- `authenticated` لا `anon`: الانضمام يتطلّب حسابًا، فلا سبب يجعل الزائر
-- يقرأ أسماء المضيفين.
grant select on public.open_games to authenticated;

-- قائمة رفاق المباراة — **أسماء أولى، ولمن هو داخلها وحده.**
create or replace view public.open_game_players as
  select bp.booking_id,
         nullif(split_part(btrim(coalesce(pr.name,'')), ' ', 1), '') as first_name,
         bp.joined_at
    from public.booking_players bp
    join public.profiles pr on pr.id = bp.profile_id
    join public.bookings b  on b.id  = bp.booking_id
   where b.player_id = auth.uid()                       -- المضيف
      or exists (select 1 from public.booking_players me
                  where me.booking_id = bp.booking_id and me.profile_id = auth.uid())  -- أو منضمّ
      or public.is_admin();
grant select on public.open_game_players to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
--  4) الانضمام — قفلُ صفٍّ يحسم آخر مقعد
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.join_open_game(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b     public.bookings;
  taken int;
  left_ int;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'reason', 'auth');
  end if;

  -- ⚛️ القفل هنا هو كل شيء: من هذه اللحظة إلى نهاية المعاملة لا يستطيع طلبٌ
  --    آخر أن يقرأ الصفّ نفسه للتحديث، فالفحص والإدراج يقعان معًا لا بينهما فجوة.
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'missing');
  end if;
  if b.visibility <> 'open' or b.status <> 'confirmed' then
    return jsonb_build_object('success', false, 'reason', 'not_open');
  end if;
  if (b.booking_date::timestamp + make_interval(hours => b.hour)) <= (now() at time zone 'Asia/Amman')::timestamp then
    return jsonb_build_object('success', false, 'reason', 'past');
  end if;
  if b.player_id = auth.uid() then
    return jsonb_build_object('success', false, 'reason', 'host');
  end if;

  -- 🔴 حسابٌ موقوف أو محذوف (`profiles.active=false`) لا ينضمّ. الإيقاف في
  --    `/admin` و«حذف الحساب» في التطبيق كلاهما يُنزل هذه الراية وحدها، ولا
  --    سياسة في القاعدة تقرؤها ⇒ بدون هذا السطر يبقى الموقوف يحجز مقاعد
  --    الناس ولا يحضر، وهو بالضبط سبب إيقافه.
  if not exists (select 1 from public.profiles where id = auth.uid() and active) then
    return jsonb_build_object('success', false, 'reason', 'inactive');
  end if;

  -- 🔴 مقعدٌ واحد في الساعة الواحدة. بدونه يستطيع حسابٌ واحد أن يحجز مقعدًا في
  --    **كل** مباراة عند التاسعة مساءً فيُظهرها ممتلئة للجميع ثمّ لا يحضر أيًّا
  --    منها — وهو أرخص تخريب ممكن هنا لأنه لا يكلّف صاحبه شيئًا (لا مال ولا
  --    سمعة). والقيد صحيحٌ في ذاته كذلك: لا أحد يلعب مباراتين في وقت واحد.
  if exists (
        select 1 from public.booking_players bp
          join public.bookings ob on ob.id = bp.booking_id
         where bp.profile_id = auth.uid()
           and ob.booking_date = b.booking_date
           and ob.hour = b.hour
           and ob.status = 'confirmed') then
    return jsonb_build_object('success', false, 'reason', 'clash');
  end if;

  -- 🔴 وفرعٌ ثانٍ لنفس القاعدة: **المضيف ليس في `booking_players`**. من حجز
  --    ملعبه الساعة التاسعة لا يظهر في جدول المنضمّين لحجزه هو، فالفحص أعلاه
  --    أعمى عنه ⇒ يستضيف مباراته وينضمّ إلى مباراة غيره في الساعة نفسها،
  --    فيأخذ مقعدًا يعرف سلفًا أنه لن يحضره. والقاعدة واحدة: لا أحد يلعب
  --    مباراتين معًا — سواء أكان صاحب الحجز أم ضيفًا عليه.
  if exists (
        select 1 from public.bookings ob
         where ob.player_id = auth.uid()
           and ob.id <> p_booking
           and ob.booking_date = b.booking_date
           and ob.hour = b.hour
           and ob.status in ('pending','confirmed')) then
    return jsonb_build_object('success', false, 'reason', 'clash');
  end if;

  select count(*) into taken from public.booking_players where booking_id = p_booking;
  left_ := b.players_needed - b.players_brought - taken;
  if left_ <= 0 then
    return jsonb_build_object('success', false, 'reason', 'full');
  end if;

  insert into public.booking_players(booking_id, profile_id) values (p_booking, auth.uid())
  on conflict (booking_id, profile_id) do nothing;

  return jsonb_build_object('success', true, 'seats_left', left_ - 1);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
--  الانسحاب — **بلا مهلة، وهذا قرارٌ لا سهو**
--
--  ⚠️ يبدو تناقضًا مع ١.١ (اللاعب لا يُلغي حجزه قبل ٦ ساعات من الصافرة)، وليس
--     كذلك — لأن ما يُحمى في الحالتين مختلف:
--     • **إلغاء الحجز** يُلغي الخانة كلّها. بعد المهلة لا يجد الملعب مشتريًا
--       بديلًا، فتموت الخانة ويخسر المالك بيعةً كاملة. المهلة تحمي **مورد
--       المالك**.
--     • **الانسحاب من مباراة** يعيد **مقعدًا واحدًا** إلى العرض فورًا
--       (‏`seats_left` مشتقّة لا مخزَّنة) — والخانة مباعةٌ ومدفوعة على أي حال،
--       والمالك لا يتأثّر بعدد الحاضرين.
--     ومنعُ الانسحاب المتأخّر لا يُحضِر أحدًا: يتحوّل الانسحاب إلى **غياب
--     صامت**، فيبقى المقعد محجوزًا لمن لن يأتي، ويكتشف المضيف النقص عند
--     الملعب بدل أن يعرفه قبل ساعة ويجد بديلًا. **الحدّ هنا يزيد الضرر.**
--
--  🔔 وليس صامتًا: المضيف يُشعَر بـ`game_left` (القسم 6 أدناه) فيبقى الخبر
--     في يد من يستطيع التصرّف. ولا عقوبة ولا سمعة — نظام السمعة خارج النطاق
--     صراحةً، ووسمُ الانسحاب المتأخّر بلا نظامٍ يحاسب عليه شارةٌ بلا معنى.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.leave_open_game(p_booking uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare gone int;
begin
  delete from public.booking_players
   where booking_id = p_booking and profile_id = auth.uid();
  get diagnostics gone = row_count;
  return jsonb_build_object('success', gone > 0);
end $$;

-- إخراج منضمّ — **للمضيف وحده**، وعلى مباراته وحدها.
create or replace function public.remove_open_game_player(p_booking uuid, p_first_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare host uuid; victim uuid;
begin
  select player_id into host from public.bookings where id = p_booking;
  if host is null or host is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  -- بالاسم الأوّل لأن الواجهة لا تعرف غيره (ولا يجوز أن تعرف). وعند التكرار
  -- يُخرَج **الأحدث انضمامًا**، وهو مذكور في نصّ التأكيد بالواجهة.
  select bp.profile_id into victim
    from public.booking_players bp join public.profiles pr on pr.id = bp.profile_id
   where bp.booking_id = p_booking
     and split_part(btrim(coalesce(pr.name,'')), ' ', 1) = p_first_name
   order by bp.joined_at desc limit 1;
  if victim is null then
    return jsonb_build_object('success', false, 'reason', 'missing');
  end if;
  delete from public.booking_players where booking_id = p_booking and profile_id = victim;
  return jsonb_build_object('success', true);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
--  5) تعديل المباراة — للمضيف، وقبل بدء الخانة
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.set_open_game(
  p_booking uuid, p_open boolean, p_needed smallint default null, p_brought smallint default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings; joined int;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or b.player_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if (b.booking_date::timestamp + make_interval(hours => b.hour)) <= (now() at time zone 'Asia/Amman')::timestamp then
    return jsonb_build_object('success', false, 'reason', 'past');
  end if;
  -- 🔴 حجزٌ ملغى أو مرفوض أو انقضت مهلته لا يصير مباراةً مفتوحة. لا ينشر مقعدًا
  --    (العرض يشترط `confirmed`) لكنّه كان يكتب `visibility='open'` وعددين على
  --    صفٍّ ميّت، فيقرأه كلُّ تقريرٍ يعدّ المباريات المفتوحة.
  if b.status not in ('pending','confirmed') then
    return jsonb_build_object('success', false, 'reason', 'not_open');
  end if;

  select count(*) into joined from public.booking_players where booking_id = p_booking;

  if not p_open then
    -- العودة إلى خاصّة **بلا منضمّين فقط**: من انضمّ رتّب مساءه على هذا.
    if joined > 0 then
      return jsonb_build_object('success', false, 'reason', 'has_players', 'joined', joined);
    end if;
    update public.bookings
       set visibility = 'private', players_needed = null, players_brought = null
     where id = p_booking;
    return jsonb_build_object('success', true);
  end if;

  if p_needed is null or p_brought is null then
    return jsonb_build_object('success', false, 'reason', 'bad_counts');
  end if;
  -- ⚠️ الخفض تحت عدد من انضمّ مرفوض **ومعه العدد**: «لا يمكن» بلا رقم تترك
  --    المضيف يجرّب الأرقام واحدًا واحدًا.
  if p_needed < p_brought + joined then
    return jsonb_build_object('success', false, 'reason', 'below_joined', 'joined', joined,
                              'min_needed', p_brought + joined);
  end if;

  update public.bookings
     set visibility = 'open', players_needed = p_needed, players_brought = p_brought
   where id = p_booking;
  return jsonb_build_object('success', true);
end $$;

revoke all on function public.join_open_game(uuid)                       from public, anon;
revoke all on function public.leave_open_game(uuid)                      from public, anon;
revoke all on function public.remove_open_game_player(uuid, text)        from public, anon;
revoke all on function public.set_open_game(uuid, boolean, smallint, smallint) from public, anon;
grant execute on function public.join_open_game(uuid)                       to authenticated;
grant execute on function public.leave_open_game(uuid)                      to authenticated;
grant execute on function public.remove_open_game_player(uuid, text)        to authenticated;
grant execute on function public.set_open_game(uuid, boolean, smallint, smallint) to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
--  6) الإشعارات — محروسة بوجود ترحيل 14
--
--  ⚠️ **«المباراة تبدأ قريبًا» غير موجود هنا عمدًا.** لا cron في الخطّة
--     المجانية، فلا شيء يستطيع أن يُطلقه في وقته — ونوعٌ لا يكتبه أحد شارةٌ
--     كاذبة في القائمة. الأنواع الأربعة أدناه كلّها **مدفوعة بحدث** يقع فعلًا.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.notifications') is null then
    raise notice '14 غير مُشغَّل ⇒ المباريات تعمل بلا إشعارات. شغّل 14 ثمّ أعِد 22.';
    return;
  end if;

  if exists (select 1 from pg_constraint where conname = 'notifications_kind_chk') then
    alter table public.notifications drop constraint notifications_kind_chk;
  end if;
  alter table public.notifications add constraint notifications_kind_chk
    check (kind in ('booking_new','booking_confirmed','booking_rejected',
                    'booking_cancelled','booking_moved','booking_expired','slot_free',
                    'game_joined','game_left','game_full','game_off'));

  -- ① انضمّ أحدهم / انسحب / اكتمل العدد ⇒ للمضيف
  execute $fn$
    create or replace function public.fn_notify_game_seat()
    returns trigger language plpgsql security definer set search_path = public as $body$
    declare
      b       public.bookings;
      payload jsonb;
      taken   int;
      who     text;
    begin
      select * into b from public.bookings where id = coalesce(new.booking_id, old.booking_id);
      if b.player_id is null or b.player_id = auth.uid() then return coalesce(new, old); end if;

      select count(*) into taken from public.booking_players where booking_id = b.id;
      select nullif(split_part(btrim(coalesce(pr.name,'')), ' ', 1), '') into who
        from public.profiles pr where pr.id = coalesce(new.profile_id, old.profile_id);

      select jsonb_build_object(
               'place_name', p.name, 'field_name', f.name,
               'booking_date', b.booking_date, 'time_label', b.time_label, 'hour', b.hour,
               'first_name', who,
               'seats_left', greatest(b.players_needed - b.players_brought - taken, 0))
        into payload
        from public.places p, public.fields f
       where p.id = b.place_id and f.id = b.field_id;

      if tg_op = 'INSERT' then
        insert into public.notifications(profile_id, kind, booking_id, place_id, data)
        values (b.player_id, 'game_joined', b.id, b.place_id, payload);
        -- واكتمال العدد خبرٌ مستقلّ: يعني «توقّف عن البحث»، لا «انضمّ واحد».
        if (b.players_needed - b.players_brought - taken) <= 0 then
          insert into public.notifications(profile_id, kind, booking_id, place_id, data)
          values (b.player_id, 'game_full', b.id, b.place_id, payload);
        end if;
      else
        insert into public.notifications(profile_id, kind, booking_id, place_id, data)
        values (b.player_id, 'game_left', b.id, b.place_id, payload);
      end if;
      return coalesce(new, old);
    end $body$;
  $fn$;

  drop trigger if exists t_notify_game_seat on public.booking_players;
  create trigger t_notify_game_seat after insert or delete on public.booking_players
    for each row execute function public.fn_notify_game_seat();

  -- ② انتهت المباراة قبل أن تبدأ ⇒ لكلّ من انضمّ
  --    (المضيف ألغى · الملعب رفض أو ألغى · انقضت المهلة · عادت خاصّة)
  --    ⚠️ **الملعب لا يعرف أنهم موجودون** — التطبيق هو الوحيد الذي يستطيع إخبارهم.
  execute $fn$
    create or replace function public.fn_notify_game_off()
    returns trigger language plpgsql security definer set search_path = public as $body$
    declare payload jsonb; ended boolean;
    begin
      ended := (old.status = 'confirmed' and new.status <> 'confirmed')
            or (old.visibility = 'open'  and new.visibility <> 'open');
      if not ended then return new; end if;

      select jsonb_build_object(
               'place_name', p.name, 'field_name', f.name,
               'booking_date', old.booking_date, 'time_label', old.time_label, 'hour', old.hour,
               'cancel_reason', coalesce(new.cancel_reason, ''))
        into payload
        from public.places p, public.fields f
       where p.id = old.place_id and f.id = old.field_id;

      insert into public.notifications(profile_id, kind, booking_id, place_id, data)
      select bp.profile_id, 'game_off', old.id, old.place_id, payload
        from public.booking_players bp
       where bp.booking_id = old.id and bp.profile_id is distinct from auth.uid();
      return new;
    end $body$;
  $fn$;

  drop trigger if exists t_notify_game_off on public.bookings;
  create trigger t_notify_game_off after update on public.bookings
    for each row execute function public.fn_notify_game_off();
end $$;

-- ─── تحقّق بعد التشغيل ─────────────────────────────────────────────────────
-- ⚠️ ① **لا رقم هاتف يخرج من هذا الباب.** بالمفتاح العام وبتوكن لاعب غريب:
--      GET /rest/v1/open_games?select=*                       ⇒ لا عمود هاتف
--      GET /rest/v1/open_games?select=customer_phone          ⇒ 400 (لا وجود له)
--      GET /rest/v1/open_games?select=id&order=customer_phone.desc ⇒ 400
--      GET /rest/v1/open_games?select=id&customer_phone=like.* ⇒ 400
--    وبالمفتاح العام **بلا تسجيل دخول**: المتوقّع 401/403 (المنح لـauthenticated).
--
-- ② المقاعد لا تُنشَر قبل التأكيد: أنشئ حجزًا مفتوحًا (يبقى `pending`) ثمّ
--      select count(*) from public.open_games where id = '<uuid>';   ⇒ 0
--    أكّده من لوحة المالك ⇒ 1.
--
-- ③ آخر مقعد لاثنين معًا: من جلستين مختلفتين نفّذ في اللحظة نفسها
--      select public.join_open_game('<uuid>');
--    المتوقّع: واحدة `{"success":true,"seats_left":0}` والأخرى
--    `{"success":false,"reason":"full"}` — لا اثنتان ناجحتان أبدًا.
--
-- ④ الخفض تحت عدد المنضمّين يُردّ ومعه الرقم:
--      select public.set_open_game('<uuid>', true, 4::smallint, 2::smallint);
--    مع ثلاثة منضمّين ⇒ {"reason":"below_joined","joined":3,"min_needed":5}
--
-- ⑤ الإلغاء يُشعر كلّ منضمّ:
--      -- ألغِ الحجز من حساب المضيف، ثمّ بحساب منضمّ:
--      select kind from public.notifications where kind = 'game_off';
--
-- ⑥ قائمة الرفاق لا يراها غريب:
--      GET /rest/v1/open_game_players?booking_id=eq.<uuid>   بتوكن لاعب لم ينضمّ
--      ⇒ المتوقّع [] لا أسماء.
--
-- ⑦ حسابٌ موقوف لا ينضمّ:
--      update public.profiles set active = false where id = '<uuid اللاعب>';
--      -- ثمّ بتوكن ذلك اللاعب:  select public.join_open_game('<uuid>');
--      ⇒ {"success":false,"reason":"inactive"}      (وأعِد active=true بعدها)
--
-- ⑧ لا مقعدان في ساعة واحدة: انضمّ إلى مباراة، ثمّ إلى أخرى بنفس
--    `booking_date` و`hour`  ⇒ {"success":false,"reason":"clash"}
--
-- ⑨ حجزٌ ميّت لا يصير مفتوحًا: ألغِ حجزًا ثمّ
--      select public.set_open_game('<uuid>', true, 8::smallint, 2::smallint);
--    ⇒ {"success":false,"reason":"not_open"}
