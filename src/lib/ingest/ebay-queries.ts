/** One search per line, at most ten, each 2 to 100 characters. (Kept apart from the API client so forms can use it.) */
export function parseQueries(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, " ")).filter((l) => l.length >= 2 && l.length <= 100))].slice(0, 10);
}
