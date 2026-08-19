"""
Date check. The boundary cases are the whole test: same-day, missing date, and
missing model.
"""

from datetime import date

from bench.contamination.datecheck import (
    Basis,
    Exposure,
    ModelDates,
    check_tasks,
    classify,
    eligible_tasks,
    load_registry,
)


class T:
    def __init__(self, task_id, authored_on):
        self.task_id = task_id
        self.authored_on = authored_on


REGISTRY = {
    "lab/model-x": ModelDates(
        model="lab/model-x",
        declared_cutoff=date(2026, 1, 31),
        release_date=date(2026, 6, 15),
        source="test",
        verified=True,
    ),
    "lab/model-no-dates": ModelDates("lab/model-no-dates", None, None, "test", True),
}


def test_task_after_the_boundary_is_safe():
    assert classify(date(2026, 6, 16), date(2026, 6, 15))[0] is Exposure.safe


def test_task_before_the_boundary_is_exposed():
    assert classify(date(2026, 6, 14), date(2026, 6, 15))[0] is Exposure.exposed


def test_a_task_dated_exactly_on_the_boundary_is_exposed():
    """
    LiveCodeBench includes the boundary day in its post-cutoff window
    (`start_date <= contest_date`). This flips it: on the boundary day the
    honest answer to "could the model have seen this" is "possibly", and the
    conservative direction is the one worth being wrong in.
    """
    exposure, margin = classify(date(2026, 6, 15), date(2026, 6, 15))
    assert exposure is Exposure.exposed
    assert margin == 0


def test_an_undated_task_is_never_safe():
    assert classify(None, date(2026, 6, 15))[0] is Exposure.undated


def test_an_unknown_model_makes_everything_undated_not_safe():
    report = check_tasks([T("a", date(2030, 1, 1))], "lab/never-heard-of-it", REGISTRY)
    assert report.undated == 1
    assert report.safe == 0
    assert report.needs_asterisk


def test_a_model_with_no_dates_makes_everything_undated():
    report = check_tasks([T("a", date(2030, 1, 1))], "lab/model-no-dates", REGISTRY)
    assert report.undated == 1


def test_release_basis_is_stricter_than_cutoff_basis():
    tasks = [T("between", date(2026, 3, 1))]
    on_release = check_tasks(tasks, "lab/model-x", REGISTRY, Basis.release)
    on_cutoff = check_tasks(tasks, "lab/model-x", REGISTRY, Basis.cutoff)
    assert on_release.exposed == 1, "release date is the conservative boundary"
    assert on_cutoff.safe == 1


def test_margin_days_is_signed_and_useful():
    report = check_tasks([T("a", date(2026, 6, 20))], "lab/model-x", REGISTRY)
    assert report.per_task[0].margin_days == 5


def test_eligible_tasks_filters_like_live_code_bench_start_date():
    tasks = [
        T("old", date(2025, 1, 1)),
        T("new", date(2026, 12, 1)),
        T("undated", None),
    ]
    eligible = eligible_tasks(tasks, "lab/model-x", REGISTRY)
    assert [t.task_id for t in eligible] == ["new"]


def test_boundary_override_beats_the_registry():
    report = check_tasks(
        [T("a", date(2026, 3, 1))],
        "lab/model-x",
        REGISTRY,
        boundary_override=date(2026, 1, 1),
    )
    assert report.safe == 1
    assert report.verified_source is True


def test_no_asterisk_only_when_everything_is_safe_and_dated():
    clean = check_tasks([T("a", date(2027, 1, 1))], "lab/model-x", REGISTRY)
    assert not clean.needs_asterisk
    dirty = check_tasks(
        [T("a", date(2027, 1, 1)), T("b", None)], "lab/model-x", REGISTRY
    )
    assert dirty.needs_asterisk


def test_shipped_registry_parses_and_is_marked_unverified():
    """
    Every shipped entry must start unverified. A date copied from memory into a
    config file is how a contamination claim quietly becomes false.
    """
    registry = load_registry()
    assert registry, "the registry file must at least parse and hold an example"
    assert all(not m.verified for m in registry.values())
