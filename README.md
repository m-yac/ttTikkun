# [ttTikkun](https://www.yacavone.net/ttTikkun/)

An online [<ins>Tikkun</ins>](https://en.wikipedia.org/wiki/Tikkun_(book)) with <ins>t</ins>ransliteration and <ins>t</ins>ranslation!

At its heart, this project is just a very careful combination of the following excellent sources:
- [tikkun.io](https://github.com/akivajgordon/tikkun.io#readme) for the Hebrew text and its layout
- [havarotjs](https://github.com/charlesLoder/havarotjs#readme) for generating the [custom transliteration](https://www.yacavone.net/ttTikkun/transliterate)
- The [unfoldingWord Literal Text](https://git.door43.org/unfoldingWord/en_ult.git) for the English translation
- [hebcal-leyning](https://github.com/hebcal/hebcal-leyning#readme) and [hebcal-triennial](https://github.com/hebcal/hebcal-triennial#readme) for the weekly and holiday readings

## AI Disclosure

Generative AI was used in the creation of this project.

For the typescript files in `./src`, I tried very hard to clearly delineate code which is my work (often with help from googling, of course) and code which the machine wrote and I just briefly reviewed. Sections in the latter category usually either derive more-or-less mindlessly from a spec or in some way manage the user's interactions with things like hovering, infinite scrolling, or the nav bar - which if I had to deal with myself I think would have resulted in me quitting the project.

For some examples of the way these sections are marked, in `src/transliteration.ts` there is a section divider:
```ts
// ============================================
//  Building the UI [GENERATED ENTIRELY BY AI]
// ============================================
```
and in `page.ts` there are a couple JSDoc comments beginning with:
```ts
/**
 * [THIS FUNCTION WAS GENERATED ENTIRELY BY AI]
```

For the Python sub-project (see below), there is no clear line - although a careful reader could probably pick out most of the AI code based on its comments. The reason for this is that using AI to revive some old (extremely messy) code I wrote years ago which I never wanted to touch again was how this project got started.

## Sub-project: tikkunio_plus_unfoldingWord

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

Then run the following to re-generate `src/data`:
```
$ poetry run combine
```
