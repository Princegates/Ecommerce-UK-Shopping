/**
 * A private key pasted into a one-line box loses its line breaks, and one set in an environment variable often has "\n" written out.
 * Both are rebuilt into a proper PEM here. Only the base64 body is kept in storage.
 */
export function pemBody(raw: string): string {
  return raw.replace(/-----[A-Z ]+-----/g, "").replace(/\\n/g, "").replace(/\s+/g, "");
}

export function toPem(raw: string, label = "PRIVATE KEY"): string {
  const body = pemBody(raw);
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}
