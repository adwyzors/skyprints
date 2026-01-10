// mapper/customer/customer.mapper.ts
import { CustomerDto } from "@/dto/customer/customer.dto";
import { Customer } from "@/model/customer.model";

export function mapCustomerDtoToModel(
  dto: CustomerDto
): Customer {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
  };
}

export function mapCustomerDtosToModels(
  dtos: CustomerDto[]
): Customer[] {
  return dtos.map(mapCustomerDtoToModel);
}
