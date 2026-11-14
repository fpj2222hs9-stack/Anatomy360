# -*- coding: utf-8 -*-
"""Generates privacy.html and terms.html (static, bilingual AR/EN) into the site root.
usage: python3 build_legal.py <site-dir>"""
import sys, os, html
SITE = 'https://imhotep-lac.vercel.app'
UPDATED_AR = '١٤ نوفمبر ٢٠٢٦'
UPDATED_EN = 'November 14, 2026'

CSS = """
:root{--bg:#F6EEDA;--card:#FCF8EC;--ink:#1d2433;--mut:#5b6475;--navy:#1E3F8F;--gold:#E3A93A;--line:#e4d7b8}
@media (prefers-color-scheme:dark){:root{--bg:#0A1322;--card:#101c31;--ink:#e8ecf5;--mut:#a3adc2;--navy:#8fb0ff;--gold:#E3A93A;--line:#233252}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.85 "IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:20px 16px 56px}
header.top{display:flex;align-items:center;gap:12px;padding:8px 0 18px;border-bottom:1px solid var(--line);margin-bottom:22px;flex-wrap:wrap}
header.top a.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--navy)}
header.top svg{width:44px;height:44px;flex:none}
header.top .nm{font-family:"Reem Kufi","IBM Plex Sans Arabic",sans-serif;font-size:1.5rem;font-weight:700;line-height:1.1}
header.top .nm small{display:block;font:500 .72rem/1.2 "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--mut);direction:ltr;text-align:right}
header.top nav{margin-inline-start:auto;display:flex;gap:14px;flex-wrap:wrap;font-size:.92rem}
a{color:var(--navy)}
h1{font-family:"Reem Kufi","IBM Plex Sans Arabic",sans-serif;font-size:1.9rem;line-height:1.3;margin:.2em 0 .1em;color:var(--navy)}
h2{font-size:1.15rem;margin:1.7em 0 .4em;color:var(--navy);padding-inline-start:12px;border-inline-start:4px solid var(--gold)}
p,li{margin:.45em 0}ul{padding-inline-start:1.4em}
.meta{color:var(--mut);font-size:.9rem;margin:0 0 1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 20px 18px;margin:14px 0}
.note{background:var(--card);border:1px dashed var(--gold);border-radius:12px;padding:10px 14px;margin:14px 0;font-size:.95rem}
.lang{display:flex;gap:10px;margin:8px 0 6px;font-size:.92rem}
section[lang=en]{direction:ltr;text-align:left;font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;margin-top:46px;padding-top:26px;border-top:2px solid var(--line)}
section[lang=en] h1{font-family:"Marcellus","IBM Plex Sans",serif;font-size:1.6rem}
section[lang=en] h2{border-inline-start:0;border-left:4px solid var(--gold);padding-inline-start:0;padding-left:12px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:.88rem;display:flex;gap:14px;flex-wrap:wrap}
@media print{body{background:#fff;color:#000}.card,.note{border-color:#999}header.top nav,.lang{display:none}}
"""

LOGO = '<svg viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="22" fill="#F6EEDA"/><g transform="translate(14 22) scale(1.4)"><g fill="#1E3F8F"><rect x="2" y="55" width="60" height="7"/><rect x="6" y="47" width="52" height="7"/><rect x="11" y="39" width="42" height="7"/><rect x="16" y="31" width="32" height="7"/><rect x="21" y="23" width="22" height="7"/><rect x="26" y="15" width="12" height="7"/></g><circle cx="32" cy="6" r="4.6" fill="#E3A93A"/></g></svg>'

def page(kind, ar_title, en_title, ar_body, en_body):
    other = 'terms' if kind == 'privacy' else 'privacy'
    other_ar = 'الشروط والأحكام' if kind == 'privacy' else 'سياسة الخصوصية'
    other_en = 'Terms of Service' if kind == 'privacy' else 'Privacy Policy'
    return f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(ar_title)} · إمحتب Imhotep</title>
<meta name="description" content="{html.escape(ar_title)} / {html.escape(en_title)} — Imhotep (إمحتب), a free medical-student question bank.">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Marcellus&family=Reem+Kufi:wght@400..700&display=swap">
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="brand" href="./">{LOGO}<span class="nm">إمحتب<small>IMHOTEP</small></span></a>
  <nav><a href="./">الموقع · Home</a><a href="{other}.html">{other_ar} · {other_en}</a></nav>
