/* Imhotep · إمحتب — إعداد حفظ التقدّم على حساب جوجل (Supabase).
   url  : رابط مشروع Supabase (Anatomy-360).
   anon : المفتاح العام (sb_publishable_…). عام بطبيعته ومحميّ بصلاحيات الصفوف (RLS في tools/cloud/supabase.sql).
          ⚠️ ممنوع تحط هنا sb_secret_ أو service_role أو أي مفتاح سري: الريبو عام.
   on       : false = كل حاجة مقفولة ومفيش أي طلب بيتبعت.
   pilot    : true = الميزة مقفولة للطلبة وبتتفتح بس على متصفح فتح الموقع مرة بـ ?cloud=1 (وبيتقفل بـ ?cloud=0). خلّيها false لما تخلّص التجربة.
   required : true = الدخول بجوجل إجباري. بيشتغل بس لو جوجل مفعّل فعلًا في Supabase وفي اتصال، غير كده الموقع بيفتح عادي (مفيش طالب يتقفل برّه).
   redirect (اختياري): رابط الموقع اللي جوجل يرجّع عليه بعد الدخول لو مختلف عن الرابط الحالي (لازم يكون مضاف في Supabase ← Authentication ← URL Configuration).
   خطوات التركيب كاملة في tools/cloud/README.md. */
window.IM.CLOUD = {
  on: true,
  pilot: false,
  required: true,
  url: 'https://uaxreejcuantlwtuadtv.supabase.co',
  anon: 'sb_publishable_3CwrrLq6eB1staS_EI_IMQ_uD0AJh74',
  redirect: ''
};
