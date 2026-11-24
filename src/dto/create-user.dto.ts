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

  /**
   * Only with `forcePasswordChangeOnFirstLogin`: overrides whether the user
   * must change its password at the next login. Defaults to true on create
   * and on a password reset by someone else; ignored when the option is off.
   */
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
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

  /**
   * Only with `forcePasswordChangeOnFirstLogin`: overrides whether the user
   * must change its password at the next login. Defaults to true on create
   * and on a password reset by someone else; ignored when the option is off.
   */
  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