</header>
<p class="lang"><a href="#ar">العربية</a><a href="#en">English</a></p>
<section id="ar" lang="ar" dir="rtl">
<h1>{ar_title}</h1>
<p class="meta">آخر تحديث: {UPDATED_AR} · <a href="./">الموقع</a></p>
{ar_body}
</section>
<section id="en" lang="en" dir="ltr">
<h1>{en_title}</h1>
<p class="meta">Last updated: {UPDATED_EN} · <a href="./">Website</a></p>
{en_body}
</section>
<footer><span>© Imhotep · إمحتب</span><a href="./">الرئيسية · Home</a><a href="privacy.html">الخصوصية · Privacy</a><a href="terms.html">الشروط · Terms</a></footer>
</div>
</body>
</html>
"""

PRIV_AR = """
<div class="note">الخلاصة: بنستخدم حساب جوجل بتاعك عشان نحفظ تقدّمك في المذاكرة ونزامنه بين أجهزتك. بنطلب بس اسمك وإيميلك وصورتك العامة. مش بنبيع بياناتك ومش بنستخدمها في إعلانات، وتقدر تمسح حسابك وكل بياناتك من داخل الموقع في أي وقت.</div>

<h2>١. مين إحنا</h2>
<p>«إمحتب» (Imhotep) موقع تعليمي مجاني لطلبة الطب: أسئلة بمفاتيحها، تدريب، واختبارات بالساعة المائية. من تصميم وتطوير د. سيف يسري (Dr.Saif Youssry)، وهو المسؤول عن الموقع وعن البيانات الموضّحة هنا.</p>

<h2>٢. إيه البيانات اللي بنجمعها</h2>
<div class="card">
<p><b>من حساب جوجل (عند تسجيل الدخول):</b> اسمك، عنوان بريدك الإلكتروني، ورابط صورة حسابك. بنطلب الصلاحيات الأساسية فقط (<span dir="ltr">openid · email · profile</span>). <b>مش</b> بنطلب أي صلاحية على Gmail أو Drive أو جهات الاتصال أو أي بيانات تانية في حسابك.</p>
<p><b>تقدّمك في المذاكرة:</b> إجاباتك على الأسئلة وتوقيتها، العلامات والملاحظات، الأسئلة اللي غلطت فيها، سجل أيام المذاكرة والجلسات المنتهية، خطة المذاكرة، الأختام والخرطوشة، واسم العرض والصورة اللي اخترتهم جوه الموقع، وبيانات اشتراكك في لوحة الشرف لو اشتركت. إعدادات المظهر وحجم الخط والجلسات المفتوحة حاليًا بتفضل على جهازك ومش بتتزامن.</p>
<p><b>لوحة الشرف (اختيارية):</b> لو اشتركت بس، اسم الظهور ومرحلتك ومؤشرك ونقاطك وعدد الأسئلة اللي جاوبتها بتتبعت لشيت خاص بالموقع على Google وبتظهر لباقي المشتركين. مفيش إجابات ولا إيميل ولا صور ولا أرقام واتساب بتظهر.</p>
<p><b>بلاغات الأخطاء:</b> لو بلّغت عن سؤال، بنستلم نص البلاغ وبيانات السؤال واسمك ورقم الواتساب اللي كتبته، وبنستخدمهم للتواصل معاك بخصوص البلاغ فقط.</p>
<p><b>إحصائيات الزيارات:</b> الموقع بيستخدم Google Analytics لإحصائيات استخدام عامة (عدد الزيارات والصفحات والجهاز والبلد التقريبي)، وبيستخدم كوكيز خاصة به.</p>
<p><b>حورس (مساعد المذاكرة بالذكاء الاصطناعي) لو اتفعّل:</b> لما تسأل حورس، نص سؤالك وآخر كام رسالة في المحادثة بيتبعتوا لخدمة Gemini من Google عشان تتولّد الإجابة، <b>من غير</b> اسمك أو إيميلك أو أي بيانات عن حسابك. بنحفظ محادثتك (أسئلتك وإجابات حورس) على حسابك عشان تظهرلك على أي جهاز، وبنحفظ عدد الأسئلة اللي سألتها كل يوم عشان نطبّق الحد اليومي. وكمان نص السؤال وإجابته ممكن يتخزّنوا في ذاكرة مشتركة (كاش) بين الطلبة، من غير أي ربط بحسابك. معالجة Google للنص بتخضع لشروطها، فمتكتبش لحورس معلومات شخصية أو صحية عن نفسك.</p>
</div>

