import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource, IsNull } from 'typeorm';
import { adminDataSourceOptions } from '../data-source';
import { ALL_ENTITIES } from '../entities';
import { Make } from '../../modules/catalog/entities/make.entity';
import { Model } from '../../modules/catalog/entities/model.entity';
import { BodyType } from '../../modules/catalog/entities/body-type.entity';
import { FuelType } from '../../modules/catalog/entities/fuel-type.entity';
import { Transmission } from '../../modules/catalog/entities/transmission.entity';
import { DriveType } from '../../modules/catalog/entities/drive-type.entity';
import { Color } from '../../modules/catalog/entities/color.entity';
import { VehicleOption } from '../../modules/catalog/entities/vehicle-option.entity';
import { SiteSettings } from '../../modules/branding/entities/site-settings.entity';
import { AdminUser } from '../../modules/admin-users/entities/admin-user.entity';
import { Listing } from '../../modules/listings/entities/listing.entity';
import { ListingOption } from '../../modules/listings/entities/listing-option.entity';

loadDotenv();

const makes = [
  { slug: 'bmw', nameUk: 'BMW', nameEn: 'BMW' },
  { slug: 'audi', nameUk: 'Audi', nameEn: 'Audi' },
  { slug: 'mercedes-benz', nameUk: 'Mercedes-Benz', nameEn: 'Mercedes-Benz' },
  { slug: 'volkswagen', nameUk: 'Volkswagen', nameEn: 'Volkswagen' },
  { slug: 'toyota', nameUk: 'Toyota', nameEn: 'Toyota' },
  { slug: 'tesla', nameUk: 'Tesla', nameEn: 'Tesla' },
];

const modelsByMake: Record<string, Array<{ slug: string; nameUk: string }>> = {
  bmw: [
    { slug: '3-series', nameUk: '3 Series' },
    { slug: '5-series', nameUk: '5 Series' },
    { slug: 'x5', nameUk: 'X5' },
  ],
  audi: [
    { slug: 'a4', nameUk: 'A4' },
    { slug: 'a6', nameUk: 'A6' },
    { slug: 'q5', nameUk: 'Q5' },
  ],
  'mercedes-benz': [
    { slug: 'c-class', nameUk: 'C-Class' },
    { slug: 'e-class', nameUk: 'E-Class' },
    { slug: 'glc', nameUk: 'GLC' },
  ],
  volkswagen: [
    { slug: 'passat', nameUk: 'Passat' },
    { slug: 'tiguan', nameUk: 'Tiguan' },
  ],
  toyota: [
    { slug: 'camry', nameUk: 'Camry' },
    { slug: 'rav4', nameUk: 'RAV4' },
  ],
  tesla: [
    { slug: 'model-3', nameUk: 'Model 3' },
    { slug: 'model-y', nameUk: 'Model Y' },
  ],
};

const bodyTypes = [
  { slug: 'sedan', nameUk: 'Седан', nameEn: 'Sedan' },
  { slug: 'wagon', nameUk: 'Універсал', nameEn: 'Wagon' },
  { slug: 'suv', nameUk: 'Позашляховик', nameEn: 'SUV' },
  { slug: 'hatchback', nameUk: 'Хетчбек', nameEn: 'Hatchback' },
  { slug: 'coupe', nameUk: 'Купе', nameEn: 'Coupe' },
  { slug: 'minivan', nameUk: 'Мінівен', nameEn: 'Minivan' },
];
const fuelTypes = [
  { slug: 'petrol', nameUk: 'Бензин', nameEn: 'Petrol' },
  { slug: 'diesel', nameUk: 'Дизель', nameEn: 'Diesel' },
  { slug: 'hybrid', nameUk: 'Гібрид', nameEn: 'Hybrid' },
  { slug: 'electric', nameUk: 'Електро', nameEn: 'Electric' },
  { slug: 'lpg', nameUk: 'Газ/бензин', nameEn: 'LPG' },
];
const transmissions = [
  { slug: 'manual', nameUk: 'Механіка', nameEn: 'Manual' },
  { slug: 'automatic', nameUk: 'Автомат', nameEn: 'Automatic' },
  { slug: 'robot', nameUk: 'Робот', nameEn: 'Robotised' },
  { slug: 'cvt', nameUk: 'Варіатор', nameEn: 'CVT' },
];
const driveTypes = [
  { slug: 'fwd', nameUk: 'Передній', nameEn: 'FWD' },
  { slug: 'rwd', nameUk: 'Задній', nameEn: 'RWD' },
  { slug: 'awd', nameUk: 'Повний', nameEn: 'AWD' },
];
const colors = [
  { slug: 'black', nameUk: 'Чорний', nameEn: 'Black', hex: '#0B0B0F' },
  { slug: 'white', nameUk: 'Білий', nameEn: 'White', hex: '#F5F5F0' },
  { slug: 'silver', nameUk: 'Срібний', nameEn: 'Silver', hex: '#BCC0C5' },
  { slug: 'grey', nameUk: 'Сірий', nameEn: 'Grey', hex: '#6E7479' },
  { slug: 'red', nameUk: 'Червоний', nameEn: 'Red', hex: '#B11030' },
  { slug: 'blue', nameUk: 'Синій', nameEn: 'Blue', hex: '#1E40AF' },
];
const options: Array<{
  slug: string;
  nameUk: string;
  nameEn: string;
  category: VehicleOption['category'];
}> = [
  { slug: 'leather', nameUk: 'Шкіряний салон', nameEn: 'Leather interior', category: 'interior' },
  { slug: 'climate', nameUk: 'Клімат-контроль', nameEn: 'Climate control', category: 'comfort' },
  { slug: 'cruise', nameUk: 'Круїз-контроль', nameEn: 'Cruise control', category: 'comfort' },
  { slug: 'heated-seats', nameUk: 'Підігрів сидінь', nameEn: 'Heated seats', category: 'comfort' },
  { slug: 'camera-360', nameUk: 'Камера 360°', nameEn: '360 camera', category: 'safety' },
  { slug: 'parking-sensors', nameUk: 'Парктроніки', nameEn: 'Parking sensors', category: 'safety' },
  {
    slug: 'apple-carplay',
    nameUk: 'Apple CarPlay',
    nameEn: 'Apple CarPlay',
    category: 'multimedia',
  },
  { slug: 'android-auto', nameUk: 'Android Auto', nameEn: 'Android Auto', category: 'multimedia' },
  {
    slug: 'panoramic-roof',
    nameUk: 'Панорамний дах',
    nameEn: 'Panoramic roof',
    category: 'exterior',
  },
  { slug: 'led-headlights', nameUk: 'LED-фари', nameEn: 'LED headlights', category: 'exterior' },
];

