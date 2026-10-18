/// <reference types="astro/client" />

/** "public" for openrepairrecord.com, "onprem" for the self-hosted copy (set at build time, see astro.config.mjs). */
declare const __ORR_EDITION__: "public" | "onprem";
/** The package version, e.g. "1.0.0". */
declare const __ORR_VERSION__: string;
