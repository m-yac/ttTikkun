# Clean ULT snapshot

The most recent revision of each ULT book that parses cleanly against
the UHB, collected by `scripts/combine/pull_clean_ult.py`. Do not edit
these files by hand -- rerun the script instead, and they will advance
as upstream fixes land.

- Generated: 2026-07-16 16:10 UTC
- Searched: `en_ult` HEAD (`df0485ff4a`)
- Validated against: `hbo_uhb` `0231ffdfea`

## Held back

These books do not parse at the ref above, so an older revision was
taken. "Behind" counts how many later commits touched the file but
would not parse. Every book not listed here is current.

| Book | Behind | Date | SHA | Commit Message |
| --- | --- | --- | --- | --- |
| `04-NUM.usfm` | 73 | 2026-05-13 | `369ada7df8` | Merge auto-jessicaparks-NUM into master by jessicaparks (#59 |
| `13-1CH.usfm` | 56 | 2020-06-09 | `9b97edaf5d` | Prepare for publishing version 11 (#2185) |
| `24-JER.usfm` | 330 | 2026-04-02 | `d43594d9d5` | Merge auto-Grant_Ailie-JER into master by Grant_Ailie (#5627 |
| `26-EZK.usfm` | 6 | 2026-07-14 | `0b9f3d08d4` | bible-editor export: EZK ult → EZK-be-bcameron93 (export-202 |
| `30-AMO.usfm` | 14 | 2026-06-06 | `04117dae6f` | USFM cleanup |
| `33-MIC.usfm` | 21 | 2026-05-28 | `fedc120b0c` | Merge auto-pjoakes-MIC into master by pjoakes (#6133) |
| `38-ZEC.usfm` | 53 | 2026-01-13 | `cfdb22d5d0` | Fixes headers |

The first problem each one hits at the ref above:

| Book | First problem |
| --- | --- |
| `04-NUM.usfm` | 18:23 occurrence-out-of-bounds: 'וְ\u2060עָבַ֨ד' is occurrence 2 of only 1 |
| `13-1CH.usfm` | 22:19 occurrences-mismatch: 'הָֽ\u2060אֱלֹהִ֔ים' claims 1 occurrence(s), the Hebrew has 2 |
| `24-JER.usfm` | 29:17 unhandled-marker: unhandled tag in: '\\\np —' |
| `26-EZK.usfm` | 8:1 occurrence-out-of-bounds: 'וַ\u2060תִּפֹּ֤ל' is occurrence 2 of only 1 |
| `30-AMO.usfm` | 1:2 occurrence-out-of-bounds: 'וְ\u2060אָֽבְלוּ֙' is occurrence 2 of only 1 |
| `33-MIC.usfm` | 5:7 occurrence-out-of-bounds: 'וְ\u2060הָיָ֣ה' is occurrence 2 of only 1 |
| `38-ZEC.usfm` | 1:12 occurrence-out-of-bounds: 'וַ\u2060יַּ֣עַן' is occurrence 2 of only 1 |

## Current (32 books)

Taken straight from the ref above.

`01-GEN.usfm` `02-EXO.usfm` `03-LEV.usfm` `05-DEU.usfm` `06-JOS.usfm` `07-JDG.usfm` `08-RUT.usfm` `09-1SA.usfm` `10-2SA.usfm` `11-1KI.usfm` `12-2KI.usfm` `14-2CH.usfm` `15-EZR.usfm` `16-NEH.usfm` `17-EST.usfm` `18-JOB.usfm` `19-PSA.usfm` `20-PRO.usfm` `21-ECC.usfm` `22-SNG.usfm` `23-ISA.usfm` `25-LAM.usfm` `27-DAN.usfm` `28-HOS.usfm` `29-JOL.usfm` `31-OBA.usfm` `32-JON.usfm` `34-NAM.usfm` `35-HAB.usfm` `36-ZEP.usfm` `37-HAG.usfm` `39-MAL.usfm`
