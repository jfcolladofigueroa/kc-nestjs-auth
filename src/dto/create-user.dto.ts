import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString, IsBoolean, IsArray, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  tenantId?: number;

  /** Profile to inherit permissions from. Omit or null for flat permissions. */
  @IsOptional()
  @IsInt()
  profileId?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @MinLength(8)
  password?: string;

  /** Profile to inherit permissions from. Send null to detach. */
  @IsOptional()
  @IsInt()
  profileId?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
