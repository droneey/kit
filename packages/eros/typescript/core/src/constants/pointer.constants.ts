/** The root of an RFC 6901 JSON Pointer in URI fragment form. */
const POINTER_ROOT = '#';

const TOKEN_SEPARATOR = '/';

/** An RFC 6901 JSON Pointer in URI fragment form, whose tilde escapes only `~0` and `~1`. */
const POINTER_PATTERN = /^#(\/([^/~]|~[01])*)*$/u;

export { POINTER_PATTERN, POINTER_ROOT, TOKEN_SEPARATOR };
