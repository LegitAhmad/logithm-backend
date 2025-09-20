import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

@Controller('courses')
export class CourseController {
  @Post()
  async create() {}

  @Get()
  async getAll() {}

  @Get(':id')
  async getOne(@Param(':id') id: string) {}

  @Patch(':id')
  async update(@Param(':id') id: string) {}

  @Delete(':id')
  async remove(@Param(':id') id: string) {}
}
