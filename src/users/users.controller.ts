import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { KcJwtAuthGuard } from '../guards/jwt-auth.guard';
import { KcRolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { KcUsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from '../dto/create-user.dto';

@Controller('users')
@UseGuards(KcJwtAuthGuard, KcRolesGuard)
@Roles('admin')
export class KcUsersController {
  constructor(private readonly usersService: KcUsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto.email, dto.password, dto.name, dto.role, dto.permissions, dto.tenantId, dto.profileId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  /** Logical removal by default: deactivates the user, never deletes the row. */
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.user.id);
  }
}
