# الانتقال من Supabase إلى Firebase (خطة Spark المجانية، من غير Cloud Functions)

> **الحالة:** الكود جاهز ومتجرّب على محاكيات. **لسه مش شغّال على الطلبة**: `provider` في `js/cloud-config.js` على `'supabase'`، وصفحة الخصوصية على الموقع هي الحالية. مفيش أي حاجة اتنفّذت على مشروع Firebase الحقيقي (مفيش موصّل ليه في الجلسة). الملف ده هو الدليل الكامل بالترتيب.

## ١) إيه اللي بينتقل وإيه اللي بيفضل

| | بعد التحويل |
|---|---|
| حسابات الدخول (جوجل) | **بتنتقل** لـ Firebase Authentication بنفس الـ `uid` ومعرّف جوجل. الطالب بيدوس «دخول بجوجل» مرة واحدة بس. |
| تقدّم الطلبة | **بينتقل** لـ Firestore (`progress/{uid}`). |
| نسخ الأمان | **بتنتقل** (`progress_backups`)، وبعد كده بتتاخد بمهمة GitHub Actions يومية (مفيش Cloud Functions على Spark). |
| محادثات حورس المحفوظة | **بتنتقل** (`horus_chat/{uid}`). |
| حورس نفسه (الدالة اللي بتكلّم Gemini، عدّاد الأسئلة اليومي، الكاش المشترك، نص الكتب) | **بيفضل على Supabase**. الدالة بتتحقق من توكن Firebase بنفسها. مفيش حاجة منه بتتحرّك. |
| لوحة الشرف والبلاغات (Google Sheets) | ما بتتغيّرش. |

الانتقال **نسخ مش نقل**: بيانات Supabase بتفضل زي ما هي، فالرجوع دايمًا ممكن (القسم ٨).

## ٢) إزاي بنتأكد إننا بننقل **أحدث** تقدّم (٤ طبقات)

1. **النسخ بيتكرر بأمان.** `migrate-apply` بيتشغّل تاني يوم التحويل وبعد يوم وبعد أسبوع. أي طالب لسه ما استخدمش Firebase بيتحدّث سجله من Supabase بآخر نسخة. أي سجل كتب فيه الموقع على Firebase **ما بيتكتبش فوقه أبدًا**.
2. **الجهاز بيحمل نسخة كاملة.** تقدّم كل طالب موجود على جهازه أصلًا. في أول دخول على Firebase الموقع بيعمل **دمج** (اتحاد الإجابات بين الجهاز والسجل) ويرفع الأحدث. يعني أي إجابة اتحلّت بعد آخر نسخ ما بتضيعش (متجرّب في `fb-migrate.cjs`).
3. **مراجعة بالأرقام.** `migrate-verify` بيقارن **كل إجابة (بـ id السؤال) عند كل طالب على Supabase** بالموجود على Firebase، وبيطبع سطر زي:
   `ANSWERS on Supabase 22715 · also on Firebase 22715 · nothing missing`
   لو في ناقص بيقولك كام إجابة ولكام طالب (غالبًا جهاز قديم لسه ما اتحدّثش، وبيندمج أول ما يفتح الموقع).
4. **مقارنة SQL مستقلة** (الجزء ٦) تقدر تعملها بنفسك.

**الخط الأساسي النهارده (٢٠ نوفمبر ٢٠٢٦):** ١٩٩ سجل تقدّم، ٢٢٬٧١٥ إجابة، ٢٠٠ حساب كلهم بجوجل، ٢٣٨ نسخة أمان، ٩٦ محادثة حورس. أكبر سجل ٢٢٥ ألف بايت (الحد ١٬٠٠٠٬٠٠٠). ٥٧ طالب ذاكروا في آخر ٢٤ ساعة، فالأرقام هتزيد قبل التحويل، وده طبيعي.

## ٣) اللي لازم تعمله إنت (مرة واحدة)

> ⚠️ **ممنوع** تبعتلي في الشات أي مفتاح سري أو ملف service account. الأسرار بتتحط في GitHub Secrets بس.

