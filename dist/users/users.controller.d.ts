import { KcUsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from '../dto/create-user.dto';
export declare class KcUsersController {
    private readonly usersService;
    constructor(usersService: KcUsersService);
    findAll(): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        tenantId: any;
        permissions: string[];
        isActive: boolean;
        lastLoginAt: Date | undefined;
        createdAt: Date;
    }[]>;
    create(dto: CreateUserDto): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: string[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: string[];
        isActive: boolean;
    }>;
    remove(id: string, req: any): Promise<void>;
}
