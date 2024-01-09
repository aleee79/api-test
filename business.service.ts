import {
  DeepPartial,
  DeleteResult,
  ObjectLiteral,
  QueryRunner,
  Repository,
  SaveOptions,
  UpdateResult,
} from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export class BusinessService<Entity extends ObjectLiteral> {
  Record: any;

  constructor(private repository: Repository<any>) {
    this.Record = this.repository.target;
  }

  async saveTransactional(
    entity: DeepPartial<Entity>,
    user: User,
    queryRunner: QueryRunner,
    options: SaveOptions = {},
  ): Promise<Entity> {
    const record = new this.Record();
    if (user) {
      record.createdById = user.id;
      record.createdBy = user;
    }
    for (const [key, value] of Object.entries(entity)) {
      if (value !== undefined) {
        record[key] = value;
      }
    }

    try {
      return await queryRunner.manager.save(record, options);
    } catch (e) {
      if (e.code === '23505') {
        throw new ConflictException(e.message);
      } else {
        throw new InternalServerErrorException(e.message);
      }
    }
  }

  async assertOrFail(id: number, ...fields: string[]): Promise<Entity> {
    const record = this.repository.findOne({
      where: { id },
      select: ['id', ...fields],
    });
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  async findOneById(id: number, ...relations: string[]): Promise<Entity> {
    const record = await this.repository.findOne({ where: { id }, relations });
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  async softDelete(id: number) {
    const result = await this.repository.softDelete(id);
    this.checkAffected(result);
  }

  checkAffected(result: UpdateResult | DeleteResult) {
    if (!result.affected) {
      throw new NotFoundException(`not found`);
    }
  }

  async assertByIdAndUser(id: number, createdById: number) {
    const record = await this.repository.findOne({
      where: { id, createdById },
    });
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  async updateByIdTransactional(
    id: number,
    updateData: DeepPartial<Entity>,
    user: User,
    queryRunner: QueryRunner,
  ) {
    const record = new this.Record();
    record.id = id;
    if (user) {
      record.updatedById = user.id;
      record.updatedBy = user;
    }
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        record[key] = value;
      }
    }
    await this.assertOrFail(record.id);
    try {
      return await queryRunner.manager.save(record);
    } catch (e) {
      if (e.code === '23505') {
        throw new ConflictException(e.message);
      } else {
        throw new InternalServerErrorException(e.message);
      }
    }
  }
}