### أ) Firebase console (console.firebase.google.com)
1. **Add project** (مثلًا `imhotep`). اقفل Google Analytics (مش محتاجينه). سيب الخطة **Spark**، **ماترقّيش**.
2. **Build ← Firestore Database ← Create database**: الوضع **Production**، المنطقة **`europe-west3` (Frankfurt)**. ⚠️ المنطقة **مش بتتغيّر بعد الإنشاء**. لو اخترت منطقة تانية قولّي عشان صفحة الخصوصية تتظبط (`FB_REGION_*` في `tools/legal/build_legal.py`).
3. **Build ← Authentication ← Get started ← Sign-in method ← Google ← Enable** وحط إيميل الدعم ← Save.
4. نفس الصفحة ← **Google ← Web SDK configuration**: انسخ **Web client ID** (ده رقم عام مش سر).
   - **الأسهل (مُوصى به):** استخدم نفس OAuth client بتاع Supabase اللي شاشة الموافقة بتاعته جاهزة. حطّ الـ Client ID بتاعه في خانة **«Whitelist client IDs from external projects»** ← Save.
   - البديل: استخدم الـ client اللي Firebase عمله لوحده («Web client (auto created by Google Service)»).
5. **Project settings ← General ← Your apps ← Web app (`</>`)**: سجّل تطبيق ويب باسم أي حاجة (من غير Hosting). انسخ **`apiKey`** و**`projectId`** (قيم عامة محميّة بالقواعد).

### ب) Google Cloud Console (نفس مشروع Firebase أو مشروع الـ client)
1. **APIs & Services ← Credentials ← الـ OAuth client اللي اخترته ← Authorized redirect URIs**: ضيف الروابط **حرفيًا** (بالـ `/` في الآخر وبدون `index.html`)، **من غير ما تشيل رابط Supabase** القديم (عشان الرجوع يفضل شغّال):
   - `https://imhotep-lac.vercel.app/`
   - `https://fpj2222hs9-stack.github.io/Anatomy360/`
2. **Authorized domains** في شاشة الموافقة: ضيف `imhotep-lac.vercel.app` (و`fpj2222hs9-stack.github.io` موجود).
3. **تقييد الـ API key (مهم):** Credentials ← الـ Browser key بتاع Firebase ← *Application restrictions: Websites* وحط الرابطين فوق (بـ `/*` في الآخر)، و*API restrictions*: **Identity Toolkit API** و**Token Service API** و**Cloud Firestore API**. لو قيّدت أكتر من كده الدخول هيقف (الموقع بيفضل شغّال بالمخزّن على الجهاز، وبيبيّن للطالب رسالة).

### ج) GitHub (Settings ← Secrets and variables ← Actions)
| الاسم | القيمة | نوعه |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | محتوى ملف JSON كله (Firebase ← Project settings ← Service accounts ← Generate new private key) | Secret |
| `SUPABASE_URL` | `https://uaxreejcuantlwtuadtv.supabase.co` | Secret (للنقل بس) |
| `SUPABASE_SECRET_KEY` | مفتاح `sb_secret_…` (Supabase ← Settings ← API Keys) | Secret (للنقل بس) |
| `FIREBASE_BACKUP` | `on` | Variable (بيشغّل النسخ اليومي) |

وحط `tools/firebase/workflows/firebase.yml` في **`.github/workflows/firebase.yml`** (من الواجهة: Add file ← Create new file). الـ workflow بتاع الـ unzip مابيقدرش يكتب هناك.

### د) ملء `js/cloud-config.js`
```js
provider: 'supabase',            // لسه، مش هنغيّره دلوقتي
fb: { projectId: '…', apiKey: '…', clientId: '….apps.googleusercontent.com',
      redirects: ['https://imhotep-lac.vercel.app/', 'https://fpj2222hs9-stack.github.io/Anatomy360/'],
      responseType: 'id_token' }
```
كلها قيم عامة. **ممنوع** مفتاح Gemini أو ملف service account أو `sb_secret_`.

## ٤) الترتيب (Actions ← Firebase ← Run workflow ← الـ action)

