import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service';

import { BodyType } from './entities/body-type.entity';
import { Color } from './entities/color.entity';
import { DriveType } from './entities/drive-type.entity';
import { FuelType } from './entities/fuel-type.entity';
import { Make } from './entities/make.entity';
import { Model } from './entities/model.entity';
import { Transmission } from './entities/transmission.entity';
import { VehicleOption } from './entities/vehicle-option.entity';

const CACHE_PREFIX = 'catalog:';
const CACHE_TTL = 600;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Make) private readonly makes: Repository<Make>,
    @InjectRepository(Model) private readonly models: Repository<Model>,
    @InjectRepository(BodyType) private readonly bodies: Repository<BodyType>,
    @InjectRepository(FuelType) private readonly fuels: Repository<FuelType>,
    @InjectRepository(Transmission)
    private readonly transmissions: Repository<Transmission>,
    @InjectRepository(DriveType) private readonly drives: Repository<DriveType>,
    @InjectRepository(Color) private readonly colors: Repository<Color>,
    @InjectRepository(VehicleOption)
    private readonly options: Repository<VehicleOption>,
    private readonly redis: RedisService,
  ) {}

  async listMakes(): Promise<Make[]> {
    return this.cached('makes', () => this.makes.find({ order: { nameUk: 'ASC' } }));
  }

  async listModels(makeSlug?: string): Promise<Model[]> {
    return this.cached(`models:${makeSlug ?? 'all'}`, async () => {
      const qb = this.models
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.make', 'mk')
        .orderBy('mk.name_uk', 'ASC')
        .addOrderBy('m.name_uk', 'ASC');
      if (makeSlug) qb.where('mk.slug = :slug', { slug: makeSlug });
      return qb.getMany();
    });
  }

  listBodyTypes() {
    return this.cached('body_types', () => this.bodies.find({ order: { nameUk: 'ASC' } }));
  }
  listFuelTypes() {
    return this.cached('fuel_types', () => this.fuels.find({ order: { nameUk: 'ASC' } }));
  }
  listTransmissions() {
    return this.cached('transmissions', () =>
      this.transmissions.find({ order: { nameUk: 'ASC' } }),
    );
  }
  listDriveTypes() {
    return this.cached('drive_types', () => this.drives.find({ order: { nameUk: 'ASC' } }));
  }
  listColors() {
    return this.cached('colors', () => this.colors.find({ order: { nameUk: 'ASC' } }));
  }
  listOptions() {
    return this.cached('options', () =>
      this.options.find({ order: { category: 'ASC', nameUk: 'ASC' } }),
    );
  }

  async invalidate(): Promise<void> {
    const pattern = CACHE_PREFIX + '*';
    const stream = this.redis.client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length) await this.redis.client.del(...keys);
    }
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cacheKey = CACHE_PREFIX + key;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;
    const fresh = await loader();
    await this.redis.client.setex(cacheKey, CACHE_TTL, JSON.stringify(fresh));
    return fresh;
  }
}
