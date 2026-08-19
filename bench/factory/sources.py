"""
Where raw material comes in, and why provenance is declared at the source.

Provenance is attached at load time from a source manifest, not inferred later
from a file path. Inferring it is how "everything under vendor/ is MIT" becomes
a fact nobody checked. A source that does not declare a licence, a retrieval
date and an identifier simply produces documents that the provenance stage
drops -- which is the intended outcome, not a bug to work around.

Hugging Face `datasets` is supported and optional. It genuinely helps for
material that already ships as parquet or as a Hub dataset with real licence
metadata, and it is loaded lazily so the pipeline runs on a machine without it.
Nothing here uploads anything.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date

from .records import Provenance, RawDocument, SourceKind

CODE_SUFFIXES = (".luau", ".lua")


@dataclass
class SourceSpec:
    """One declared source. This is the unit provenance is asserted at."""

    source_id: str
    kind: SourceKind
    licence: str
    retrieved_on: date
    licence_evidence: str
    url: str | None = None
    revision: str | None = None
    author: str | None = None
    licence_url: str | None = None
    # "directory" | "jsonl" | "hf"
    loader: str = "directory"
    path: str = ""
    # loader-specific: hf split/config/text-column
    options: dict = None

    def __post_init__(self):
        if self.options is None:
            self.options = {}

    def provenance(self, extra_url: str | None = None) -> Provenance:
        return Provenance(
            source_id=self.source_id,
            source_kind=self.kind,
            licence=self.licence,
            retrieved_on=self.retrieved_on,
            url=extra_url or self.url,
            revision=self.revision,
            author=self.author,
            licence_url=self.licence_url,
            licence_evidence=self.licence_evidence,
        )

    @classmethod
    def from_json(cls, d: dict) -> "SourceSpec":
        return cls(
            source_id=d["source_id"],
            kind=SourceKind(d["kind"]),
            licence=d.get("licence", ""),
            retrieved_on=date.fromisoformat(d["retrieved_on"][:10])
            if d.get("retrieved_on")
            else None,
            licence_evidence=d.get("licence_evidence", "assumed"),
            url=d.get("url"),
            revision=d.get("revision"),
            author=d.get("author"),
            licence_url=d.get("licence_url"),
            loader=d.get("loader", "directory"),
            path=d.get("path", ""),
            options=d.get("options") or {},
        )


def load_source_manifest(path: str) -> list:
    with open(os.path.expanduser(path), "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return [SourceSpec.from_json(s) for s in payload.get("sources", [])]


def from_directory(spec: SourceSpec):
    root = os.path.expanduser(spec.path)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in sorted(filenames):
            if not name.endswith(CODE_SUFFIXES):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            try:
                with open(full, "r", encoding="utf-8") as fh:
                    text = fh.read()
            except (UnicodeDecodeError, OSError):
                # A file we cannot even decode has no stateable content; it is
                # dropped here rather than being turned into replacement
                # characters and counted as a quality failure later.
                continue
            yield RawDocument(
                doc_id="%s::%s" % (spec.source_id, rel),
                text=text,
                provenance=spec.provenance(),
                path=rel,
                meta={"source_id": spec.source_id},
            )


def from_jsonl(spec: SourceSpec):
    """
    JSONL where each row may carry its own provenance overrides.

    Per-row provenance wins over the spec's, because a single dump can mix
    repositories with different licences and flattening them to the spec's
    licence would be exactly the guess this module exists to refuse.
    """
    text_key = spec.options.get("text_key", "text")
    with open(os.path.expanduser(spec.path), "r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            text = row.get(text_key) or row.get("content") or ""
            if not text:
                continue
            prov = spec.provenance(extra_url=row.get("url"))
            if row.get("licence") or row.get("license"):
                prov.licence = row.get("licence") or row.get("license")
                prov.licence_evidence = row.get("licence_evidence", "declared-by-source")
            if row.get("revision"):
                prov.revision = row["revision"]
            if row.get("retrieved_on"):
                prov.retrieved_on = date.fromisoformat(row["retrieved_on"][:10])
            yield RawDocument(
                doc_id=str(row.get("id") or "%s::%d" % (spec.source_id, lineno)),
                text=text,
                provenance=prov,
                path=str(row.get("path") or ""),
                meta={"source_id": spec.source_id},
            )


def from_hf(spec: SourceSpec):
    """
    Read a local or Hub dataset through `datasets`.

    Lazy import: the factory must not require a multi-hundred-megabyte
    dependency to process a directory of .luau files.
    """
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError(
            "source %r needs the `datasets` package (pip install datasets)" % spec.source_id
        ) from exc

    opts = dict(spec.options)
    text_key = opts.pop("text_key", "content")
    split = opts.pop("split", "train")
    ds = load_dataset(spec.path, split=split, **opts)
    for i, row in enumerate(ds):
        text = row.get(text_key) or ""
        if not text:
            continue
        prov = spec.provenance(extra_url=row.get("url") or row.get("repository_url"))
        row_licence = row.get("license") or row.get("licence")
        if row_licence:
            prov.licence = row_licence if isinstance(row_licence, str) else str(row_licence)
            prov.licence_evidence = "declared-by-source"
        yield RawDocument(
            doc_id="%s::%d" % (spec.source_id, i),
            text=text,
            provenance=prov,
            path=str(row.get("path") or row.get("max_stars_repo_path") or ""),
            meta={"source_id": spec.source_id},
        )


LOADERS = {"directory": from_directory, "jsonl": from_jsonl, "hf": from_hf}


def load(spec: SourceSpec):
    loader = LOADERS.get(spec.loader)
    if loader is None:
        raise ValueError("unknown loader %r for source %r" % (spec.loader, spec.source_id))
    return loader(spec)


def load_all(specs: list):
    for spec in specs:
        for doc in load(spec):
            yield doc
