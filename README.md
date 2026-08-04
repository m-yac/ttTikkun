# ttTikkun

...

## tikkunio_plus_unfoldingWord

[akivajgordon/tikkun.io](https://github.com/akivajgordon/tikkun.io) combined word-by-word with the [unfoldingWord](https://unfoldingword.org/for-translators/content/) [Literal Text](https://git.door43.org/unfoldingWord/en_ult.git) translation.

### Dependencies

- Python 3
- Poetry

### Installation

```
$ poetry install
```

### Usage

Unless the goal is just to test a change in the main combine script, first run:
```
$ git submodule update --init
$ poetry run pull-clean-ult
```

Run the following to re-generate `src/data`:
```
$ poetry run combine
```