| # | الإجراء | المطلوب | المتوقع |
|---|---|---|---|
| ١ | ارفع `site.zip` الجديد | — | ما بيتغيّرش حاجة للطلبة (`provider` لسه `supabase`) |
| ٢ | `unit-tests` | — | كل الاختبارات تعدّي |
| ٣ | `rules-test` | — | اختبارات قواعد Firestore على المحاكي الرسمي |
| ٤ | `deploy` | الأسرار | بينشر `firestore.rules` والفهارس |
| ٥ | ملء `fb{}` (القسم ٣-د) وارفع | — | — |
| ٦ | `selftest` | الأسرار | فحص كامل على المشروع الحقيقي بمستخدم تجريبي (بيتمسح)، وبيتأكد إن حورس بيقبل توكن Firebase |
| ٧ | `migrate-dry-run` | الأسرار | تقرير من غير كتابة. `users.source` لازم = ٢٠٠ تقريبًا و`noGoogle` = 0 |
| ٨ | `migrate-apply` + `confirm = APPLY` | الأسرار | `RESULT ok` |
| ٩ | `migrate-verify` | الأسرار | `nothing missing` و`RESULT ok` |
| ١٠ | **تجربة على متصفحك:** افتح الموقع بـ `?fb=1` | — | دخول بجوجل مرة واحدة، تقدّمك كامل، ذاكر سؤال وشوفه من جهاز تاني. الرجوع: `?fb=x` |
| ١١ | **حورس يقبل Firebase:** Supabase ← Edge Functions ← Secrets ← `FIREBASE_PROJECT_ID` = معرّف مشروعك، وإعادة نشر دالة `horus` من `tools/horus/edge/` | **ابعتلي «انشر حورس لـ Firebase» وأنا أنشره بالموصّل. مش هعمله من نفسي** | افتح `https://uaxreejcuantlwtuadtv.supabase.co/functions/v1/horus` في المتصفح: لازم يظهر `"fb":true` جوه `ready` |
| ١٢ | **يوم التحويل** (وقت هادي، بعد منتصف الليل): `migrate-apply` ثم `migrate-verify` تاني | الأسرار | لازم `nothing missing` |
| ١٣ | **Commit واحد:** `provider: 'firebase'` في `js/cloud-config.js`، واستبدال `privacy.html` بـ `tools/firebase/legal/privacy.html` (التاريخ جواه بتاريخ التوليد؛ لو اتأخّرت قولّي أعيد توليده)، ورفع `VERSION` في `sw.js` | — | — |
| ١٤ | `migrate-apply` + `migrate-verify` **بعد يوم وبعد أسبوع** | الأسرار | بيلتقط أي طالب كان لسه على نسخة قديمة |
| ١٥ | بعد أسبوعين: وقّف الكتابة على Supabase (ما تمسحش). بعد **شهر** وآخر `verify` نضيف: امسح بيانات Supabase القديمة | — | — |

كل الخطوات اللي بتكتب (`deploy`, `migrate-apply`, نشر حورس، التحويل) **مش هتتنفّذ من عندي قبل ما تأكّد**.

## ٥) النسخ الاحتياطي اليومي
- `FIREBASE_BACKUP = on` بيشغّله كل يوم 8:30 UTC (10:30 صباحًا بالقاهرة شتاءً). بيتنسخ بس الطلبة اللي اتغيّر تقدّمهم من آخر مرة (يوم هادي = صفر قراءات).
- **٣ خانات بالتناوب** (آخر ٣ أيام). لو طالب خسر أكتر من ٣٠٪ من إجاباته (وأكتر من ٢٠ إجابة) في يوم واحد، النسخ القديمة السليمة **بتتحفظ** ومابتتكتبش فوقها لحد ما يعدّي ٧ أيام (يعني احتمال جهاز بيانات اتمسحت غلط).
- GitHub بيوقف الـ workflows المجدولة في الريبو العام لو ما حصلش فيه أي نشاط ٦٠ يوم. لو الموقع هيقعد من غير تعديل أكتر من كده، شغّل `backup` يدويًا مرة.
- لوج الـ Actions فيه أرقام وأكواد بس (مفيش إيميلات ولا uid ولا إجابات)، ومترفعش ناتج أي خطوة كـ artifact.

## ٦) مقارنة SQL مستقلة (للقراءة بس، في Supabase ← SQL editor)
```sql
-- عدد السجلات ومجموع الإجابات (بالـ id، زي ما بيعد verify)
select count(*) as students,
       coalesce(sum(n),0) as total_answers
from (select (select count(*) from jsonb_object_keys(coalesce(data->'ans','{}'::jsonb))) as n
      from public.progress) x;

-- الحسابات اللي ملهاش جوجل (لازم 0) والسجلات اللي مالهاش حساب (لازم 0)
select (select count(*) from auth.users u where not exists
          (select 1 from auth.identities i where i.user_id=u.id and i.provider='google')) as users_no_google,
       (select count(*) from public.progress p where not exists
          (select 1 from auth.users u where u.id=p.user_id)) as orphan_progress;

-- أكبر سجل بالبايت (الحد في Firestore ١٬٠٠٠٬٠٠٠ والقواعد ٩٠٠٬٠٠٠)
select max(octet_length(data::text)) from public.progress;
```
قارن `total_answers` برقم `migrate-verify`. الفرق المقبول: إجابات اتحلّت على Supabase بعد آخر `apply` (شغّل `apply` تاني). على Firebase مفيش عدّاد جاهز في الـ console لعدد السجلات، فالرقم بيتاخد من `migrate-verify`.

