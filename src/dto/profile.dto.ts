import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateProfileDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  tenantId?: number;

  /** Optional initial matrix, so a profile can be created in one call. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfilePermissionDto)
  permissions?: ProfilePermissionDto[];
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProfilePermissionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  resource!: string;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;
}

/** Body of `PUT /profiles/:id/permissions`: the complete matrix. */
export class SetProfilePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfilePermissionDto)
  permissions!: ProfilePermissionDto[];
}
