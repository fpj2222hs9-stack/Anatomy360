#!/bin/bash
# يشغّل سيرفرات الاختبار لو مش شغّالة: 8770 شجرة، 8771 الزيب المفكوك (/tmp/zt)، 8780 لوحة وهمية، 8790 Supabase وهمي
cd /home/claude/ka/imhotep-site
up(){ curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/$2"; }
up 8770 index.html || (setsid nohup python3 -m http.server 8770 --bind 127.0.0.1 >/tmp/s8770.log 2>&1 &)
[ -d /tmp/zt ] && { up 8771 index.html || (cd /tmp/zt && setsid nohup python3 -m http.server 8771 --bind 127.0.0.1 >/tmp/s8771.log 2>&1 &); }
up 8780 exec || (setsid nohup node tools/leaderboard/harness.js 8780 >/tmp/s8780.log 2>&1 &)
up 8790 __log || (setsid nohup node tools/cloud/mock-supabase.js 8790 >/tmp/s8790.log 2>&1 &)
sleep 1.5
for p in 8770 8780 8790; do printf "$p:"; curl -s -o /dev/null -w "%{http_code} " --max-time 2 "http://127.0.0.1:$p/"; done; echo