<h2>٣. بنستخدم البيانات في إيه</h2>
<ul>
<li>حفظ تقدّمك على حسابك ومزامنته بين أجهزتك وعرض اسمك وصورتك داخل الموقع.</li>
<li>تشغيل لوحة الشرف لو اشتركت، والرد على بلاغاتك، وإحصائيات مجمّعة لتحسين الموقع.</li>
</ul>
<p>مش بنبيع بياناتك ومش بنشاركها لأغراض إعلانية، ومش بنستخدم بيانات حساب جوجل لأي غرض غير تقديم الميزات دي. استخدام الموقع ونقله للمعلومات المستلمة من Google APIs ملتزم بـ <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a> بما فيها شروط «الاستخدام المحدود» (Limited Use).</p>

<h2>٤. فين بتتخزّن ومين بيعالجها</h2>
<ul>
<li><b>Supabase</b> (قاعدة البيانات وتسجيل الدخول): الخوادم في منطقة فرانكفورت بالاتحاد الأوروبي. تقدّم كل طالب في سجل واحد خاص بيه، وصلاحيات قاعدة البيانات بتمنع أي حساب إنه يقرأ أو يكتب سجل حساب تاني. ولو حورس متاح بنخزّن هنا كمان محادثتك مع حورس (سجل خاص بيك بنفس الحماية)، وعدّاد أسئلتك اليومي، والذاكرة المشتركة للإجابات (من غير ربط بحسابك).</li>
<li><b>Google</b>: تسجيل الدخول، وGoogle Analytics، وجداول Google (لوحة الشرف والبلاغات)، وGemini (لو حورس متاح).</li>
<li><b>Vercel وGitHub</b>: استضافة ملفات الموقع فقط. مش بيخزّنوا تقدّمك.</li>
<li>على جهازك: نسخة من تقدّمك بتفضل في متصفحك ويشتغل الموقع منها حتى من غير إنترنت.</li>
<li>بنحتفظ في قاعدة البيانات بعدد صغير من النسخ الاحتياطية التلقائية لتقدّمك (آخر نسختين يوميتين تقريبًا، وآخر نسختين لو حصل نقص مفاجئ في الإجابات)، عشان لو جهاز بيانات اتمسحت غلط ما يضيعش تقدّمك. بتتمسح مع حسابك.</li>
<li>صاحب الموقع بصفته مدير المشروع يقدر تقنيًا يوصل لقاعدة البيانات، ومش بيستخدم ده إلا للصيانة وحل المشاكل.</li>
</ul>

<h2>٥. الاحتفاظ بالبيانات والحذف</h2>
<p>بنحتفظ بتقدّمك طول ما حسابك موجود. تقدر تمسح حسابك وكل بياناتك المخزّنة على السيرفر (تقدّمك ونسخه الاحتياطية) من داخل الموقع: <b>الإعدادات ← حسابك ← «احذف حسابي وبياناتي من السيرفر»</b>. الحذف بيشيل بياناتك من السيرفر بس (ومعاها محادثة حورس وعدّاد أسئلتك اليومي)، والنسخة اللي على جهازك بتفضل لحد ما تمسحها بنفسك. تقدر كمان تمسح محادثتك مع حورس لوحدها من زرار المسح جوه بانل حورس، وتصدّر نسخة من تقدّمك في أي وقت من الإعدادات. تسجيل الخروج بيمسح نسخة المحادثة اللي على الجهاز (والنسخة على حسابك بتفضل). لإلغاء اشتراكك من لوحة الشرف استخدم صفحة لوحة الشرف.</p>

<h2>٦. الأمان</h2>
<p>الاتصال بالموقع والسيرفر مشفّر (HTTPS)، والموقع مش بيشوف ولا بيخزّن كلمة سر جوجل بتاعتك. ورغم كده مفيش نظام آمن بنسبة ١٠٠٪، فبنحاول نقلّل المخاطر ونصلّح أي ثغرة بنعرفها.</p>