## ٧) حدود الخطة المجانية (Spark) بصراحة
- الحصة اليومية المجانية في Firestore (حسب ما أعرف، راجع صفحة Firebase Pricing): ٥٠ ألف قراءة، ٢٠ ألف كتابة، ٢٠ ألف مسح، وجيجا تخزين. تقديرنا: كتابة كل ٢ دقيقة بحد أقصى لكل طالب نشيط، وقراءة كل ٥ دقايق، يعني حوالي ٤–٥ آلاف كتابة وألفين قراءة في اليوم لـ ١٠٠ طالب نشيط. بعيد عن الحد، بس **التقدير مش قياس**.
- لو الحصة خلصت Firestore بيرجّع 429: الموقع بيحتفظ بالتقدّم على الجهاز، بيقول للطالب كده، وبيكمّل لوحده لما الحصة تتجدد. مفيش ضياع.
- مفيش **Blaze** يعني مفيش دوال سحابية ولا ميزانية بتتصرف.
- المسح بيحصل من جهاز الطالب بصلاحيته هو، **وبيطلب دخول حديث** (آخر ٤ دقايق). لو الدخول قديم الموقع بيقول «سجّل دخولك بجوجل تاني» ومابيمسحش حاجة نصّاني.

## ٨) الرجوع لـ Supabase (في أي وقت، بيانات Supabase لسه موجودة)
1. `provider: 'supabase'` في `js/cloud-config.js`، وصفحة الخصوصية الأصلية (`python3 tools/legal/build_legal.py .`)، ورفع `VERSION`.
2. أي إجابة اتحلّت على Firebase بعد التحويل موجودة على جهاز الطالب، وبترفعها لـ Supabase أول دخول (الجهاز بيفتكر آخر مزوّد ويعمل دمج).

## ٩) اللي ماتجرّبش هنا (جرّبه إنت في الخطوات)
| | بيتغطّى بإيه |
|---|---|
| قبول جوجل لـ `response_type=id_token` مع الـ client بتاعك | **خطوة ١٠ (تجربة `?fb=1`).** دي أكبر نقطة ماقدرتش أجرّبها. لو جوجل رفض ابعتلي نص الخطأ وفضّل `provider` على supabase، مفيش ضرر. |
| قواعد Firestore الحقيقية | `rules-test` (محاكي رسمي) + `selftest` (المشروع الحقيقي) |
| `npm install` و`firebase-tools` والـ workflow نفسه على GitHub | أول تشغيل (الـ npm مش بيتفتح من الجلسة عندي) |
| Gemini الحقيقي مع توكن Firebase | `selftest` مع `ask` + سؤال حورس بـ `?fb=1` |
| حصة Firestore الحقيقية | بتتراقب في Firebase ← Usage |

اللي اتجرّب هنا: اختبارات Node (نسخ احتياطي ١٠، نقل ١٤، تحقق توكن Firebase ٢٣، handler حورس ١٩، أولويات ١١)، واختبارات متصفح على محاكي Firebase (cloud1، cloud2، حورس، النقل، التبديل) ومحاكي Supabase، كلها بتعدّي.

## ١٠) ملفات المجلد
| | |
|---|---|
| `firestore.rules` · `firestore.indexes.json` · `firebase.json` | القواعد (الطالب بيقرا ويكتب سجله هو بس، `rev` لازم يزيد ١، مفيش مسح لسجل غيره) |
| `migrate/` | النقل (`dry-run` / `apply` / `verify`) |
| `backup/` | النسخ اليومي |
| `selftest.mjs` | فحص على المشروع الحقيقي |
| `workflows/firebase.yml` | الـ workflow (يتحط في `.github/workflows/`) |
| `legal/privacy.html` | صفحة الخصوصية بصيغة Firebase (تتحط يوم التحويل) |
| `tests/` | اختبارات المحاكيات والقواعد |
