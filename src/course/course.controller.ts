import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/utils/decorators/create-param.decorator';
import * as nestjsZod from 'nestjs-zod';
import { CourseService } from './course.service';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  CoursePaginationDto,
  CourseResponseDto,
  CreateCourseDto,
  PaginatedCourseResponseDto,
  UpdateCourseDto,
} from './DTOs/course.dto';
import { type UserDto } from 'src/user/DTOs/user.dto';

@ApiBearerAuth('jwt-auth')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateCourseDto })
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @CurrentUser() user: UserDto,
  ) {
    if (!user._id) throw new NotFoundException('User not found');
    const course = await this.courseService.create(createCourseDto, user._id);

    if (!course) throw new ConflictException('Failed to create course');

    const haha = CourseResponseDto.create(course.toObject());
    return haha;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserCourses(
    @CurrentUser() user: { sub: string },
    @Query(new nestjsZod.ZodValidationPipe(CoursePaginationDto))
    query: CoursePaginationDto,
  ): Promise<PaginatedCourseResponseDto> {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const courses = await this.courseService.getCoursesByUser(
      user.sub,
      limit,
      offset,
    );

    const cleanCourses = courses.map((course) =>
      CourseResponseDto.create(course.toObject()),
    );

    return {
      limit,
      offset,
      data: cleanCourses,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOne(@Param('id') id: string): Promise<CourseResponseDto> {
    const course = await this.courseService.getCourseById(id);
    if (!course) throw new NotFoundException();

    return CourseResponseDto.create(course.toObject());
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: CourseResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    const updatedCourse = await this.courseService.update(id, updateCourseDto);

    if (!updatedCourse) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return CourseResponseDto.create(updatedCourse);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Course deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    const deleted = await this.courseService.delete(id);

    if (!deleted) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async joinByCode(@Body('code') code: string, @CurrentUser() user: UserDto) {
    if (!code) throw new BadRequestException('Join code is required');

    const course = await this.courseService.enrollByCode(code, user._id);
    return CourseResponseDto.create(course.toObject());
  }

  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async leave(@Param('id') id: string, @CurrentUser() user: UserDto) {
    await this.courseService.unenrollStudent(id, user._id);
  }

  // --- Administration Endpoints ---

  @Patch(':id/admins/add')
  @UseGuards(JwtAuthGuard) // Suggestion: Add a custom 'IsCreatorGuard' here
  async addAdmin(
    @Param('id') id: string,
    @Body('userId') adminId: string,
    @CurrentUser() user: UserDto,
  ) {
    // Business logic: Only the owner should be able to add admins
    return await this.courseService.addAdmin(id, adminId, user._id);
  }

  @Delete(':id/admins/:adminId')
  @UseGuards(JwtAuthGuard)
  async removeAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @CurrentUser() user: UserDto,
  ) {
    return await this.courseService.removeAdmin(id, adminId, user._id);
  }
}