async function upsertCatalog(ds: DataSource) {
  const makeRepo = ds.getRepository(Make);
  const modelRepo = ds.getRepository(Model);
  const byMakeSlug = new Map<string, Make>();

  for (const m of makes) {
    let row = await makeRepo.findOne({ where: { slug: m.slug } });
    if (!row) row = await makeRepo.save(makeRepo.create(m));
    byMakeSlug.set(m.slug, row);
  }
  for (const [makeSlug, mods] of Object.entries(modelsByMake)) {
    const make = byMakeSlug.get(makeSlug);
    if (!make) continue;
    for (const m of mods) {
      const existing = await modelRepo.findOne({ where: { slug: m.slug, makeId: make.id } });
      if (!existing) await modelRepo.save(modelRepo.create({ ...m, makeId: make.id }));
    }
  }
  await upsertSimple(ds.getRepository(BodyType), bodyTypes);
  await upsertSimple(ds.getRepository(FuelType), fuelTypes);
  await upsertSimple(ds.getRepository(Transmission), transmissions);
  await upsertSimple(ds.getRepository(DriveType), driveTypes);
  await upsertSimple(ds.getRepository(Color), colors);
  await upsertSimple(ds.getRepository(VehicleOption), options);
}

async function upsertSimple<T extends { slug: string }>(
  repo: ReturnType<DataSource['getRepository']>,
  rows: T[],
): Promise<void> {
  for (const row of rows) {
    const existing = await repo.findOne({ where: { slug: row.slug } });
    if (!existing) await repo.save(repo.create(row));
  }
}

async function ensureSiteSettings(ds: DataSource) {
  const settings = ds.getRepository(SiteSettings);
  const existing = await settings.findOne({ where: { deletedAt: IsNull() } });
  if (existing) return;
  await settings.save(
    settings.create({
      displayName: 'AutoFlow',
      tagline: 'Кураторська вітрина авто',
      primaryColor: '#0F172A',
      accentColor: '#2563EB',
      contactPhone: '+380 44 123 45 67',
      contactEmail: 'sales@autoflow.example',
      address: 'Київ',
      workingHours: {
        mon_fri: { open: '09:00', close: '19:00' },
        sat: { open: '10:00', close: '17:00' },
      },
      socialLinks: { instagram: 'https://instagram.com/example' },
      seoDefaults: {
        titleTemplate: '%s — AutoFlow',
        description: 'Кураторська вітрина перевірених автомобілів',
      },
      defaultCurrency: 'USD',
    }),
  );
  console.log('Seeded site settings');
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function ensureAdminUsers(ds: DataSource) {
  const users = ds.getRepository(AdminUser);

  // The initial admin comes from env. In production a password MUST be supplied
  // (no fixed well-known credential); in dev we fall back to a demo password.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@autoflow.example').toLowerCase();
  let adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    if (IS_PRODUCTION) {
      throw new Error('SEED_ADMIN_PASSWORD is required to seed the admin in production');
    }
    adminPassword = 'Demo!Password12345';
  }

  const accounts: Array<{ email: string; role: 'admin' | 'editor'; password: string }> = [
    { email: adminEmail, role: 'admin', password: adminPassword },
  ];
  // A demo editor with a well-known password is dev-only.
  if (!IS_PRODUCTION) {
    accounts.push({
      email: 'editor@autoflow.example',
      role: 'editor',
      password: 'Demo!Password12345',
    });
  }

  for (const account of accounts) {
    const exists = await users.findOne({ where: { email: account.email, deletedAt: IsNull() } });
    if (exists) continue;
    const passwordHash = await argon2.hash(account.password, { type: argon2.argon2id });
    await users.save(
      users.create({ email: account.email, role: account.role, passwordHash, isActive: true }),
    );
    const shown = IS_PRODUCTION ? '(from SEED_ADMIN_PASSWORD)' : `(password: ${account.password})`;
    console.log(`Seeded ${account.role} ${account.email} ${shown}`);
  }
}

