import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { type PaginationDto } from 'src/common/DTOs/paginationDto';

@Controller('courses')
export class CourseController {
  @Post()
  async create() {}

  @Get()
  async getAll(@Query() paginationDto: PaginationDto) {}

  @Get(':id')
  async getOne(@Param(':id') id: string) {}

  @Patch(':id')
  async update(@Param(':id') id: string) {}

  @Delete(':id')
  async remove(@Param(':id') id: string) {}
}
