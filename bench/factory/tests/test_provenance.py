"""
Provenance policy. Each test is one way a record can fail to state where it came
from, and the assertion is always that it is *dropped with a named reason*
rather than admitted with a guess.
"""

from datetime import date, timedelta

from bench.factory.provenance import PERMISSIVE, check
from bench.factory.records import Provenance, RawDocument, SourceKind

TODAY = date(2026, 8, 19)
CODE = 'local Players = game:GetService("Players")\nreturn Players\n'


def prov(**kw):
    base = dict(
        source_id="github:org/repo",
        source_kind=SourceKind.github,
        licence="MIT",
        retrieved_on=TODAY,
        url="https://github.com/org/repo",
        revision="abc123",
        licence_evidence="spdx-file",
    )
    base.update(kw)
    return Provenance(**base)


def doc(text=CODE, provenance=None):
    return RawDocument(doc_id="d1", text=text, provenance=provenance)


def test_a_complete_record_passes():
    assert check(doc(provenance=prov()), TODAY).ok


def test_no_provenance_block_at_all_is_dropped():
    verdict = check(doc(provenance=None), TODAY)
    assert not verdict.ok and verdict.reason == "provenance.missing"


def test_an_assumed_licence_is_dropped():
    """The core rule: unstated is not the same as permissive."""
    verdict = check(doc(provenance=prov(licence_evidence="assumed")), TODAY)
    assert not verdict.ok and verdict.reason == "provenance.licence_assumed"


def test_copyleft_is_refused_by_name_not_lumped_with_unknown():
    verdict = check(doc(provenance=prov(licence="GPL-3.0-only")), TODAY)
    assert verdict.reason == "provenance.licence_not_permitted"
    unknown = check(doc(provenance=prov(licence="WTFPL")), TODAY)
    assert unknown.reason == "provenance.licence_unknown"


def test_a_gpl_header_inside_an_mit_declared_file_is_dropped():
    """
    Repo-level licence metadata is routinely wrong for vendored files, and
    trusting it is how copyleft ends up in a corpus that believes it is clean.
    """
    text = "-- GNU GENERAL PUBLIC LICENSE Version 3\n" + CODE
    verdict = check(doc(text=text, provenance=prov()), TODAY)
    assert verdict.reason == "provenance.licence_text_conflict"


def test_all_rights_reserved_is_a_conflict():
    text = "-- Copyright 2026 Someone. All Rights Reserved.\n" + CODE
    assert check(doc(text=text, provenance=prov()), TODAY).reason == (
        "provenance.licence_text_conflict"
    )


def test_a_licence_mention_deep_in_a_file_does_not_drop_it():
    """The header scan is bounded so a string constant does not cost a record."""
    text = CODE + "\n" + ("-- filler\n" * 800) + '\nlocal s = "GNU General Public License"\n'
    assert check(doc(text=text, provenance=prov()), TODAY).ok


def test_a_future_retrieval_date_is_dropped():
    verdict = check(doc(provenance=prov(retrieved_on=TODAY + timedelta(days=1))), TODAY)
    assert verdict.reason == "provenance.retrieval_date_in_future"


def test_an_external_source_needs_a_url():
    assert check(doc(provenance=prov(url=None)), TODAY).reason == "provenance.no_url"
    assert check(doc(provenance=prov(url="not a url")), TODAY).reason == (
        "provenance.malformed_url"
    )


def test_synthetic_material_legitimately_has_no_url():
    verdict = check(
        doc(
            provenance=prov(
                source_kind=SourceKind.synthetic,
                url=None,
                revision=None,
                licence="PROPRIETARY-OWNED",
                licence_evidence="repo-metadata",
            )
        ),
        TODAY,
    )
    assert verdict.ok


def test_an_owned_claim_on_an_external_source_is_refused():
    verdict = check(
        doc(provenance=prov(licence="PROPRIETARY-OWNED", licence_evidence="repo-metadata")),
        TODAY,
    )
    assert verdict.reason == "provenance.owned_claim_on_external_source"


def test_a_missing_revision_warns_by_default_and_drops_on_request():
    lenient = check(doc(provenance=prov(revision=None)), TODAY)
    assert lenient.ok and "provenance.no_revision" in lenient.warnings
    strict = check(doc(provenance=prov(revision=None)), TODAY, require_revision=True)
    assert strict.reason == "provenance.no_revision"


def test_the_allow_list_is_permissive_only():
    for copyleft in ("GPL-3.0-only", "AGPL-3.0-only", "MPL-2.0", "CC-BY-SA-4.0"):
        assert copyleft not in PERMISSIVE
