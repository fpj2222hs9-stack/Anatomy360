# Imhotep English dictionary — spec for translators

Imhotep is an Egyptian med-student Q&A site (Arabic, written in Egyptian colloquial). We are adding an English UI.
The app builds its DOM in JavaScript. At runtime a translator (`js/i18n.js`) looks at **every text node / title / aria-label / placeholder / alt**
that contains Arabic and replaces it with English from a dictionary. Your job: write that dictionary for the files you were given.
**You never edit source files.** You only write one JSON file: `tools/i18n/en/<group>.json`.

## How keys work (read carefully)
* A key is the **exact Arabic text that ends up in ONE DOM text node (or one attribute value)**, whitespace collapsed to single spaces, trimmed.
  `h('button',{},'ابدأ')` → key `"ابدأ"`. `h('p',{text:'أجبت '+n+' سؤال'})` → rendered text is e.g. "أجبت 5 سؤال" → key is a **template**: `"أجبت {} سؤال"`.
* `{}` in a key = a runtime value (number, name, date, or more Arabic text). In the English value refer to them as `{1}`, `{2}`… in order of appearance in the KEY
  (you may reorder them in English: `"{2} of {1}"`). Number of `{}` in the key must equal the number of distinct `{n}` in the value.
  Values that are themselves Arabic (subject names, stage names…) are translated automatically by the same dictionary, so don't worry about them.
* Plurals: for a counted noun write `{1?question|questions}` — shows the first form when value 1 is the number 1, else the second form.
  e.g. key `"{} سؤال"` → `"{1} {1?question|questions}"`. Zero → plural form ("0 questions").
* A literal containing HTML (`html:'…<b>x</b>…'` or `innerHTML`) is rendered as several text nodes: write **one key per text fragment between the tags**,
  not for the whole literal. (`'اضغط <b>ابدأ</b> بعد كده'` → keys `"اضغط"`, `"ابدأ"`, `"بعد كده"`.) Keep each fragment independently translatable and natural.
* When code concatenates pieces into one text node (`'مؤشرك '+L.idx+' من 100'`), write ONE template for the whole text node. The checker accepts each Arabic
  literal piece as covered when it is a fragment of a template key you wrote.
* When a literal is built from several nodes that always appear side by side (`h('span',{},'فصول: '),h('b',..)`), key each node separately.
* Text with the same Arabic in several places gets ONE entry (same English everywhere). If the same Arabic needs different English in different spots, prefer the more
  general translation; if it truly can't be shared, make the Arabic key differ by context only if the source differs. Don't fight it.