<h2>٧. الأطفال</h2>
<p>الموقع موجّه لطلبة الطب (طلبة جامعة) ومش موجّه للأطفال.</p>

<h2>٨. التعديلات</h2>
<p>ممكن نحدّث السياسة دي لما الموقع يتطوّر، وهنغيّر تاريخ «آخر تحديث» فوق. استمرارك في الاستخدام بعد التحديث يعني موافقتك عليه.</p>

<h2>٩. التواصل</h2>
<p>لأي سؤال عن الخصوصية أو طلب بخصوص بياناتك، استخدم زر «بلّغ» داخل الموقع (بيوصل لصاحب الموقع مباشرة) واكتب إن الموضوع عن الخصوصية. راجع كمان <a href="terms.html">الشروط والأحكام</a>.</p>
"""

PRIV_EN = """
<div class="note">In short: we use your Google account to save your study progress and sync it across your devices. We only receive your name, email address and public profile picture. We do not sell your data or use it for advertising, and you can delete your account and all server-side data from inside the site at any time.</div>

<h2>1. Who we are</h2>
<p>Imhotep (إمحتب) is a free educational website for medical students: question banks with answer keys, practice, and timed exams. It is designed and run by Dr. Saif Youssry, who is responsible for the site and for the data described here.</p>

<h2>2. Data we collect</h2>
<div class="card">
<p><b>From your Google account (when you sign in):</b> your name, email address and profile picture URL. We request only the basic scopes (<code>openid</code>, <code>email</code>, <code>profile</code>). We do <b>not</b> request access to Gmail, Drive, contacts or any other data in your Google account.</p>
<p><b>Your study progress:</b> your answers and their timestamps, marks and notes, questions you got wrong, daily study history and finished sessions, your study plan, seals/badges, the display name and picture you chose inside the site, and your leaderboard registration details if you joined it. Appearance settings, font size and unfinished sessions currently stay on your device and are not synced.</p>
<p><b>Leaderboard (optional):</b> only if you join, your display name, stage, index, points and number of answered questions are sent to a Google Sheet owned by the site and shown to other members. No answers, email, photo or phone number are shown.</p>
<p><b>Error reports:</b> if you report a question, we receive the report text, the question details, your name and the WhatsApp number you typed, and use them only to follow up on that report.</p>
<p><b>Usage statistics:</b> the site uses Google Analytics for general usage statistics (visits, pages, device, approximate country) and its own cookies.</p>
<p><b>Horus (AI study assistant), if enabled:</b> when you ask Horus, your question text and the last few messages of the conversation are sent to Google’s Gemini service to generate the answer, <b>without</b> your name, email or any account details. We save your conversation (your questions and Horus’s answers) to your account so it appears on any device, and we keep a count of how many questions you asked each day to apply the daily limit. The question text and its answer may also be stored in a cache shared between students, with no link to your account. Google’s handling of the text is governed by its own terms, so please do not type personal or health information about yourself to Horus.</p>
</div>

<h2>3. How we use it</h2>
<ul>
<li>To save your progress to your account, sync it across your devices, and show your name and picture inside the site.</li>
<li>To run the leaderboard if you joined, answer your reports, and produce aggregate statistics to improve the site.</li>
</ul>
<p>We do not sell your data, do not share it for advertising, and do not use Google user data for anything other than providing these features. Imhotep’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>4. Where data is stored and who processes it</h2>
<ul>
<li><b>Supabase</b> (database and authentication): servers in Frankfurt, EU. Each student’s progress is a single record, and database row-level security prevents any account from reading or writing another account’s record. If Horus is available, we also store here your conversation with Horus (a private record with the same protection), your daily question counter, and the shared answer cache (not linked to your account).</li>
<li><b>Google</b>: sign-in, Google Analytics, Google Sheets (leaderboard and reports), and Gemini (if Horus is available).</li>
<li><b>Vercel and GitHub</b>: hosting of the site files only. They do not store your progress.</li>
<li>On your device: a copy of your progress stays in your browser so the site works even without internet.</li>
<li>The database keeps a small number of automatic safety backups of your progress (about the latest 2 daily ones, plus the latest 2 taken after a sudden drop in answers) so that wiped browser data cannot destroy your account progress. They are deleted together with your account.</li>
<li>As project administrator, the site owner can technically access the database, and uses that only for maintenance and troubleshooting.</li>
</ul>

