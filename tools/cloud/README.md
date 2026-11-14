# حفظ التقدّم على حساب جوجل (Supabase)

الفكرة: كل طالب بيدخل بحساب جوجل، وتقدّمه (إجابات، علامات، ملاحظات، خطة، أختام…) بيتحفظ على صف خاص بيه في Supabase وبيتزامن لوحده بين أجهزته، وبرضه فاضل عنده نسخة على جهازه. التصدير والاستيراد اليدوي ماتغيّروش.
الكود: `js/cloud.js` + الإعداد `js/cloud-config.js` + الجدول `tools/cloud/supabase.sql`. الدخول من غير مكتبة خارجية (REST مباشرة + PKCE).

## اللي اتعمل في Supabase (مشروع Anatomy-360)
- جدول `progress` (صف لكل طالب) و`progress_backups` (نسخ أمان تلقائية) + Trigger + دالة `delete_my_account()` (الطالب يمسح حسابه).
- RLS شغّال: كل طالب بيقرا ويكتب ويعدّل صفه هو بس، ومفيش حذف مباشر، و`anon` مالوش أي صلاحية. المفتاح العام `sb_publishable_…` اللي في `cloud-config.js` آمن إنه يبقى في ريبو عام.
- اتجرّب على قاعدة البيانات الحقيقية (مستخدمين تجريبيين اتمسحوا بعد الاختبار): عزل بين الطلبة، منع الكتابة فوق صف حد تاني، تحويل `rev`، النسخ الاحتياطية، مسح الحساب بيمسح الصف والنسخ.
- ملاحظة: اختبار الموقع نفسه (تسجيل الدخول والمزامنة) اتعمل على سيرفر وهمي بيحاكي Supabase، لأن بيئتي مفيهاش وصول للإنترنت. عشان كده فيه **تجربة بإيدك** قبل ما نفتحه للطلبة (تحت).

## اللي لازم تعمله إنت (جوجل مش مفعّل لسه في المشروع)

### ١) Google Cloud Console
الموقع بيشتغل على رابطين (الدفعة الحالية على GitHub Pages، وفيرسل نسخة تانية). اختار **رابط واحد** تعتبره الأساسي لشاشة الموافقة (وأنا بكتب الأمثلة بـGitHub Pages لأن الدفعة عليه، وتقدر تبدّله بفيرسل). صفحتا الخصوصية والشروط موجودتين على الاتنين لأنهم بيتنشروا من نفس الريبو.
**ثلاثة حقول بيتلخبطوا في بعض، كل واحد له صيغة:**

| الحقل (فين) | بيتكتب إزاي | القيمة |
|---|---|---|
| **Authorized domains** (Branding) | دومين بس، من غير `https://` ومن غير مسار | `fpj2222hs9-stack.github.io` و`uaxreejcuantlwtuadtv.supabase.co` |
| **Authorized JavaScript origins** (الـOAuth client) | أصل بس: `https://` + الدومين، من غير مسار ولا `/` في الآخر | `https://fpj2222hs9-stack.github.io` (وتقدر تضيف `https://imhotep-lac.vercel.app`) |
| **Authorized redirect URIs** (الـOAuth client) | **رابط Supabase بس**، مش رابط الموقع | `https://uaxreejcuantlwtuadtv.supabase.co/auth/v1/callback` |

لو كتبت رابط GitHub في «Authorized redirect URIs» شيله، ده مكانه رابط Supabase فقط. رابط الموقع بيتحط في Supabase (الخطوة ٢) مش هنا.

1. APIs & Services ← **OAuth consent screen** (Google Auth platform) ← **Branding**:
   - App name: `Imhotep · إمحتب`
   - User support email + Developer contact: إيميلك
   - App logo: `imhotep-logo-120.png` (120×120)
   - App home page: `https://fpj2222hs9-stack.github.io/Anatomy360/`
   - Privacy policy: `https://fpj2222hs9-stack.github.io/Anatomy360/privacy.html`
   - Terms of service: `https://fpj2222hs9-stack.github.io/Anatomy360/terms.html`
   - Authorized domains: زي الجدول فوق. (لازم روابط الصفحة الرئيسية والخصوصية والشروط تكون على نفس الدومين المضاف هنا.)
2. **Audience**: External، وبعد التجربة اضغط **Publish app**.
3. **Data Access (Scopes)**: `openid` و`.../auth/userinfo.email` و`.../auth/userinfo.profile` بس.
4. **Clients** ← Create client ← *Web application* وكمّل بالجدول. انسخ **Client ID** و**Client secret**.
5. ممكن Google يطلب إثبات ملكية الدومين (Search Console، تحطّ ملف HTML في جذر الريبو) أو يرفض دومين الاستضافة المجانية. لو حصل: دومين خاص بيحلها، ابعتلي اللي طلبه وأنا أجهّز الملف.

### ٢) Supabase Dashboard
1. Authentication ← Sign In / Providers ← **Google**: فعّله والزق الـClient ID والـSecret.
2. Authentication ← **URL Configuration**:
   - Site URL: `https://fpj2222hs9-stack.github.io/Anatomy360/` (الرابط الأساسي بتاع الدفعة)
   - Redirect URLs (ضيف الاتنين): `https://fpj2222hs9-stack.github.io/Anatomy360/**` و`https://imhotep-lac.vercel.app/**`
3. Authentication ← Providers ← **Email**: اقفله (الموقع بيدخل بجوجل بس، وده بيمنع أي حد يعمل حسابات بالـAPI).

### ٣) التجربة قبل الفتح للطلبة
الإعداد الحالي `pilot:true`: الميزة مخفية عن كل الطلبة. افتح من متصفحك:
`https://fpj2222hs9-stack.github.io/Anatomy360/?cloud=1`
سجّل بحسابك، وراجع: تقدّمك القديم اتحفظ (الإعدادات ← حسابك: «متزامن»)، افتح الموقع من جهاز/متصفح تاني بنفس الحساب وشوف التقدّم، وجاوب سؤال وشوفه ظهر في الجهاز التاني. (`?cloud=0` بيقفلها على متصفحك.)
لما تتأكد: في `js/cloud-config.js` غيّر `pilot:true` لـ `pilot:false` (وارفع الزيب). وقتها الدخول يبقى إجباري للكل.

## أمان الدخول الإجباري
`required:true` بيقفل الموقع قدام اللي مش مسجّل، **بس** لو جوجل مفعّل فعلًا في Supabase وفي اتصال. لو جوجل اتقفل أو Supabase وقع أو مفيش نت، الموقع بيفتح عادي من التقدّم اللي على الجهاز وبيطلب الدخول بعدين. الطالب اللي سجّل قبل كده بيفتح من غير نت عادي.
لو عايز تقفل الإجباري بسرعة: `required:false`. ولو عايز تقفل الميزة كلها: `on:false`.

## حدود
- Supabase المجاني بيوقف المشروع لو ما اتستخدمش أسبوع، وبيحدد حجم القاعدة. راجع حدود خطتك قبل الدفعة الكبيرة. (التقدّم على الجهاز بيفضل شغّال وقتها.)
- لو الموقع اتفتح كتطبيق على الموبايل (iPhone تحديدًا) جرّب تسجيل الدخول من جوا التطبيق نفسه في التجربة: بعض الأجهزة بتفتح جوجل في نافذة منفصلة وممكن ترجع الدخول للمتصفح مش للتطبيق.
