"""
Provenance policy: a record whose origin cannot be *stated* is dropped.

Not "guessed", not "defaulted to MIT because the repo mostly is", not "assumed
public because it was on a forum". Every rule here turns into a named drop
reason so the run report can say `provenance.licence_unknown: 4,113` instead of
"some were dropped".

The licence allow-list is permissive-only by default and copyleft is refused
rather than silently included. That is a policy choice, not a legal opinion, and
it is here in one editable place precisely so it can be reviewed as a policy
rather than discovered later in a pile of code.

The check that earns its keep most often is `licence_text_conflict`: a file
carrying a GPL header inside a repository whose metadata says MIT. Repo-level
licence metadata is routinely wrong for vendored files, and trusting it is how
copyleft ends up in a corpus that believes it is clean.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date

from .records import Provenance, RawDocument, SourceKind

# SPDX identifiers accepted by default. Permissive only.
PERMISSIVE = frozenset(
    [
        "MIT",
        "MIT-0",
        "Apache-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "ISC",
        "0BSD",
        "Unlicense",
        "CC0-1.0",
        "Zlib",
        "BSL-1.0",
    ]
)

# Recognised but refused, so the report can distinguish "we know what this is
# and said no" from "we have no idea what this is".
KNOWN_REFUSED = frozenset(
    [
        "GPL-2.0-only",
        "GPL-2.0-or-later",
        "GPL-3.0-only",
        "GPL-3.0-or-later",
        "LGPL-2.1-only",
        "LGPL-3.0-only",
        "AGPL-3.0-only",
        "AGPL-3.0-or-later",
        "MPL-2.0",
        "CC-BY-SA-4.0",
        "CC-BY-NC-4.0",
        "CC-BY-ND-4.0",
        "SSPL-1.0",
        "BUSL-1.1",
        "Proprietary",
        "NOASSERTION",
    ]
)

# Licences that may be asserted for material we own outright.
OWNED = frozenset(["PROPRIETARY-OWNED"])

_URL = re.compile(r"^https?://[^\s]+$")

# Header text that contradicts a permissive declaration. Deliberately narrow --
# a false hit here drops a usable record, so each pattern names a licence family
# outright rather than matching the word "license".
_COPYLEFT_TEXT = [
    (re.compile(r"GNU\s+GENERAL\s+PUBLIC\s+LICENSE", re.I), "GPL"),
    (re.compile(r"GNU\s+LESSER\s+GENERAL\s+PUBLIC", re.I), "LGPL"),
    (re.compile(r"GNU\s+AFFERO\s+GENERAL\s+PUBLIC", re.I), "AGPL"),
    (re.compile(r"Mozilla\s+Public\s+License", re.I), "MPL"),
    (re.compile(r"Creative\s+Commons\s+Attribution[-\s]Share\s?Alike", re.I), "CC-BY-SA"),
    (re.compile(r"Creative\s+Commons\s+Attribution[-\s]Non[-\s]?Commercial", re.I), "CC-BY-NC"),
    (re.compile(r"All\s+[Rr]ights\s+[Rr]eserved", re.I), "all-rights-reserved"),
]

# Only the leading part of a file is scanned for a licence header, so a string
# constant deep inside a file that happens to mention the GPL does not drop it.
_HEADER_CHARS = 4000


@dataclass
class ProvenanceVerdict:
    ok: bool
    reason: str | None = None
    detail: str = ""
    warnings: list = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def check(
    doc: RawDocument,
    today: date | None = None,
    allowed: frozenset = PERMISSIVE,
    require_revision: bool = False,
) -> ProvenanceVerdict:
    today = today or date.today()
    p: Provenance | None = doc.provenance
    warnings: list = []

    if p is None:
        return ProvenanceVerdict(False, "provenance.missing", "no provenance block at all")
    if not p.source_id:
        return ProvenanceVerdict(False, "provenance.no_source_id")
    if p.source_kind is None:
        return ProvenanceVerdict(False, "provenance.no_source_kind")
    if p.retrieved_on is None:
        return ProvenanceVerdict(False, "provenance.no_retrieval_date")
    if p.retrieved_on > today:
        return ProvenanceVerdict(
            False, "provenance.retrieval_date_in_future", p.retrieved_on.isoformat()
        )

    needs_url = p.source_kind not in (SourceKind.synthetic, SourceKind.internal)
    if needs_url:
        if not p.url:
            return ProvenanceVerdict(False, "provenance.no_url", p.source_kind.value)
        if not _URL.match(p.url):
            return ProvenanceVerdict(False, "provenance.malformed_url", p.url[:80])

    if not p.licence:
        return ProvenanceVerdict(False, "provenance.no_licence")
    if p.licence_evidence == "assumed":
        # The whole point of the stage. An assumed licence is an unstated one.
        return ProvenanceVerdict(False, "provenance.licence_assumed", p.licence)
    if p.licence in OWNED:
        if p.source_kind not in (SourceKind.synthetic, SourceKind.internal):
            return ProvenanceVerdict(
                False, "provenance.owned_claim_on_external_source", p.source_kind.value
            )
    elif p.licence in KNOWN_REFUSED:
        return ProvenanceVerdict(False, "provenance.licence_not_permitted", p.licence)
    elif p.licence not in allowed:
        return ProvenanceVerdict(False, "provenance.licence_unknown", p.licence)

    head = doc.text[:_HEADER_CHARS]
    for pattern, family in _COPYLEFT_TEXT:
        if pattern.search(head):
            return ProvenanceVerdict(
                False,
                "provenance.licence_text_conflict",
                "%s header in a file declared %s" % (family, p.licence),
            )

    if p.source_kind is SourceKind.github and not p.revision:
        if require_revision:
            return ProvenanceVerdict(False, "provenance.no_revision", p.source_id)
        warnings.append("provenance.no_revision")

    return ProvenanceVerdict(True, warnings=warnings)