* Titles / tooltips / aria-labels / placeholders use the same dictionary (so a tooltip and a button with identical Arabic share the English).
* Long paragraphs: translate the whole literal as one key (that's what the DOM node will contain).
* Keys must be copied **character-for-character** from the source (tashkeel, «», …, ـ, ي vs ى, أ vs ا, ؟ ، all matter). Use `python3 tools/i18n/i18n_tool.py extract <file>` to see the exact literals
  (it prints the decoded string, with `\n` as newline; `${}` template-literal holes already shown as `{}`). Copy keys from there.

## What NOT to translate → put in `"__skip__": [ ... ]` (exact literal as printed by `extract`)
* Strings that are **sent to a server / AI model** as prompts or data, matched by regex/`===` logic against Arabic input, used as data keys or ids, or stored in data the user sees only in Arabic by design.
  (If a string is BOTH logic and visible text, translate it — translation happens on the DOM only, logic is unaffected.)
* Pure punctuation/symbol strings that merely contain an Arabic comma `،` or `؟`. Strings that are the language name «العربية».
* Anything you are unsure about: put it in the dictionary rather than skip, unless it is clearly non-UI.

## Style
* Natural, short, friendly English for medical students (the original is warm Egyptian colloquial, not formal). Keep the voice, drop the dialect.
  UI labels: Title Case for headings/buttons is fine ("Start a scroll"), sentence case for sentences. No trailing differences in punctuation: if the Arabic ends in `…` or `:` or `.`, keep the same ending.
* Keep emoji, symbols, numbers, `·`, `/`, `%`, `XP`, Latin words (Horus, Imhotep, Supabase, Google, WhatsApp…) exactly as they are.
* Arabic-Indic digits don't occur; numbers are Latin already.
* Don't add information, don't drop warnings/legal-ish wording; keep the same level of certainty.
* Keep lengths reasonable (buttons/chips must stay short: they sit in tight layouts).
* Gender/“يا دكتور” style address → neutral “you”.

## Glossary (use these exactly)
| Arabic | English |
|---|---|
| إمحتب | Imhotep (brand, never translate) |
| حورس | Horus (the AI tutor; never translate) |
| الرئيسية | Home |
| التدريب | Practice |
| ورشة الألواح | Tablets Workshop |
| المكتبة | Library |
| ميزان الأداء | Performance Scale (short: "Scale") |
| البردية | Papyrus |
| لفافة | scroll (one practice / exam round); اللفافة الشاملة → the Comprehensive Scroll |
| الإعدادات | Settings |
| عن إمحتب | About Imhotep |
| مؤشر إمحتب / المؤشر | Imhotep Index / the Index |
| مثبّت / تثبيت | secured / securing (a question answered correctly and kept) |
| الشروق / يوم شروق | Sunrise / Sunrise day (daily streak) |
| الدقة | Accuracy · الانتظام: Consistency · التحسّن: Improvement · الإنجازات: Achievements |
| خرطوشة / الخراطيش | cartouche / cartouches (rank badges) |
| مراحل: الكاتب · الوزير · الوزير الأعلى · فرعون · إمحتب · الطبيب الأول | Scribe · Vizier · High Vizier · Pharaoh · Imhotep · The First Physician |
| المفتاح / مفتاح الإجابة | answer key |
| الملزمة | the handout (the department's printed question booklet) |
| معتمد · اتصحّح · تحت الميزان · ملغي · قيد المراجعة · بدون مفتاح | Verified · Corrected · Under the Scale · Cancelled · Under review · No key |
| بعد المراجعة | After review |
| التصحيحات / تصحيحات المفاتيح | Corrections / Key corrections |
| التحديثات | Updates |
| التقييم الأسبوعي | Weekly Assessment |
| التشريح · الهستولوجيا · الكيمياء الحيوية · وظائف الأعضاء | Anatomy · Histology · Biochemistry · Physiology |
| كل المواد | All subjects |
| لوحة الشرف / لوحة المتصدرين | Leaderboard / Honor Board |
| مصدر الأسئلة | Question source |
| د. (before a name) | Dr. |
| ذاكر / راجع | Study / Review |
| غلطة / أغلاط | mistake / mistakes |
| سؤال / أسئلة | question / questions |

Names: سيف يسري → Saif Youssry · د. أحمد جلال → Dr. Ahmed Galal · د. هشام عصمت → Dr. Hesham Esmat · د. أحمد زهرة → Dr. Ahmed Zahra · د. محمد ماهر → Dr. Mohamed Maher.
Terms not in the glossary: read the surrounding code to understand them, pick a sensible English term, and keep it identical everywhere in your file.

## Workflow
1. `cd /home/claude/ka/imhotep-site`; for each of your files run `python3 tools/i18n/i18n_tool.py extract <file>`; read the source around any literal you don't understand.
2. Write `tools/i18n/en/<group>.json` (UTF-8, `ensure_ascii` off, valid JSON; escape `"` inside strings, no trailing commas). Do it in several `Write`s/edits if big — build the file in pieces (e.g. a Python script that merges dict literals) if that's easier, but the final file must be plain JSON.
3. Run `python3 tools/i18n/i18n_tool.py check tools/i18n/en/<group>.json <your files…>` and fix until it prints **0 literals not covered, 0 problems**.
   (`ARABIC-IN-VALUE` = your English contains Arabic; `BAD-PLACEHOLDERS` = `{n}` mismatch.)
4. Final reply (short!): the count of entries, any terms you chose that are NOT in the glossary (term → English), and anything in the source that looked like user-visible Arabic produced in a way the dictionary can't catch (e.g. text built from a lookup table or created via `String.fromCharCode`, Arabic inside CSS `content:`).
Do not write any other file. Do not run the site, tests, git, or network calls.
