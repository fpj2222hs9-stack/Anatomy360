"""LLM providers behind one tiny interface:  generate(system, messages, schema=None, meta=None) -> (text, usage)
messages = [{'role': 'user'|'model', 'text': ...}].  Keys are read from environment variables only (config.json holds the variable NAME).
Real providers use urllib (no dependencies). The mock provider needs no network and drives the offline tests."""
import json, os, re, time, urllib.error, urllib.request

from . import prompts


class RateLimited(Exception):
    """HTTP 429: this provider is finished for its day."""


class ProviderError(Exception):
    def __init__(self, msg, fatal=False):
        Exception.__init__(self, msg)
        self.fatal = fatal


def _post(url, headers, body, timeout=120, retries=2):
    data = json.dumps(body).encode('utf-8')
    last = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=dict(headers, **{'Content-Type': 'application/json'}), method='POST')
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            txt = ''
            try:
                txt = e.read().decode('utf-8', 'replace')[:300]
            except Exception:
                pass
            if e.code == 429:
                raise RateLimited(txt)
            if e.code in (400, 401, 403, 404):
                raise ProviderError('HTTP %d: %s' % (e.code, txt), fatal=True)
            last = ProviderError('HTTP %d: %s' % (e.code, txt))
        except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as e:
            last = ProviderError('network: %s' % e)
        time.sleep(2 + 3 * attempt)
    raise last


class Gemini:
    """generateContent REST (Gemini and Gemma models). The key goes in a header, never in the URL, so it cannot leak into logs."""
    def __init__(self, name, cfg, temperature=0.2):
        self.name, self.cfg, self.temperature = name, cfg, temperature
        self.model = cfg['model']
        self.key = os.environ.get(cfg.get('key_env', 'GEMINI_API_KEY'), '')

    def ready(self):
        return bool(self.key)

    def _url(self):
        return 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % self.model

    def _body(self, system, messages, schema):
        gc = {'temperature': self.temperature}
        if self.cfg.get('json_mode', True):
            gc['responseMimeType'] = 'application/json'
        if self.cfg.get('structured') and schema:
            gc['responseJsonSchema'] = schema
        return {'systemInstruction': {'parts': [{'text': system}]},
                'contents': [{'role': 'user' if m['role'] == 'user' else 'model', 'parts': [{'text': m['text']}]} for m in messages],
                'generationConfig': gc}

    @staticmethod
    def _text(r):
        c = (r.get('candidates') or [{}])[0]
        parts = (c.get('content') or {}).get('parts') or []
        t = ''.join(p.get('text', '') for p in parts if not p.get('thought'))
        if not t:
            raise ProviderError('empty reply (finish: %s, feedback: %s)' % (c.get('finishReason'), r.get('promptFeedback')))
        return t

    def generate(self, system, messages, schema=None, meta=None):
        r = _post(self._url(), {'x-goog-api-key': self.key}, self._body(system, messages, schema))
        u = r.get('usageMetadata') or {}
        return self._text(r), {'in': u.get('promptTokenCount', 0), 'out': u.get('candidatesTokenCount', 0), 'total': u.get('totalTokenCount', 0)}

    def generate_with_file_search(self, system, user, store):
        """used only by retrieval.kind = file_search (untested offline)."""
        body = {'systemInstruction': {'parts': [{'text': system}]}, 'contents': [{'role': 'user', 'parts': [{'text': user}]}],
                'tools': [{'file_search': {'file_search_store_names': [store]}}], 'generationConfig': {'temperature': 0}}
        r = _post(self._url(), {'x-goog-api-key': self.key}, body)
        return self._text(r), r


