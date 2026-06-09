export declare class CreateUserDto {
    email: string;
    password: string;
    name: string;
    role?: string;
    permissions?: string[];
}
export declare class UpdateUserDto {
    email?: string;
    name?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
    permissions?: string[];
}
