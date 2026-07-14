import { safeJsonLd } from './escape';

interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Render a server-side JSON-LD script tag from the backend's `seo.jsonLd`.
 * The payload is HTML-escaped (see safeJsonLd) so admin/editor-entered text
 * containing `</script>` can't break out of the script element.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
  );
}
