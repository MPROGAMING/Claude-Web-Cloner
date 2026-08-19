"""
Loading and emitting. The assertions worth having here are the guards: a source
that declares nothing produces droppable documents rather than confident ones,
and a corpus cannot be written into this public repository.
"""

import json
import os

import pytest

from bench.factory.provenance import check as provenance_check
from bench.factory.records import SourceKind, TrainingRecord
from bench.factory.sinks import guard_output_path, write_jsonl
from bench.factory.sources import SourceSpec, load, load_source_manifest

SPEC = {
    "source_id": "github:org/repo",
    "kind": "github",
    "url": "https://github.com/org/repo",
    "revision": "abc123",
    "licence": "MIT",
    "licence_evidence": "spdx-file",
    "retrieved_on": "2026-08-19",
    "loader": "directory",
    "path": "",
}


def test_directory_loader_stamps_provenance_on_every_document(tmp_path):
    root = tmp_path / "src"
    (root / "nested").mkdir(parents=True)
    (root / "a.luau").write_text("local a = 1\nreturn a\n")
    (root / "nested" / "b.lua").write_text("local b = 2\nreturn b\n")
    (root / "readme.md").write_text("not code")
    spec = SourceSpec.from_json(dict(SPEC, path=str(root)))
    docs = list(load(spec))
    assert len(docs) == 2, "only Luau sources are ingested"
    for d in docs:
        assert d.provenance.licence == "MIT"
        assert d.provenance.source_kind is SourceKind.github
        assert d.provenance.retrieved_on.isoformat() == "2026-08-19"


def test_a_source_that_declares_no_licence_produces_droppable_documents(tmp_path):
    root = tmp_path / "src"
    root.mkdir()
    (root / "a.luau").write_text("local a = 1\nreturn a\n")
    bare = SourceSpec.from_json(
        {
            "source_id": "somewhere",
            "kind": "devforum",
            "retrieved_on": "2026-08-19",
            "loader": "directory",
            "path": str(root),
        }
    )
    doc = next(iter(load(bare)))
    verdict = provenance_check(doc)
    assert not verdict.ok
    # Which rule fires first does not matter; that a named rule fires does.
    assert verdict.reason.startswith("provenance.")


def test_per_row_licence_overrides_the_spec(tmp_path):
    """
    One dump routinely mixes repositories with different licences. Flattening
    them to the spec's licence is exactly the guess this refuses to make.
    """
    path = tmp_path / "dump.jsonl"
    path.write_text(
        "\n".join(
            json.dumps(r)
            for r in (
                {"id": "1", "text": "local a = 1\n"},
                {"id": "2", "text": "local b = 2\n", "licence": "GPL-3.0-only"},
            )
        )
    )
    spec = SourceSpec.from_json(dict(SPEC, loader="jsonl", path=str(path)))
    docs = list(load(spec))
    assert docs[0].provenance.licence == "MIT"
    assert docs[1].provenance.licence == "GPL-3.0-only"
    assert not provenance_check(docs[1]).ok


def test_the_example_source_manifest_parses():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    specs = load_source_manifest(os.path.join(here, "sources.example.json"))
    assert specs
    assert {s.loader for s in specs} <= set(("directory", "jsonl", "hf"))
    for spec in specs:
        assert spec.licence_evidence != "assumed", (
            "the shipped example must model a stateable provenance"
        )


def test_writing_a_corpus_into_the_repository_is_refused():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with pytest.raises(ValueError) as exc:
        guard_output_path(os.path.join(here, "train.jsonl"))
    assert "refusing" in str(exc.value)


def test_writing_a_corpus_outside_the_repository_is_fine(tmp_path):
    record = TrainingRecord(
        record_id="r1",
        text="local a = 1\n",
        provenance=SourceSpec.from_json(SPEC).provenance(),
    )
    out = write_jsonl([record], str(tmp_path / "train.jsonl"))
    with open(out, "r", encoding="utf-8") as fh:
        row = json.loads(fh.readline())
    assert row["record_id"] == "r1"
    assert row["provenance"]["licence"] == "MIT"


def test_an_unknown_loader_is_an_error_not_a_silent_empty_source():
    spec = SourceSpec.from_json(dict(SPEC, loader="telepathy"))
    with pytest.raises(ValueError):
        list(load(spec))
