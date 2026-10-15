// Isolated local test data. This server never reads or writes a real database.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = 3153;
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
  options: [], tags: [], seo: { metaTitle: null, metaDescription: null, canonical: `http://localhost:3152/cars/${make}-${model}-fixture`, jsonLd: {} },
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
const adminUser = { id: '00000000-0000-4000-8000-000000000001', email: 'designer@fixture.invalid', role: 'admin', isActive: true, createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z' };
const adminListings = listings.map((item,index) => ({ ...item, id: `00000000-0000-4000-8000-${String(index+10).padStart(12,'0')}`, version: 1, priceAmount: item.price.amount, priceCurrency: item.price.currency, priceNormalized: item.price.normalized, createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z', makeId: item.make.id, modelId: item.model.id, bodyTypeId: 'sedan', fuelTypeId: 'petrol', transmissionId: 'automatic', driveTypeId: 'awd', colorId: 'grey', locationCity: item.location.city, isNegotiable: false, sellerType: 'own', feeType: 'none', media: item.media.map(media => ({ ...media, status: 'ready', thumbUrl: media.originalUrl })) }));
const lead = { id: '00000000-0000-4000-8000-000000000020', type: 'test_drive', name: 'Тестовий покупець', phone: '+380000000000', email: null, message: 'Хочу записатися на огляд автомобіля.', status: 'new', createdAt: '2026-10-14T12:00:00Z', listingId: adminListings[0].id, listing: { id: adminListings[0].id, slug: listings[0].slug, title: listings[0].title }, sourceUrl: 'http://localhost:3152', assigneeId: null, followUpAt: null };
const analytics = { listings: { published: 3, reserved: 1, draft: 1, sold: 12, archived: 0 }, sales: { total: 12, last30d: 2, commissionTotal: '12000', commission30d: '1500', commissionPipeline: '2300' }, leads: { byStatus: { new: 1, in_progress: 2, done: 3, spam: 0 }, last30d: 6 }, views: { total: 240, top: [{ ...adminListings[0], leadsCount: 3 }] }, conversion: { views: 240, leads: 6, rate: 2.5 }, attribution: [{ source: 'direct', count: 6 }], salesByMonth: [{ month: '2026-10', count: 2, commission: '1500' }] };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  url.pathname = url.pathname.replace('/fixture-v2', '');
  res.setHeader('access-control-allow-origin', 'http://localhost:3152');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  // Only the isolated fixture login returns test credentials. No real account or data is modified.
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    let body=''; req.on('data',chunk => { body += chunk; }); req.on('end',() => {
      try { const credentials=JSON.parse(body); const valid=credentials.email===adminUser.email && credentials.password==='fixture-password-123';
        res.writeHead(valid ? 200 : 401, { 'content-type': 'application/json' });
        res.end(JSON.stringify(valid ? { accessToken:'local-fixture-admin-token', refreshToken:'local-fixture-refresh-token', accessExpiresIn:86400, refreshExpiresIn:86400, user:adminUser } : { message:'Invalid isolated fixture credentials' }));
      } catch { res.writeHead(400);res.end(); }
    }); return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end('Read-only fixture data'); return; }
  if (url.pathname.startsWith('/images/')) {
    const file = path.basename(url.pathname);
    if (!examples.some((example) => example[6] === file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'image/jpeg' }); fs.createReadStream(path.join(assets, file)).pipe(res); return;
  }
  const endpoints = {
    '/api/admin/listings': { items: adminListings, total: adminListings.length, nextCursor: null },
    '/api/admin/users': [adminUser], '/api/admin/leads': { items:[lead], total:1, nextCursor:null },
    '/api/admin/leads/assignees': [adminUser], '/api/admin/analytics/summary':analytics,
    '/api/admin/reviews': reviews.map((review,index)=>({ ...review, position:index, isPublished:true, createdAt:'2026-10-14T12:00:00Z' })),
    '/api/admin/collections':collections, '/api/admin/catalog/tags':[ref('obmin','Обмін')],
    '/api/admin/branding':branding, '/api/admin/audit': { items:[{ id:'fixture-audit', actorId:adminUser.id, actorRole:'admin', action:'listing_update', entityType:'listing', entityId:adminListings[0].id, createdAt:'2026-10-14T12:00:00Z', metadata:{} }], nextCursor:null },
    '/api/branding': branding, '/api/listings': { items: listings, total: listings.length, nextCursor: null },
    '/api/collections': collections, '/api/reviews': reviews, '/api/stats': { available: 4, sold: 12, views: 240 },
    '/api/catalog/makes': [ref('bmw', 'BMW'), ref('audi', 'Audi')], '/api/catalog/models': examples.map(([make,makeName,model,modelName]) => ({ ...ref(model,modelName), makeId: make })),
    '/api/catalog/options': [], '/api/catalog/tags': [], '/api/catalog/body-types': [ref('sedan','Седан')],
    '/api/catalog/fuel-types': [ref('petrol','Бензин')], '/api/catalog/transmissions': [ref('automatic','Автомат')], '/api/catalog/drive-types': [ref('awd','Повний')], '/api/catalog/colors': [ref('grey','Сірий')],
  };
  const listing = listings.find((item) => url.pathname === `/api/listings/${item.slug}`);
  const collection = collections.find((item) => url.pathname === `/api/collections/${item.key}`);
  if (url.pathname === '/api/listings' && url.searchParams.get('q') === '__empty') { res.writeHead(200, {'content-type':'application/json'});res.end(JSON.stringify({items:[],total:0,nextCursor:null}));return; }
  const adminListing = adminListings.find(item=>url.pathname===`/api/admin/listings/${item.id}`);
  const extra = /\/(notes|telegram-posts)$/.test(url.pathname) ? [] : undefined;
  const data = endpoints[url.pathname] ?? listing ?? collection ?? adminListing ?? extra;
  res.writeHead(data ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(data ?? { message: 'Fixture endpoint not found' }));
});
server.listen(port, 'localhost', () => process.stdout.write(`Read-only homepage fixture API: http://localhost:${port}/api\n`));
