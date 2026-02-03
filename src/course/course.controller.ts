import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';

@Controller('courses')
export class CourseController {
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any) {
    console.log('muhehe');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserCourses() {}

  @Get(':id')
  async getOne(@Param(':id') id: string) {}

  @Patch(':id')
  async update(@Param(':id') id: string) {}

  @Delete(':id')
  async remove(@Param(':id') id: string) {}
}
