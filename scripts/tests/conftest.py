"""NOTE: running the tests rebuilds `src/data` in place.

They build it rather than read whatever is sitting in the tree, because the
build is itself the thing under test: it is the only way to know the pages being
checked are the ones this code produces, and it means a build that raises --
against sources that move under us, since unfoldingWord edits the ULT in place
-- fails the suite instead of going unnoticed. It writes exactly what
`poetry run combine` writes, from the same sources, and takes a few seconds.
"""

import pytest

from combine.main import main, src_p, ult_p, uhb_p

# How the build went, kept across the session: it can only run once, since it
# accumulates into module-level state as it goes.
outcome = []


@pytest.fixture(scope='session')
def build():
    """Build the data, and report what came of it rather than raising: it is
    test_combine.py's job to fail over a build that didn't run."""
    if len(outcome) == 0:
        for path, fix in [(ult_p, "poetry run pull-clean-ult"),
                          (uhb_p, "git submodule update --init"),
                          (src_p, "git submodule update --init")]:
            if not path.exists():
                pytest.skip(f"nothing at {path}; run `{fix}` first")
        try:
            main()
            outcome.append(None)
        except Exception as e:
            outcome.append(e)
    return outcome[0]


@pytest.fixture(scope='session')
def built(build):
    """The built data. Tests asking for it have nothing to say about a build
    that failed, so they stand aside for the one test that does."""
    if build is not None:
        pytest.skip(f"the build failed ({type(build).__name__}); "
                    f"see test_combine_builds_the_data")
