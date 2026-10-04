from collections.abc import Callable
from typing import Literal, NoReturn

from droneey_eros.errors import ExpectedError

type MapperMode = Literal['transparent', 'expected', 'unexpected']

type ErrorMapping = tuple[type[ExpectedError], type[ExpectedError]]
"""A source class and the target class an error of the source becomes."""

type ErrorMapper = Callable[[Exception], NoReturn]
