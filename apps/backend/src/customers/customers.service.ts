import type { CreateCustomerDto, QueryCustomerDto } from '@app/contracts';
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { toCustomerSummary } from '../mappers/customer.mapper';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
    constructor(private readonly repo: CustomersRepository) { }

    async create(dto: CreateCustomerDto) {
        const existing = await this.repo.findByCode(dto.code);
        if (existing) {
            throw new ConflictException('Customer code already exists');
        }

        return this.repo.create(dto);
    }

    async findAll(query: QueryCustomerDto) {
        const customers = await this.repo.findMany({
        });

        return customers.map(toCustomerSummary);
    }


    async findOne(id: string) {
        const customer = await this.repo.findById(id);
        if (!customer) {
            throw new NotFoundException('Customer not found');
        }
        return customer;
    }

    async deactivate(id: string) {
        await this.findOne(id);
        return this.repo.update(id, { isActive: false });
    }
}
