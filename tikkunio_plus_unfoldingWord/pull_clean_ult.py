"""Collect the most recent revision of each ULT book that parses cleanly.

unfoldingWord edits the ULT in place, and their bible-editor exports have been
landing alignment corruption in whichever book is under active work -- Numbers
lost every clean revision after 2026-04-21, for instance. Rather than pin the
whole submodule back (which would also revert books that are fine, and are
quietly improving), this walks each book's history and takes the newest revision
that `usfm.parse` accepts, into a directory the pipeline can read instead.

Rerun it whenever the submodule updates: books that upstream has fixed will
advance to their newer revision on their own, and the README records where each
file came from.

    poetry run pull-clean-ult [--output DIR] [--ref REF] [--max-commits N]

Only books with a UHB counterpart can be checked, so the New Testament (which
aligns to the Greek UGNT) is out of scope.
"""
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .usfm import Problem, parse

top_level = Path(__file__).parent.parent
ult_p, uhb_p = top_level / 'textSources' / 'en_ult', top_level / 'textSources' / 'hbo_uhb'
# Alongside what `combine` writes, rather than in the source tree: this is built
# output too, and main.py reads it from there.
dst_p = top_level / 'dst' / 'en_ult_clean'


def git(*args):
    return subprocess.run(['git', '-C', str(ult_p), *args],
                          capture_output=True, text=True, check=True).stdout


def history(path, ref, limit):
    """Commits touching `path`, newest first, as [(sha, date, subject)]."""
    log = git('log', ref, f'--max-count={limit}', '--format=%H\t%ad\t%s',
              '--date=short', '--', path)
    return [line.split('\t', 2) for line in log.splitlines() if line]


def find_clean(path, uhb_text, ref, limit):
    """The newest revision of `path` that parses without a Problem.

    Returns (record, text); text is None if no revision in range parses.
    """
    commits = history(path, ref, limit)
    head_problem = None
    for behind, (sha, date, subject) in enumerate(commits):
        text = git('show', f'{sha}:{path}')
        try:
            parse(text, uhb_text)
        except Problem as problem:
            if behind == 0:
                head_problem = str(problem)
            continue
        return {'sha': sha, 'date': date, 'subject': subject,
                'behind': behind, 'head_problem': head_problem,
                'searched': len(commits)}, text
    return {'head_problem': head_problem, 'searched': len(commits)}, None


def write_readme(output, records, ref, ref_sha):
    lines = [
        '# Clean ULT snapshot',
        '',
        'The most recent revision of each ULT book that parses cleanly against',
        'the UHB, collected by `scripts/combine/pull_clean_ult.py`. Do not edit',
        'these files by hand -- rerun the script instead, and they will advance',
        'as upstream fixes land.',
        '',
        f'- Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}',
        f'- Searched: `en_ult` {ref} (`{ref_sha[:10]}`)',
        f'- Validated against: `hbo_uhb` `{uhb_head()[:10]}`',
        '',
    ]
    unresolved = []
    stale = []
    current = []
    for name, record in sorted(records.items()):
        if record.get('sha') is None:
            unresolved.append((name, record))
        elif record['behind']:
            stale.append((name, record))
        else:
            current.append(name)

    if stale:
        lines += [
            '## Held back',
            '',
            'These books do not parse at the ref above, so an older revision was',
            'taken. "Behind" counts how many later commits touched the file but',
            'would not parse. Every book not listed here is current.',
            '',
            '| Book | Behind | Date | SHA | Commit Message |',
            '| --- | --- | --- | --- | --- |',
        ]
        for name, record in stale:
            lines.append(
                f'| `{name}` | {record["behind"]} | {record["date"]} | '
                f'`{record["sha"][:10]}` | {record["subject"][:60]} |')
        lines += [
            '',
            'The first problem each one hits at the ref above:',
            '',
            '| Book | First problem |',
            '| --- | --- |',
        ]
        for name, record in stale:
            lines.append(f'| `{name}` | {record["head_problem"]} |')

    lines += ['', f'## Current ({len(current)} books)', '',
              'Taken straight from the ref above.', '',
              ' '.join(f'`{n}`' for n in current)]

    if unresolved:
        lines += [
            '',
            '## No clean revision found',
            '',
            'No revision searched will parse, so these books are absent from this',
            'directory. Run `poetry run validate-ult <ult> <uhb>` to see why.',
            '',
            '| Book | First problem at HEAD | Commits searched |',
            '| --- | --- | --- |',
        ]
        for name, record in unresolved:
            lines.append(f'| `{name}` | {record["head_problem"]} | '
                         f'{record["searched"]} |')

    lines.append('')
    (output / 'README.md').write_text('\n'.join(lines))


def uhb_head():
    return subprocess.run(['git', '-C', str(uhb_p), 'rev-parse', 'HEAD'],
                          capture_output=True, text=True, check=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser(description=(__doc__ or '').split('\n')[0])
    ap.add_argument('--output', type=Path, default=dst_p,
                    help=f'directory to write (default: {dst_p.parent.name}/'
                         f'{dst_p.name}/)')
    ap.add_argument('--ref', default='HEAD',
                    help='en_ult ref whose history to search (default: HEAD)')
    ap.add_argument('--max-commits', type=int, default=500,
                    help='how far back to look per book (default: 500)')
    args = ap.parse_args()

    # Only books the UHB can vouch for; the NT aligns to the Greek instead.
    books = sorted(p.name for p in uhb_p.glob('[0-3][0-9]-*.usfm')
                   if (ult_p / p.name).exists())

    args.output.mkdir(parents=True, exist_ok=True)
    records = {}
    for name in books:
        uhb_text = (uhb_p / name).read_text()
        record, text = find_clean(name, uhb_text, args.ref, args.max_commits)
        records[name] = record
        if text is None:
            print(f'{name}  no clean revision in {record["searched"]} commits '
                  f'({record["head_problem"]})')
            (args.output / name).unlink(missing_ok=True)
            continue
        (args.output / name).write_text(text)
        if record['behind']:
            print(f'{name}  {record["sha"][:10]} {record["date"]} '
                  f'({record["behind"]} commits behind: {record["head_problem"]})')
        else:
            print(f'{name}  current')

    write_readme(args.output, records, args.ref, git('rev-parse', args.ref).strip())
    clean = sum(1 for r in records.values() if r.get('sha'))
    print(f'\n{clean}/{len(books)} books written to {args.output}')
    return 0 if clean == len(books) else 1


if __name__ == '__main__':
    raise SystemExit(main())
