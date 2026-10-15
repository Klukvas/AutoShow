// Isolated local test data. This server never reads or writes a real database.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = 3103;
const assets = path.resolve(__dirname, '../../../videos/autoflow-reels/capture/assets');
const ref = (slug, nameUk) => ({ id: slug, slug, nameUk, nameEn: nameUk });
const examples = [
  ['bmw', 'BMW', '5-series', '5 Series 530i xDrive', 2021, '38500', 'bmw-5-series-530i-xdrive-2021-1.jpg'],
  ['audi', 'Audi', 'a4', 'A4 2.0 TFSI', 2020, '24500', 'audi-a4.jpg'],
  ['bmw', 'BMW', 'x5', 'X5 xDrive', 2020, '52000', 'bmw-x5.jpg'],
  ['bmw', 'BMW', '3-series', '3 Series', 2022, '36900', 'bmw-3-series.jpg'],
];
const listings = examples.map(([make, makeName, model, modelName, year, amount, file], index) => ({
  id: `fixture-${index}`, slug: `${make}-${model}-fixture`, title: `${makeName} ${modelName}`,
  description: 'Ізольовані тестові дані для перевірки головної сторінки.', status: index === 2 ? 'reserved' : 'published',
  seller: { type: 'own', name: null, phone: null }, make: ref(make, makeName), model: ref(model, modelName),
  generation: null, modification: null, year, mileageKm: 61000 + index * 11000, vin: null,
  bodyType: ref('sedan', 'Седан'), fuelType: ref('petrol', 'Бензин'), transmission: ref('automatic', 'Автомат'),
  driveType: ref('awd', 'Повний'), color: ref('grey', 'Сірий'), engineVolumeL: '2.0', powerHp: 245,
  condition: 'used', ownersCount: 1, isCrashed: false, customsCleared: true,
  price: { amount, currency: 'USD', normalized: amount, isNegotiable: false, priceDrop: null },
  location: { city: 'Київ', region: null }, publishedAt: '2026-10-13T12:00:00Z', viewsCount: 20,
  media: [{ id: `photo-${index}`, type: 'image', position: 0, isCover: true, alt: `${makeName} ${modelName}`,
    originalUrl: `http://localhost:${port}/images/${file}`, renditions: [{ url: `http://localhost:${port}/images/${file}`,
      width: 1920, height: 1080, format: 'jpeg', variant: 'full', bytes: 100000 }] }],
  options: [], tags: [], seo: { metaTitle: null, metaDescription: null, canonical: `http://localhost:3102/cars/${make}-${model}-fixture`, jsonLd: {} },
}));
const branding = {
  id: 'fixture', logoUrl: null, faviconUrl: null, primaryColor: '#111827', accentColor: '#B4453C',
  displayName: 'AutoFlow', tagline: 'Ретельно відібрані автомобілі для тих, хто цінує якість, стиль і свободу руху.',
  contactPhone: '+380000000000', contactEmail: 'fixture@example.invalid', address: 'Тестовий автосалон',
  workingHours: { mon: { open: '09:00', close: '18:00' } }, socialLinks: null, seoDefaults: null, defaultCurrency: 'USD',
};
const collections = ['Сімейні авто', 'До $25 000', 'Електромобілі', 'Кросовери', 'Повний привід'].map((titleUk, index) => ({
  id: `collection-${index}`, key: ['family', 'budget', 'electric', 'suv', 'awd'][index], titleUk,
  descriptionUk: 'Перегляньте добірку автомобілів', emoji: '', query: {}, position: index, isPublished: true,
}));
const reviews = ['Олександр', 'Марина', 'Віктор'].map((authorName, index) => ({
  id: `review-${index}`, authorName, city: 'Київ', rating: 5, text: 'Показали автомобіль, пояснили його історію та допомогли з оформленням. Дякую за уважність.',
}));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  url.pathname = url.pathname.replace('/fixture-v2', '');
  if (req.method !== 'GET') { res.writeHead(405); res.end('Read-only fixture'); return; }
  if (url.pathname.startsWith('/images/')) {
    const file = path.basename(url.pathname);
    if (!examples.some((example) => example[6] === file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'image/jpeg' }); fs.createReadStream(path.join(assets, file)).pipe(res); return;
  }
  const endpoints = {
    '/api/branding': branding, '/api/listings': { items: listings, total: listings.length, nextCursor: null },
    '/api/collections': collections, '/api/reviews': reviews, '/api/stats': { available: 4, sold: 12, views: 240 },
    '/api/catalog/makes': [ref('bmw', 'BMW'), ref('audi', 'Audi')], '/api/catalog/models': [],
    '/api/catalog/options': [], '/api/catalog/tags': [], '/api/catalog/body-types': [],
    '/api/catalog/fuel-types': [], '/api/catalog/transmissions': [], '/api/catalog/drive-types': [], '/api/catalog/colors': [],
  };
  const listing = listings.find((item) => url.pathname === `/api/listings/${item.slug}`);
  const collection = collections.find((item) => url.pathname === `/api/collections/${item.key}`);
  const data = endpoints[url.pathname] ?? listing ?? collection;
  res.writeHead(data ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(data ?? { message: 'Fixture endpoint not found' }));
});
server.listen(port, 'localhost', () => process.stdout.write(`Read-only homepage fixture API: http://localhost:${port}/api\n`));
