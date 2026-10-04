import re
from typing import Final

CODE_SEPARATOR: Final = '/'

CODE_SEGMENT: Final = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
