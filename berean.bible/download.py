import os
from pathlib import Path
import shutil
import sys
import urllib.request

pwd = Path(__file__).parent

url = 'https://bereanbible.com/'
fnm = 'bsb_tables.tsv'

print('Downloading Berean Standard Bible Translation Tables...')
with urllib.request.urlopen(url + fnm) as src:
    with (pwd / fnm).open('wb') as dst:
        shutil.copyfileobj(src, dst)
print('Done!')
