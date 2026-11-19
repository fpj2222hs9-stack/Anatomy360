"""Daily quota ledger. Free tiers are small and reset on their own clock (Gemini: midnight Pacific), so every provider has its own day.
The batch stops when the chain is out of budget and the next run (tomorrow, or the scheduled GitHub Action) continues where it stopped."""
import datetime, os, time

from .util import read_json, write_json

try:
    from zoneinfo import ZoneInfo
except ImportError:                                           # pragma: no cover (py < 3.9)
    ZoneInfo = None


class Budget:
    def __init__(self, path, providers_cfg, now=None, persist=True):
        self.path = path
        self.cfg = providers_cfg
        self.persist = persist
        self.now = now or (lambda: datetime.datetime.now(datetime.timezone.utc))
        self.data = (read_json(path, {}) or {}) if persist else {}
        self.data.setdefault('providers', {})
        self._last = {}

    # ---- the provider's own "today"
    def day(self, name):
        tz = (self.cfg.get(name) or {}).get('tz') or 'UTC'
        n = self.now()
        if ZoneInfo is not None:
            try:
                n = n.astimezone(ZoneInfo(tz))
            except Exception:
                pass
        return n.strftime('%Y-%m-%d')

    def _st(self, name):
        d = self.day(name)
        st = self.data['providers'].get(name)
        if not st or st.get('day') != d:
            st = {'day': d, 'calls': 0, 'tokens': 0, 'blocked': False}
            self.data['providers'][name] = st
        return st

    def can(self, name):
        st, c = self._st(name), self.cfg.get(name) or {}
        if st['blocked']:
            return False
        if st['calls'] >= int(c.get('rpd', 0)):
            return False
        if c.get('tpd') and st['tokens'] >= int(c['tpd']):
            return False
        return True

    def charge(self, name, tokens=0):
        st = self._st(name)
        st['calls'] += 1
        st['tokens'] += int(tokens or 0)
        self.save()

    def block(self, name):
        """the provider answered 429: it is done for its day."""
        self._st(name)['blocked'] = True
        self.save()

    def pace(self, name, sleep=time.sleep):
        """keep under the per-minute limit: at least 60/rpm seconds between two calls of the same provider."""
        rpm = int((self.cfg.get(name) or {}).get('rpm') or 0)
        if rpm <= 0:
            return
        gap = 60.0 / rpm
        last = self._last.get(name)
        if last is not None:
            wait = gap - (time.monotonic() - last)
            if wait > 0:
                sleep(wait)
        self._last[name] = time.monotonic()

    def left(self, name):
        st, c = self._st(name), self.cfg.get(name) or {}
        return max(0, int(c.get('rpd', 0)) - st['calls']) if not st['blocked'] else 0

    def save(self):
        if self.persist:
            write_json(self.path, self.data)

    def summary(self):
        out = {}
        for name in self.cfg:
            st = self._st(name)
            out[name] = {'day': st['day'], 'calls': st['calls'], 'rpd': self.cfg[name].get('rpd'), 'tokens': st['tokens'], 'blocked': st['blocked']}
        return out