<h2>5. Retention and deletion</h2>
<p>We keep your progress as long as your account exists. You can delete your account and all your server-side data (progress and its backups) from inside the site: <b>Settings → Your account → “Delete my account and data from the server”</b>. Deletion removes your data from the server only (including your Horus conversation and daily counter); the copy on your device stays until you clear it yourself. You can clear your Horus conversation on its own with the clear button inside the Horus panel, and export a copy of your progress at any time from the settings. Signing out removes the conversation copy kept on the device (the copy on your account stays). To leave the leaderboard, use the leaderboard page.</p>

<h2>6. Security</h2>
<p>Connections to the site and server are encrypted (HTTPS), and the site never sees or stores your Google password. No system is 100% secure, so we work to reduce risk and fix any weakness we learn about.</p>

<h2>7. Children</h2>
<p>The site is intended for medical students at university level and is not directed at children.</p>

<h2>8. Changes</h2>
<p>We may update this policy as the site evolves and will change the “Last updated” date above. Continuing to use the site after an update means you accept it.</p>

<h2>9. Contact</h2>
<p>For privacy questions or requests about your data, use the “Report” button inside the site (it reaches the site owner directly) and mention that it is about privacy. See also the <a href="terms.html">Terms of Service</a>.</p>
"""

TERMS_AR = """
<div class="note">إمحتب موقع مجاني للمذاكرة. استخدامه معناه إنك موافق على الشروط دي. الأسئلة بتتراجع لكن ممكن يبقى فيها أخطاء، والكتاب والمنهج المعتمد دايمًا هما المرجع.</div>

<h2>١. القبول</h2>
<p>باستخدامك لموقع «إمحتب» (Imhotep) أو تسجيل الدخول بحساب جوجل بتوافق على الشروط دي وعلى <a href="privacy.html">سياسة الخصوصية</a>. لو مش موافق، لا تستخدم الموقع.</p>

<h2>٢. طبيعة الموقع</h2>
<ul>
<li>الموقع مساعد تعليمي لطلبة الطب للمذاكرة والتدريب، ومش بديل عن المحاضرات والكتب المعتمدة، ومش مرجع إكلينيكي ولا استشارة طبية ولا يُستخدم في قرارات علاج.</li>
<li>الأسئلة مجمّعة من مصادر مذكورة في الموقع، وبتتراجع مفاتيحها. ممكن تحصل أخطاء، ولو لقيت خطأ بلّغ عنه من زر «بلّغ». أي مفتاح اتصحّح بعد مراجعة بيظهر معلَّم جوه الموقع.</li>
<li>الشرح بالذكاء الاصطناعي وحورس (لو متاح) ممكن يغلط. الكتاب المعتمد والمفتاح المراجَع هما المرجع، وقرارات الدرجات بتفضل على المفتاح. حورس بيتقفل وقت الامتحانات جوه الموقع، لكن الموقع مش بيقدر يمنع استخدام أدوات تانية خارجه، والالتزام بقواعد الامتحان مسؤولية الطالب.</li>
<li>لوحة الشرف والمؤشرات والنقاط للتشجيع والمتابعة الشخصية، مش تقييم رسمي، والأرقام بتتبعت من أجهزة الطلبة.</li>
</ul>

<h2>٣. حسابك</h2>
<p>بتدخل بحساب جوجل بتاعك. إنت مسؤول عن حسابك وعن جهازك وعن اسم العرض اللي بتختاره، ولازم يكون لائق. تقدر تمسح حسابك وبياناتك في أي وقت من الإعدادات.</p>

<h2>٤. الاستخدام المقبول</h2>
<p>ممنوع: استخدام برامج آلية لسحب الأسئلة أو نسخها بالجملة، التلاعب بلوحة الشرف أو إرسال أرقام غير حقيقية، محاولة الوصول لبيانات حساب تاني أو تعطيل الموقع أو اختراقه، استخدام أسماء مسيئة أو انتحال شخصية، أو إعادة نشر محتوى الموقع تجاريًا.</p>

