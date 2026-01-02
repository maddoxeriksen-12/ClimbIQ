from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional, Set


class GuardViolation(RuntimeError):
    pass


@dataclass(frozen=True)
class SupabaseWriteGuard:
    """Lightweight guard to enforce write boundaries.

    We still use the real Supabase client, but block writes outside an allowlist
    of tables. This prevents accidental joins/writes that would violate the
    sim/real separation.
    """

    client: Any
    allowed_write_tables: Set[str]

    def table(self, name: str) -> Any:
        tbl = self.client.table(name)
        return _GuardedTable(tbl, name=name, allow=self.allowed_write_tables)

    def rpc(self, fn_name: str, params: Optional[dict] = None) -> Any:
        # RPC can write; keep it blocked unless explicitly allowed later.
        raise GuardViolation(f"RPC '{fn_name}' is blocked by SupabaseWriteGuard")


class _GuardedTable:
    def __init__(self, inner: Any, *, name: str, allow: Set[str]):
        self._inner = inner
        self._name = name
        self._allow = allow

    def _check_write(self) -> None:
        if self._name not in self._allow:
            raise GuardViolation(
                f"Write to table '{self._name}' blocked. Allowed: {sorted(self._allow)}"
            )

    # Passthrough read/query builders
    def select(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.select(*args, **kwargs)

    def eq(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.eq(*args, **kwargs)

    def in_(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.in_(*args, **kwargs)

    def order(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.order(*args, **kwargs)

    def limit(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.limit(*args, **kwargs)

    def ilike(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.ilike(*args, **kwargs)

    def contains(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.contains(*args, **kwargs)

    def not_(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.not_(*args, **kwargs)

    def single(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.single(*args, **kwargs)

    def execute(self, *args: Any, **kwargs: Any) -> Any:
        return self._inner.execute(*args, **kwargs)

    # Writes
    def insert(self, *args: Any, **kwargs: Any) -> Any:
        self._check_write()
        return self._inner.insert(*args, **kwargs)

    def upsert(self, *args: Any, **kwargs: Any) -> Any:
        self._check_write()
        return self._inner.upsert(*args, **kwargs)

    def update(self, *args: Any, **kwargs: Any) -> Any:
        self._check_write()
        return self._inner.update(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> Any:
        self._check_write()
        return self._inner.delete(*args, **kwargs)
