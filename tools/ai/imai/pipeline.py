"""One question -> one cached explanation.
  focused retrieval -> grounded explanation  (verified / answer_conflict)  -- the common case: ONE model call
      \\ insufficient_source -> expanded retrieval -> grounded explanation
          \\ still nothing -> knowledge-only fallback (disclosed in the text, never cited)
Every answer is validated in code; a language violation gets the owner's retry prompt (06) once.
When the website key and the book disagree, the book wins (answer_conflict) and the conflict is logged for the owner."""
import datetime

from . import prompts, providers, validate
from .util import append_jsonl, q_hash


class BudgetExhausted(Exception):
    pass


class Outcome:
    def __init__(self, entry=None, reason='', calls=0, log=None):
        self.entry, self.reason, self.calls, self.log = entry, reason, calls, log or []


class Pipeline:
    def __init__(self, cfg, budget, provs, chain, retriever_for, questions_by_id, conflicts_path=None, sleep=None, now=None):
        self.cfg, self.budget, self.provs, self.chain = cfg, budget, provs, chain
        self.retriever_for = retriever_for
        self.by_id = questions_by_id
        self.conflicts_path = conflicts_path
        self.pv = prompts.prompt_version()
        self.sleep = sleep
        self.pcfg = cfg.get('pipeline', {})
        self.dead = set()                                    # providers that failed fatally this run (bad key / model name)

    # ------------------------------------------------------------ LLM call with quota + fallback across providers
    def _call(self, system, messages, meta, calls):
        for name in self.chain:
            if name in self.dead or not self.budget.can(name):
                continue
            p = self.provs[name]
            self.budget.pace(name, **({'sleep': self.sleep} if self.sleep else {}))
            try:
                text, usage = p.generate(system, messages, prompts.schema(), meta)
            except providers.RateLimited:
                self.budget.block(name)
                continue
            except providers.ProviderError as e:
                if e.fatal:
                    self.dead.add(name)
                meta.setdefault('_errors', []).append('%s: %s' % (name, e))
                continue
            self.budget.charge(name, (usage or {}).get('total') or 0)
            calls.append(name)
            return text, name
        raise BudgetExhausted('no provider in the chain has quota left today')

    # ------------------------------------------------------------ one tutor stage with validation and one repair
    def _tutor(self, q, blocks, mode, ctx, calls, log):
        system = prompts.tutor_system(mode)
        first = prompts.tutor_user(q, blocks, mode, **ctx)
        msgs = [{'role': 'user', 'text': first}]
        repairs = int(self.pcfg.get('max_repairs_per_stage', 1))
        meta = {'q': q, 'mode': mode, 'blocks': blocks, 'retry': False}
        for attempt in range(repairs + 1):
            text, name = self._call(system, msgs, meta, calls)
            obj = validate.parse_json(text)
            errors, lang, clean = validate.validate(obj, q, mode, blocks)
            if not errors and not lang and clean:
                clean['_by'] = self.provs[name].model
                return clean
            log.append({'stage': mode, 'attempt': attempt, 'errors': errors, 'lang': lang})
            if attempt >= repairs:
                break
            msgs = msgs + [{'role': 'model', 'text': text or ''}]
            if lang and not errors:
                msgs.append({'role': 'user', 'text': prompts.retry_message()})                    # the owner's prompt 06, verbatim
            else:
                msgs.append({'role': 'user', 'text': (prompts.retry_message() + '\n' if lang else '') +
                             'The previous JSON failed validation: ' + '; '.join(errors + lang) + '. Return the complete corrected JSON now, following the schema exactly.'})
            meta = dict(meta, retry=True)
        return None

    # ------------------------------------------------------------ public
    def context(self, q):
        cs = (self.cfg.get('subjects') or {}).get(q['sid'], {})
        ch = q['part']['en'] + ((' - ' + q['sec']['en']) if q['sec'].get('en') else '')
        case = ''
        if q.get('caseOf'):
            c = self.by_id.get(q['caseOf'])
            case = c['stem'] if c else ''
        return {'cfg_subject': cs, 'subject_name': q['subject'], 'chapter_name': ch, 'case_context': case}

    def explain(self, q):
        calls, log = [], []
        ctx = self.context(q)
        seen = set()
        retr = self.retriever_for(q['sid'])
        floor = float((self.cfg.get('retrieval') or {}).get('min_top_score', 4.0))
        res = None
        if retr is not None and retr.available():
            for attempt in ('focused', 'expanded'):
                blocks = retr.focused(q) if attempt == 'focused' else retr.expanded(q)
                fresh = [b for b in blocks if b['id'] not in seen]
                if not blocks or blocks[0]['score'] < floor or (attempt == 'expanded' and not fresh):
                    log.append({'stage': attempt, 'skipped': 'no new evidence above the floor'})
                    continue
                seen.update(b['id'] for b in blocks)
                res = self._tutor(q, blocks, 'grounded', ctx, calls, log)
                if res and res['st'] in ('verified', 'answer_conflict'):
                    return self._finish(q, res, calls, log)
                res = None
        if self.pcfg.get('allow_knowledge_fallback', True):
            res = self._tutor(q, [], 'knowledge', ctx, calls, log)
            if res:
                return self._finish(q, res, calls, log)
        return Outcome(None, 'unresolved', len(calls), log)

    def _finish(self, q, res, calls, log):
        entry = {'id': q['id'], 'h': q_hash(q), 'pv': self.pv, 'st': res['st'], 'ca': res['ca'], 'sm': res['sm'], 'ce': res['ce'], 'oa': res['oa'],
                 'ss': res['ss'], 'md': res.pop('_by', ''), 'ts': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d'), 'n': len(calls)}
        if res['st'] == 'answer_conflict' and self.conflicts_path:
            append_jsonl(self.conflicts_path, {'id': q['id'], 'sid': q['sid'], 'website_key': q['keys'], 'book_answer': res['ca'], 'summary': res['sm'],
                                              'sources': res['ss'], 'reviewed': bool(q.get('fix') or q.get('review')), 'ts': entry['ts']})
        return Outcome(entry, res['st'], len(calls), log)