<h2>٥. المحتوى والملكية</h2>
<p>الأسئلة والمواد مصدرها الأقسام العلمية والامتحانات السابقة المذكورة في الموقع وحقوقها لأصحابها، وبتتاح هنا للمذاكرة الشخصية فقط. تصميم الموقع وكوده لمطوّره د. سيف يسري. لو أنت صاحب حق وعايز تعدّل أو تشيل محتوى، بلّغ من زر «بلّغ» وهنتواصل معاك.</p>

<h2>٦. إخلاء المسؤولية</h2>
<p>الموقع بيتقدّم «كما هو» ومن غير أي ضمان إنه يشتغل من غير انقطاع أو أخطاء، ومش مسؤولين عن أي نتيجة دراسية أو درجات أو قرارات اتخذتها بناءً على محتواه، في الحدود اللي يسمح بيها القانون.</p>

<h2>٧. الإيقاف والتعديل</h2>
<p>ممكن نعدّل الموقع أو الميزات أو الشروط دي، أو نوقف حسابًا بيسيء الاستخدام. هنحدّث تاريخ «آخر تحديث» لما الشروط تتغيّر، واستمرارك في الاستخدام يعني موافقتك.</p>

<h2>٨. التواصل</h2>
<p>لأي استفسار أو بلاغ استخدم زر «بلّغ» داخل الموقع.</p>
"""

TERMS_EN = """
<div class="note">Imhotep is a free study website. By using it you agree to these terms. Questions are reviewed but may contain errors, and your approved textbook and curriculum are always the reference.</div>

<h2>1. Acceptance</h2>
<p>By using Imhotep (إمحتب) or signing in with your Google account you agree to these terms and to the <a href="privacy.html">Privacy Policy</a>. If you do not agree, please do not use the site.</p>

<h2>2. Nature of the site</h2>
<ul>
<li>The site is an educational aid for medical students for study and practice. It is not a substitute for lectures or approved textbooks, and it is not a clinical reference, medical advice, or a basis for treatment decisions.</li>
<li>Questions are compiled from the sources credited on the site and their keys are reviewed. Errors may still occur; if you find one, report it with the “Report” button. Keys corrected after review are marked inside the site.</li>
<li>AI explanations and Horus (where available) can be wrong. The approved textbook and the reviewed key are the reference, and scoring stays on the key. Horus is locked during exams inside the site, but the site cannot stop the use of other tools outside it; following exam rules is the student’s responsibility.</li>
<li>The leaderboard, index and points are for encouragement and personal tracking, not an official assessment; the numbers are sent from students’ devices.</li>
</ul>

<h2>3. Your account</h2>
<p>You sign in with your Google account. You are responsible for your account, your device and the display name you choose, which must be appropriate. You can delete your account and data at any time from Settings.</p>

<h2>4. Acceptable use</h2>
<p>You must not: use automated tools to scrape or bulk-copy questions; manipulate the leaderboard or submit fake numbers; try to access another account’s data, disrupt or attack the site; use offensive names or impersonate others; or republish the site’s content commercially.</p>

<h2>5. Content and ownership</h2>
<p>The questions and materials come from the academic departments and past exams credited on the site, and rights belong to their owners; they are made available here for personal study only. The site’s design and code belong to its developer, Dr. Saif Youssry. If you are a rights holder and want content changed or removed, use the “Report” button and we will get in touch.</p>

<h2>6. Disclaimer</h2>
<p>The site is provided “as is”, without any warranty of uninterrupted or error-free operation. To the extent permitted by law, we are not responsible for study outcomes, grades or decisions made based on its content.</p>

<h2>7. Suspension and changes</h2>
<p>We may change the site, its features or these terms, or suspend an account that abuses the site. We will update the “Last updated” date when the terms change, and continuing to use the site means you accept them.</p>

<h2>8. Contact</h2>
<p>For any question or report, use the “Report” button inside the site.</p>
"""

out = sys.argv[1] if len(sys.argv) > 1 else '.'
open(os.path.join(out, 'privacy.html'), 'w', encoding='utf-8').write(page('privacy', 'سياسة الخصوصية', 'Privacy Policy', PRIV_AR, PRIV_EN))
open(os.path.join(out, 'terms.html'), 'w', encoding='utf-8').write(page('terms', 'الشروط والأحكام', 'Terms of Service', TERMS_AR, TERMS_EN))
print('ok')
