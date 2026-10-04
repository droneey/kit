/** Joins the segments of a code: `orders/order/not-found`. */
const CODE_SEPARATOR = '/';

/** A segment of a code is in lower kebab case: `promo-code`, `invoice-v2`. */
const SEGMENT_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

export { CODE_SEPARATOR, SEGMENT_PATTERN };
