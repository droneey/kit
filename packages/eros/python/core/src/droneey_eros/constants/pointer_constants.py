import re
from typing import Final

# An RFC 6901 JSON Pointer in URI fragment form: #/items/0/quantity, or # for the whole.
FRAGMENT_POINTER: Final = re.compile(r'#(?:/(?:[^/~]|~[01])*)*')
