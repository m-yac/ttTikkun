# `en_ult_clean`

The most recent version of each ULT book that successfully matches against the unfoldingWord Hebrew Bible. To regenerate all the files in this directory, including this one, use `poetry run pull-clean-ult`.

- Generated: 2026-08-18 13:35 UTC
- Searched: `en_ult` HEAD (`73512c6d81`)
- Validated against: `hbo_uhb` `42e223dc79`

## Failed to match

These books of the unfoldingWord Literal Text failed to match the unfoldingWord Hebrew Bible at the searched refs above, so an older version of the unfoldingWord Literal Text is being used. "Behind" counts how many commits behind we had to search.

| Book | Behind | Date | SHA | Commit Message |
| --- | --- | --- | --- | --- |
| `04-NUM.usfm` | 87 | 2026-05-13 | `369ada7df8` | Merge auto-jessicaparks-NUM into master by jessicaparks (#59 |
| `11-1KI.usfm` | 66 | 2019-06-25 | `0ee77e02fe` | Standardize footnote text (#1907) |
| `13-1CH.usfm` | 61 | 2020-06-09 | `9b97edaf5d` | Prepare for publishing version 11 (#2185) |
| `24-JER.usfm` | 342 | 2026-04-02 | `d43594d9d5` | Merge auto-Grant_Ailie-JER into master by Grant_Ailie (#5627 |
| `26-EZK.usfm` | 46 | 2026-07-14 | `0b9f3d08d4` | bible-editor export: EZK ult → EZK-be-bcameron93 (export-202 |
| `30-AMO.usfm` | 26 | 2026-06-06 | `04117dae6f` | USFM cleanup |
| `33-MIC.usfm` | 29 | 2026-05-28 | `fedc120b0c` | Merge auto-pjoakes-MIC into master by pjoakes (#6133) |
| `38-ZEC.usfm` | 62 | 2026-01-13 | `cfdb22d5d0` | Fixes headers |

The first problem each one hit at the refs in the first section:

| Book | First problem |
| --- | --- |
| `04-NUM.usfm` | 18:23 occurrence-out-of-bounds: 'וְ\u2060עָבַ֨ד' is occurrence 2 of only 1 |
| `11-1KI.usfm` | 14:2 content-not-in-verse: 'אַ֖תְּ' is not a word of this verse |
| `13-1CH.usfm` | 22:19 occurrences-mismatch: 'הָֽ\u2060אֱלֹהִ֔ים' claims 1 occurrence(s), the Hebrew has 2 |
| `24-JER.usfm` | 29:17 unhandled-marker: unhandled tag in: '\\\np —' |
| `26-EZK.usfm` | 8:1 occurrence-out-of-bounds: 'וַ\u2060תִּפֹּ֤ל' is occurrence 2 of only 1 |
| `30-AMO.usfm` | 1:2 occurrence-out-of-bounds: 'וְ\u2060אָֽבְלוּ֙' is occurrence 2 of only 1 |
| `33-MIC.usfm` | 5:7 occurrence-out-of-bounds: 'וְ\u2060הָיָ֣ה' is occurrence 2 of only 1 |
| `38-ZEC.usfm` | 1:12 occurrence-out-of-bounds: 'וַ\u2060יַּ֣עַן' is occurrence 2 of only 1 |
