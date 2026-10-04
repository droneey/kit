import re
from collections.abc import Callable

type PointerRemap = Callable[[str], str]
"""Rewrites the JSON Pointer of a validation failure, in URI fragment form: `#/x`."""

type ValidationRule = tuple[str, str] | tuple[re.Pattern[str], str | Callable[[re.Match[str]], str]]
"""A pointer equal to a string, or a regex's first match, and what replaces it.

A regex's replacement is a template of `re.sub`, with groups as `\\g<1>`, or a function of
the match.
"""
