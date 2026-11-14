"""The shared cache: one JSON file per subject in <site>/ai/ (served as static files, so every student reads the same explanation for free).
An entry is valid only while its hash equals the current question hash (text + options + the key the site uses)."""
import datetime, os

from .util import read_json, write_json


class Cache:
    def __init__(self, directory):
        self.dir = directory
        self.files = {}

    def path(self, sid):
        return os.path.join(self.dir, sid + '.json')

    def _file(self, sid):
        if sid not in self.files:
            self.files[sid] = read_json(self.path(sid), None) or {'v': 1, 'sid': sid, 'items': {}}
            self.files[sid].setdefault('items', {})
        return self.files[sid]

    def get(self, sid, qid):
        return self._file(sid)['items'].get(qid)

    def put(self, sid, entry):
        self._file(sid)['items'][entry['id']] = entry

    def drop(self, sid, qid):
        self._file(sid)['items'].pop(qid, None)

    def save(self, sid):
        f = self._file(sid)
        f['items'] = {k: f['items'][k] for k in sorted(f['items'])}
        write_json(self.path(sid), f, compact=True)

    def current(self, q, pv=None):
        """-> 'none' | 'stale' (question changed since it was generated) | 'old-prompt' | 'ok'"""
        e = self.get(q['sid'], q['id'])
        if not e:
            return 'none'
        if e.get('h') != q['h']:
            return 'stale'
        if pv and e.get('pv') != pv:
            return 'old-prompt'
        return 'ok'

    def write_manifest(self, questions, pv):
        """ai/manifest.json: what is covered (cheap to read, shows progress, never needed by the students' pages)."""
        subs = {}
        by_sid = {}
        for q in questions:
            by_sid.setdefault(q['sid'], []).append(q)
        for sid, qs in sorted(by_sid.items()):
            f = self._file(sid)
            st = {'verified': 0, 'answer_conflict': 0, 'knowledge_only': 0}
            ok = stale = 0
            ids = {q['id']: q for q in qs}
            for qid, e in f['items'].items():
                q = ids.get(qid)
                if q is None or e.get('h') != q['h']:
                    stale += 1
                    continue
                ok += 1
                st[e['st']] = st.get(e['st'], 0) + 1
            subs[sid] = {'questions': len(qs), 'explained': ok, 'stale': stale, 'by_status': st}
        m = {'v': 1, 'prompt_version': pv, 'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d'), 'subjects': subs}
        write_json(os.path.join(self.dir, 'manifest.json'), m)
        return m