class OpenAICompat:
    """Groq, OpenRouter, Cloudflare Workers AI (OpenAI-compatible /chat/completions)."""
    def __init__(self, name, cfg, temperature=0.2):
        self.name, self.cfg, self.temperature = name, cfg, temperature
        self.model = cfg['model']
        self.key = os.environ.get(cfg.get('key_env', ''), '')

    def ready(self):
        return bool(self.key) and 'ACCOUNT_ID' not in self.cfg.get('base_url', '')

    def generate(self, system, messages, schema=None, meta=None):
        msgs = [{'role': 'system', 'content': system}] + [{'role': 'user' if m['role'] == 'user' else 'assistant', 'content': m['text']} for m in messages]
        body = {'model': self.model, 'messages': msgs, 'temperature': self.temperature}
        if self.cfg.get('json_mode', True):
            body['response_format'] = {'type': 'json_object'}
        r = _post(self.cfg['base_url'].rstrip('/') + '/chat/completions', {'Authorization': 'Bearer ' + self.key}, body)
        try:
            t = r['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            raise ProviderError('unexpected reply shape')
        u = r.get('usage') or {}
        return t, {'in': u.get('prompt_tokens', 0), 'out': u.get('completion_tokens', 0), 'total': u.get('total_tokens', 0)}


# ---------------------------------------------------------------- mock (tests / dry runs)
class Mock:
    """Deterministic fake model. `scenario(meta) -> name` picks what it answers:
    ok | conflict | insufficient | english_first | badquote | badheading | garbage | nokey_ok.  Needs meta from the pipeline (q, mode, blocks, retry)."""
    def __init__(self, name='mock', cfg=None, scenario=None):
        self.name, self.cfg = name, cfg or {}
        self.model = 'mock'
        self.scenario = scenario or (lambda meta: 'ok')
        self.calls = []

    def ready(self):
        return True

    def generate(self, system, messages, schema=None, meta=None):
        meta = meta or {}
        sc = self.scenario(meta)
        self.calls.append({'scenario': sc, 'mode': meta.get('mode'), 'retry': meta.get('retry'), 'qid': (meta.get('q') or {}).get('id')})
        q, mode, blocks = meta['q'], meta['mode'], meta.get('blocks') or []
        opts = [o['o'].upper() for o in q['opts'] if o['t']]
        keys = [k.upper() for k in q['keys']]
        if sc == 'garbage':
            return 'sorry, I cannot do that {', {'in': 10, 'out': 5, 'total': 15}
        if sc == 'insufficient':
            out = {'verification_status': 'insufficient_source', 'correct_answer': '', 'summary': 'المقاطع اللي اتبعتت مش بتحسم الإجابة، فمش هقدر أأكد حاجة منها.',
                   'correct_explanation': '', 'option_analysis': [], 'source_sections': []}
            return json.dumps(out, ensure_ascii=False), {'in': 100, 'out': 40, 'total': 140}
        book = [k for k in keys]
        if sc == 'conflict':
            book = [next(o for o in opts if o not in keys)]
        elif not book:
            book = [opts[0]]
        st = 'knowledge_only' if mode == 'knowledge' else ('answer_conflict' if sc == 'conflict' else 'verified')
        if sc == 'english_first' and not meta.get('retry'):
            summary = 'The correct answer is %s because the book says so.' % book[0]
        elif st == 'knowledge_only':
            summary = prompts.DISCLOSURE + ' الإجابة الأقرب هي %s.' % book[0]
        elif st == 'answer_conflict':
            summary = 'هنا إجابة الموقع %s بتتعارض مع الكتاب، والكتاب بيقول %s، والشرح تحت ماشي على الكتاب.' % (keys[0], book[0])
        else:
            summary = 'الفكرة إن الإجابة %s هي الصح حسب الكتاب.' % book[0]
        oa = []
        for L in opts:
            if L in book:
                s, e = 'correct', 'ببساطة ده الاختيار اللي الكتاب بيدعمه.'
            elif st == 'answer_conflict' and L in keys:
                s, e = 'conflict', 'ده مفتاح الموقع لكن الكتاب بيقول غير كده.'
            else:
                s, e = 'incorrect', 'هنا الاختيار ده مش مطابق للي مكتوب في المصدر.'
            oa.append({'option': L, 'status': s, 'explanation': e})
        ss = []
        if st != 'knowledge_only' and blocks:
            first = blocks[0]['text'].split('\n')
            heading = first[0]
            quote = ' '.join(' '.join(first[1:]).split()[:12]) or heading
            if sc == 'badquote':
                quote = 'this sentence is not in the block at all'
            if sc == 'badheading':
                heading = 'An invented heading'
            ss = [{'citation_index': 1, 'heading': heading, 'quote': quote}]
        out = {'verification_status': st, 'correct_answer': ','.join(book), 'summary': summary,
               'correct_explanation': 'ببساطة الكتاب بيقول إن %s هو الصح، عشان كده باقي الاختيارات مش مناسبة.' % book[0],
               'option_analysis': oa, 'source_sections': ss}
        return json.dumps(out, ensure_ascii=False), {'in': 300, 'out': 200, 'total': 500}


def build(name, cfg, temperature=0.2):
    kind = cfg['kind']
    if kind == 'gemini':
        return Gemini(name, cfg, temperature)
    if kind == 'openai_compat':
        return OpenAICompat(name, cfg, temperature)
    if kind == 'mock':
        return Mock(name, cfg)
    raise ValueError('unknown provider kind: %s' % kind)
