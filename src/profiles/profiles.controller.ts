import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { KcJwtAuthGuard } from '../guards/jwt-auth.guard';
import { KcRolesGuard } from '../roles/roles.guard';
import { KcProfilesService } from './profiles.service';
import {
  CreateProfileDto,
  SetProfilePermissionsDto,
  UpdateProfileDto,
} from '../dto/profile.dto';
import { KC_PROFILE_READ_PERMISSION, KC_PROFILE_WRITE_PERMISSION } from './profile.permissions';
import { Permissions } from '../roles/permissions.decorator';

/**
 * Profile administration. Guarded by its own permissions
 * (`auth.perfil:consultar` / `auth.perfil:alterar` by default) so a consuming
 * app decides who administers profiles; role 'admin' always passes.
 *
 * The permission names are fixed metadata, so they cannot be read from config
 * at decoration time. Override who holds them, not their names.
 */
@Controller('profiles')
@UseGuards(KcJwtAuthGuard, KcRolesGuard)
export class KcProfilesController {
  constructor(private readonly profilesService: KcProfilesService) {}

  @Get()
  @Permissions(KC_PROFILE_READ_PERMISSION)
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.profilesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Permissions(KC_PROFILE_READ_PERMISSION)
  findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }

  @Post()
  @Permissions(KC_PROFILE_WRITE_PERMISSION)
  create(@Body() dto: CreateProfileDto) {
    return this.profilesService.create(dto);
  }

  @Put(':id')
  @Permissions(KC_PROFILE_WRITE_PERMISSION)
  update(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(id, dto);
  }

  /** Logical removal: sets isActive = false. Profiles are never deleted. */
  @Delete(':id')
  @Permissions(KC_PROFILE_WRITE_PERMISSION)
  deactivate(@Param('id') id: string) {
    return this.profilesService.deactivate(id);
  }

  @Get(':id/permissions')
  @Permissions(KC_PROFILE_READ_PERMISSION)
  getPermissions(@Param('id') id: string) {
    return this.profilesService.getPermissions(id);
  }

  /** Replaces the whole matrix: a resource left out of the body is revoked. */
  @Put(':id/permissions')
  @Permissions(KC_PROFILE_WRITE_PERMISSION)
  setPermissions(@Param('id') id: string, @Body() dto: SetProfilePermissionsDto) {
    return this.profilesService.setPermissions(id, dto.permissions);
  }
}
