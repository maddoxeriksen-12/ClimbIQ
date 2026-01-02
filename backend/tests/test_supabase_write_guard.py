from __future__ import annotations

import pytest

from app.services.supabase_guard import GuardViolation, SupabaseWriteGuard


class _FakeTable:
    def __init__(self, name: str):
        self.name = name

    # reads
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self, *_args, **_kwargs):
        return type("_Res", (), {"data": []})()

    # writes
    def insert(self, *_args, **_kwargs):
        return self

    def update(self, *_args, **_kwargs):
        return self

    def delete(self, *_args, **_kwargs):
        return self


class _FakeClient:
    def table(self, name: str):
        return _FakeTable(name)


def test_supabase_write_guard_blocks_disallowed_tables() -> None:
    guard = SupabaseWriteGuard(_FakeClient(), allowed_write_tables={"allowed_table"})

    # allowed
    guard.table("allowed_table").insert({"x": 1}).execute()

    # blocked
    with pytest.raises(GuardViolation):
        guard.table("blocked_table").insert({"x": 1}).execute()

    with pytest.raises(GuardViolation):
        guard.table("blocked_table").update({"x": 2}).execute()

    with pytest.raises(GuardViolation):
        guard.table("blocked_table").delete().execute()
