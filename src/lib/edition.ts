/**
 * Which copy this is. The public site at openrepairrecord.com counts visits; the self-hosted copy that companies run
 * inside their own network makes no request outside it, so analytics and links in <head> to the public site go.
 */
export const ONPREM = __ORR_EDITION__ === "onprem";
export const VERSION = __ORR_VERSION__;
