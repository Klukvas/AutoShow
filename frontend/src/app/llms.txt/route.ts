import { getSiteBranding } from '@/lib/branding/resolve';

/**
 * llms.txt (llmstxt.org): a short, markdown map of the site for AI assistants
 * and their crawlers. Built from live branding so the dealership name and
 * contacts never drift from the admin-configured values.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const branding = await getSiteBranding();

  const name = branding?.displayName ?? 'AutoFlow';
  const tagline = branding?.tagline ?? 'Кураторська вітрина перевірених автомобілів';
  const description = branding?.seoDefaults?.description ?? tagline;

  const contacts = [
    branding?.contactPhone ? `- Телефон: ${branding.contactPhone}` : null,
    branding?.contactEmail ? `- Email: ${branding.contactEmail}` : null,
    branding?.address ? `- Адреса: ${branding.address}` : null,
  ].filter(Boolean);

  const body = `# ${name}

> ${description}

${name} — сайт автосалону з кураторським каталогом вживаних автомобілів: перевірені авто з фотографіями, характеристиками та актуальними цінами.

## Каталог

- [Усі автомобілі](${origin}/cars): повний каталог із фільтрами за маркою, моделлю, кузовом, паливом, роком та ціною
- [Мапа сайту](${origin}/sitemap.xml): усі активні оголошення з датами оновлення

## Дані

- Кожна сторінка авто містить структуровані дані schema.org/Vehicle (JSON-LD): ціна з валютою, наявність, пробіг, двигун, трансмісія, привід
- Оголошення знімаються з публікації після продажу — наявність у каталозі актуальна

## Контакти

${contacts.length > 0 ? contacts.join('\n') : `- Див. ${origin}`}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