async function ensureDemoListings(ds: DataSource) {
  const listings = ds.getRepository(Listing);
  const existing = await listings.count();
  if (existing > 0) return;

  const makeBySlug = (slug: string) => ds.getRepository(Make).findOneOrFail({ where: { slug } });
  const modelBySlug = (slug: string) => ds.getRepository(Model).findOneOrFail({ where: { slug } });
  const refBySlug = <T extends { slug: string }>(
    repo: ReturnType<DataSource['getRepository']>,
    slug: string,
  ) => repo.findOneOrFail({ where: { slug } as unknown as T });

  const bmw = await makeBySlug('bmw');
  const bmw5 = await modelBySlug('5-series');
  const audi = await makeBySlug('audi');
  const audiA6 = await modelBySlug('a6');
  const sedan = await refBySlug(ds.getRepository(BodyType), 'sedan');
  const suv = await refBySlug(ds.getRepository(BodyType), 'suv');
  const petrol = await refBySlug(ds.getRepository(FuelType), 'petrol');
  const auto = await refBySlug(ds.getRepository(Transmission), 'automatic');
  const awd = await refBySlug(ds.getRepository(DriveType), 'awd');
  const black = await refBySlug(ds.getRepository(Color), 'black');
  const white = await refBySlug(ds.getRepository(Color), 'white');
  const leather = await refBySlug(ds.getRepository(VehicleOption), 'leather');
  const cruise = await refBySlug(ds.getRepository(VehicleOption), 'cruise');

  const demos = [
    {
      make: bmw,
      model: bmw5,
      year: 2021,
      title: 'BMW 5 Series 530i xDrive 2021',
      description: 'Один власник, повна історія обслуговування, без ДТП.',
      price: 38500,
      currency: 'USD' as const,
      bodyType: sedan,
      color: black,
      mileage: 42000,
      powerHp: 248,
      engineVolumeL: '2.0',
      city: 'Київ',
      options: [leather, cruise],
    },
    {
      make: audi,
      model: audiA6,
      year: 2020,
      title: 'Audi A6 45 TFSI quattro 2020',
      description: 'Офіційний дилерський автомобіль, перший власник.',
      price: 33900,
      currency: 'USD' as const,
      bodyType: suv,
      color: white,
      mileage: 56000,
      powerHp: 245,
      engineVolumeL: '2.0',
      city: 'Львів',
      options: [leather],
    },
  ];

  for (const demo of demos) {
    const listing = listings.create({
      slug: `${demo.make.slug}-${demo.model.slug}-${demo.year}-demo`,
      status: 'published',
      makeId: demo.make.id,
      modelId: demo.model.id,
      year: demo.year,
      mileageKm: demo.mileage,
      bodyTypeId: demo.bodyType.id,
      fuelTypeId: petrol.id,
      transmissionId: auto.id,
      driveTypeId: awd.id,
      colorId: demo.color.id,
      engineVolumeL: demo.engineVolumeL,
      powerHp: demo.powerHp,
      condition: 'used',
      ownersCount: 1,
      isCrashed: false,
      customsCleared: true,
      priceAmount: demo.price.toFixed(2),
      priceCurrency: demo.currency,
      priceNormalized: demo.price.toFixed(2),
      fxRate: '1.000000',
      fxRateAt: new Date(),
      isNegotiable: true,
      title: demo.title,
      description: demo.description,
      locationCity: demo.city,
      locationRegion: 'Україна',
      publishedAt: new Date(),
      sourceType: 'manual',
    });
    const saved = await listings.save(listing);
    if (demo.options.length) {
      const linkRepo = ds.getRepository(ListingOption);
      await linkRepo.save(
        demo.options.map((opt) => linkRepo.create({ listingId: saved.id, optionId: opt.id })),
      );
    }
    // No seed media: a phantom S3 key would render as a broken image. Real
    // media is added through the admin upload flow. Cards/gallery show a clean
    // placeholder when a listing has no processed media.
  }
  console.log(`Seeded ${demos.length} demo listings`);
}

async function main() {
  const ds = new DataSource({ ...adminDataSourceOptions, entities: ALL_ENTITIES });
  await ds.initialize();
  try {
    await upsertCatalog(ds);
    await ensureSiteSettings(ds);
    await ensureAdminUsers(ds);
    // Demo listings/media are dev-only fixtures; never seed them into production.
    if (!IS_PRODUCTION) {
      await ensureDemoListings(ds);
    }
    console.log('Seeds complete.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
