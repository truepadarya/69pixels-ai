/** A string as it would be written in a url or a form field's name. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Keep short English function words with the word that follows them. */
export function keepShortWordsTogether(text: string): string {
  return text.replace(
    /\b(a|an|the|and|or|to|of|in|on|at|for|from|with|by|as) +(?=\S)/gi,
    "$1\u00a0",
  );
}
