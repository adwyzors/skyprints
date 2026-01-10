// services/orders.service.ts
import { CustomerDtoSchema } from "@/dto/customer/customer.dto";
import { mapCustomerDtosToModels } from "@/mapper/customer/customer.mapper";
import { Customer } from "@/model/customer.model";
import { apiRequest } from "./api.service";

export async function getCustomers(): Promise<Customer[]> {
    const res = await apiRequest<unknown>("/customers");

    const dto = CustomerDtoSchema.array().parse(res);

    return mapCustomerDtosToModels(dto);
}
