"""
What a record is, and what it must carry to exist at all.

`Provenance` is not metadata decoration. A record whose origin cannot be stated
is dropped by `provenance.py` rather than guessed at, so these fields are the
record's licence to exist: without them there is nothing downstream to check,
and "we think most of it was MIT" is not a thing anyone can act on later when a
takedown arrives.

`retrieved_on` is separate from any date the source itself claims. Sources lie,
move, and get rewritten; the date *we* pulled it is the only one we can attest
to, and it is what a re-fetch would be compared against.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date
from enum import Enum
from typing import Any


class SourceKind(str, Enum):
    github = "github"
    docs = "docs"
    devforum = "devforum"
    marketplace = "marketplace"
    # Written for this project. Has no URL, and that is legitimate.
    synthetic = "synthetic"
    # From inside this repository or organisation.
    internal = "internal"


@dataclass
class Provenance:
    source_id: str
    source_kind: SourceKind
    licence: str
    retrieved_on: date
    url: str | None = None
    # Commit SHA, file revision, or dataset version. Without one, "we got this
    # from repo X" is not a statement anybody can re-check.
    revision: str | None = None
    author: str | None = None
    licence_url: str | None = None
    # How the licence was established: "spdx-file", "repo-metadata",
    # "declared-by-source", "assumed". "assumed" never passes the gate.
    licence_evidence: str = "assumed"
    note: str = ""

    def to_json(self) -> dict:
        d = asdict(self)
        d["source_kind"] = self.source_kind.value
        d["retrieved_on"] = self.retrieved_on.isoformat() if self.retrieved_on else None
        return d

    @classmethod
    def from_json(cls, d: dict) -> "Provenance":
        raw_date = d.get("retrieved_on")
        return cls(
            source_id=d.get("source_id", ""),
            source_kind=SourceKind(d["source_kind"]) if d.get("source_kind") else None,
            licence=d.get("licence", ""),
            retrieved_on=date.fromisoformat(raw_date[:10]) if raw_date else None,
            url=d.get("url"),
            revision=d.get("revision"),
            author=d.get("author"),
            licence_url=d.get("licence_url"),
            licence_evidence=d.get("licence_evidence", "assumed"),
            note=d.get("note", ""),
        )


@dataclass
class RawDocument:
    """One unit of material as it arrived, before anything has judged it."""

    doc_id: str
    text: str
    provenance: Provenance | None = None
    path: str = ""
    meta: dict = field(default_factory=dict)


@dataclass
class TrainingRecord:
    """A document that survived every stage. Only these are ever emitted."""

    record_id: str
    text: str
    provenance: Provenance
    path: str = ""
    n_tokens: int = 0
    n_bytes: int = 0
    # Content hash of the alpha-normalised form -- the dedup key, carried so a
    # downstream consumer can re-check membership without re-normalising.
    content_hash: str = ""
    quality: dict = field(default_factory=dict)
    # Non-fatal observations: deprecated API use, missing revision, and so on.
    warnings: list = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "text": self.text,
            "path": self.path,
            "provenance": self.provenance.to_json(),
            "n_tokens": self.n_tokens,
            "n_bytes": self.n_bytes,
            "content_hash": self.content_hash,
            "quality": self.quality,
            "warnings": self.warnings,
            "meta": self.meta,
        }
