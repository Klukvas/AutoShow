'use client';

/**
 * Last-resort error boundary.
 *
 * `global-error.tsx` replaces the root layout entirely when the root layout
 * itself (or anything above `app/error.tsx`, e.g. `NextIntlClientProvider`)
 * throws. Because the root layout is not rendered, this file must own the
 * `<html>`/`<body>` elements and cannot rely on next-intl, Tailwind, global
 * CSS, design tokens or any other project import — every style below is an
 * explicit inline value. A light surface with explicit dark ink is used so the
 * text stays readable regardless of the visitor's colour scheme (the document
 * background otherwise falls back to the browser default, which follows it).
 *
 * `error`/`reset` come with Next's contract. Their contents are not rendered:
 * production redacts server messages, and the retry must issue a fresh
 * document request rather than re-render the already-failed tree.
 */
export default function GlobalError({
  // Intentionally unused props, kept for the Next error-boundary contract.
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#f3f2ee',
          color: '#16171a',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <main
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            role="alert"
            style={{
              width: '100%',
              maxWidth: '32rem',
              padding: '40px 28px',
              boxSizing: 'border-box',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              border: '1px solid #dcd9d1',
              borderRadius: '16px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: '#fbe9e7',
                color: '#b3261e',
                fontSize: '24px',
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              !
            </span>
            <h1
              style={{
                margin: '20px 0 0',
                fontSize: '22px',
                lineHeight: 1.25,
                fontWeight: 600,
                color: '#16171a',
              }}
            >
              Сервіс тимчасово недоступний
            </h1>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '16px',
                lineHeight: 1.5,
                color: '#4a4d54',
              }}
            >
              Не вдалося завантажити дані сайту. Спробуйте оновити сторінку за хвилину.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '0 20px',
                border: '1px solid #16171a',
                borderRadius: '12px',
                backgroundColor: '#16171a',
                color: '#f3f2ee',
                fontSize: '16px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Спробувати ще раз
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
