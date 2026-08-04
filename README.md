# ttTikkun

...

## tikkunio_plus_unfoldingWord

The tikkun.io pages, combined word for word with the unfoldingWord Hebrew Bible
and its literal English translation, written out as JSON.

### Dependencies

- Python 3
- Poetry

### Installation

```
$ poetry install
```

### Usage

Collect the sources first, then build:

```
$ git submodule update --init
$ poetry run pull-clean-ult
$ poetry run combine
```

`combine` writes to `data/` unless given somewhere else to put it:

```
$ poetry run combine path/to/data
```

#### `pull-clean-ult`

unfoldingWord edits the ULT in place, and their bible-editor exports keep
landing alignment corruption in whichever book is under active work. Rather than
pin the `en_ult` submodule back — which would also revert books that are fine —
this walks each book's history and writes the newest revision that parses into
`dst/en_ult_clean/`, which `combine` reads instead of the submodule. Rerun it
whenever the submodule updates: books upstream has fixed advance on their own,
and `dst/en_ult_clean/README.md` records where each file came from.

#### Tests

```
$ poetry run pytest tikkunio_plus_unfoldingWord/tests
```

Note that this rebuilds `data/`, exactly as `combine` would: the build is
itself under test, so a run that raises fails `test_combine.py` rather than
going unnoticed, and the pages the rest of the suite checks are always the ones
the current code produces.

`test_breaks.py` covers where the English is broken when it crosses a fragment
boundary, and needs nothing built. `test_pages.py` checks what has to hold of
the built pages -- above all that reading them fragment by fragment gives the
ULT back word for word, in order.

#### `validate-ult`

Why a given book will not parse:

```
$ poetry run validate-ult textSources/en_ult/04-NUM.usfm textSources/hbo_uhb/04-NUM.usfm
18:23 occurrence-out-of-bounds: 'וְ⁠עָבַ֨ד' is occurrence 2 of only 1
```

Both are thin wrappers over `tikkunio_plus_unfoldingWord/usfm.py`, which parses a ULT book against
its UHB counterpart and raises on the first disagreement.