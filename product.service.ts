import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateProductRequestDto } from '../dto/requests/create-product.request.dto';
import { User } from '../../user/entities/user.entity';
import { BusinessService } from '../../base/business.service';
import { Product } from '../entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FindPaginationAdminUserDto } from '../dto/requests/find-all-pagination.request.dto';
import { paginate } from '../../common/paginate';
import { ProductFindAllResponseDto } from '../dto/responses/product-find-all.response.dto';
import { UpdateProductRequestDto } from '../dto/requests/update-product.request.dto';

@Injectable()
export class ProductService extends BusinessService<Product> {
  constructor(
    @InjectRepository(Product)
    readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {
    super(productRepository);
  }

  async create(createProductDto: CreateProductRequestDto, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const product = await this.saveTransactional(
        createProductDto,
        user,
        queryRunner,
      );
      await queryRunner.commitTransaction();
      return product;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getAll(findAllDto: FindPaginationAdminUserDto, user?: User) {
    const { page, pageSize, search, sortBy, isDesc, createdByMe } = findAllDto;

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.createdBy', 'user')
      .addSelect('user.fullName');

    if (createdByMe && user) {
      query.andWhere('product.createdById =:userId', { userId: user.id });
    } else if (createdByMe && !user) {
      throw new UnauthorizedException();
    }

    if (search) {
      query.andWhere('product.title LIKE :search', { search: `%${search}%` });
    }

    return paginate(
      query,
      { page, pageSize },
      {
        isDesc: isDesc,
        sortBy: sortBy ? `product.${sortBy}` : 'product.createdAt',
      },
      ProductFindAllResponseDto,
    );
  }

  async getOne(id: number) {
    return await this.findOneById(id, 'createdBy');
  }

  async update(
    id: number,
    updateProductDto: UpdateProductRequestDto,
    user: User,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.assertByIdAndUser(id, user.id);
      await this.updateByIdTransactional(
        id,
        updateProductDto,
        user,
        queryRunner,
      );
      await queryRunner.commitTransaction();
      return this.findOneById(id, 'createdBy');
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: number, user: User) {
    await this.assertByIdAndUser(id, user.id);
    return await this.softDelete(id);
  }
}
