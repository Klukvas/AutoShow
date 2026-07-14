const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
};

/**
 * JSON.stringify does NOT escape `<`, `>` or `&`, so a value containing
 * `</script>` (attacker-controlled via an admin/editor form) would close a
 * `<script>` element and inject executable markup. Escaping `<` is what
 * prevents the breakout; `>`/`&` are defense-in-depth. Standard Next.js
 * JSON-LD pattern.
 */
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/[<>&]/g, (ch) => ESCAPES[ch]);
}
