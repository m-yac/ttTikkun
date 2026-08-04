"""That the build runs at all, before anything asks what it produced.

Collected before test_pages.py, which reads what the build wrote: if the sources
have drifted far enough to raise -- an unparseable ULT, an alignment the
tikkun.io text can't hold -- it is reported here, once, and the tests that would
only have gone on to fail over missing pages stand aside.
"""

from tikkunio_plus_unfoldingWord.main import dst_p


def test_combine_builds_the_data(build):
    if build is not None:
        raise build
    for scroll in ['torah', 'esther']:
        assert (dst_p / 'pages' / scroll / '1.json').exists()
        assert (dst_p / 'english' / f'{scroll}.json').exists()
        assert (dst_p / 'lookup' / f'{scroll}.json').exists()
