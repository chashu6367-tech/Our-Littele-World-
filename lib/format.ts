/** Dates are calendar dates (no time zone): always format in UTC so they never shift a day. */
export const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
/** A moment in time (e.g. when a letter was written): shown in the viewer's own time zone. Render inside <time suppressHydrationWarning>, since the server's zone can differ. */
export const fmtWritten = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long" });
