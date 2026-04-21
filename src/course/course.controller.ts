/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
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
import { ZodValidationPipe } from 'nestjs-zod';
import { CourseService } from './course.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CoursePaginationDto,
  CourseResponseDto,
  CreateCourseDto,
  PaginatedCourseResponseDto,
  UpdateCourseDto,
} from './DTOs/course.dto';
import type { UserDto } from 'src/user/DTOs/user.dto';

@ApiTags('courses')
@ApiBearerAuth('jwt-auth')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  /**
   * Creates a new course.
   * Only authenticated users can create courses (they become the creator).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new course' })
  @ApiBody({ type: CreateCourseDto })
  @ApiResponse({
    status: 201,
    description: 'The course has been successfully created.',
    type: CourseResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Failed to create course' })
  async create(
    @Body() createCourseDto: CreateCourseDto,
    @CurrentUser() user: UserDto,
  ) {
    const course = await this.courseService.create(createCourseDto, user._id);

    if (!course) throw new ConflictException('Failed to create course');

    return CourseResponseDto.create(course.toObject());
  }

  /**
   * Retrieves courses associated with the current user.
   * Includes courses where the user is a creator, admin, or student.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all courses for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of courses.',
    type: PaginatedCourseResponseDto,
  })
  async getUserCourses(
    @CurrentUser() user: UserDto,
    @Query(new ZodValidationPipe(CoursePaginationDto))
    query: CoursePaginationDto,
  ): Promise<PaginatedCourseResponseDto> {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const courses = await this.courseService.getCoursesByUser(
      user._id,
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

  /**
   * Retrieves a single course by its ID.
   * The user must be the creator, an admin, or an enrolled student.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get course details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the course details.',
    type: CourseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 403, description: 'Forbidden access' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<CourseResponseDto> {
    const course = await this.courseService.getCourseById(id, user._id);
    if (!course) throw new NotFoundException();

    return CourseResponseDto.create(course.toObject());
  }

  /**
   * Updates course details.
   * Only the creator or admins can update the course.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update course details' })
  @ApiResponse({
    status: 200,
    description: 'The course has been successfully updated.',
    type: CourseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @CurrentUser() user: UserDto,
  ): Promise<CourseResponseDto> {
    const updatedCourse = await this.courseService.update(
      id,
      updateCourseDto,
      user._id,
    );

    if (!updatedCourse) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return CourseResponseDto.create(updatedCourse.toObject());
  }

  /**
   * Deletes a course.
   * Only the course creator can delete it.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a course' })
  @ApiResponse({ status: 204, description: 'Course deleted successfully' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 403, description: 'Only creator can delete' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ): Promise<void> {
    const deleted = await this.courseService.delete(id, user._id);

    if (!deleted) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
  }

  /**
   * Enrolls the current user in a course using a join code.
   */
  @Post('join')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join a course via code' })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined the course.',
    type: CourseResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invalid join code' })
  async joinByCode(@Body('code') code: string, @CurrentUser() user: UserDto) {
    if (!code) throw new BadRequestException('Join code is required');

    const course = await this.courseService.enrollByCode(code, user._id);
    return CourseResponseDto.create(course.toObject());
  }

  /**
   * Unenrolls the current user from a course.
   */
  @Delete(':id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Leave a course' })
  @ApiResponse({ status: 204, description: 'Successfully left the course' })
  async leave(@Param('id') id: string, @CurrentUser() user: UserDto) {
    await this.courseService.unenrollStudent(id, user._id);
  }

  /**
   * Adds a course to the user's favorites.
   */
  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Favorite a course' })
  @ApiResponse({ status: 201, description: 'Course favorited' })
  async favoriteCourse(@Param('id') id: string, @CurrentUser() user: UserDto) {
    return await this.courseService.favoriteCourse(id, user._id);
  }

  /**
   * Removes a course from the user's favorites.
   */
  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfavorite a course' })
  @ApiResponse({ status: 200, description: 'Course unfavorited' })
  async unfavoriteCourse(
    @Param('id') id: string,
    @CurrentUser() user: UserDto,
  ) {
    return await this.courseService.unfavoriteCourse(id, user._id);
  }

  // --- Administration Endpoints ---

  /**
   * Adds another user as an admin to the course.
   * Only the course creator can perform this action.
   */
  @Patch(':id/admins/add')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add an admin to the course' })
  @ApiResponse({ status: 200, description: 'Admin added successfully' })
  @ApiResponse({ status: 403, description: 'Only creator can add admins' })
  async addAdmin(
    @Param('id') id: string,
    @Body('userId') adminId: string,
    @CurrentUser() user: UserDto,
  ) {
    return await this.courseService.addAdmin(id, adminId, user._id);
  }

  /**
   * Removes an admin from the course.
   * Only the course creator can perform this action.
   */
  @Delete(':id/admins/:adminId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove an admin from the course' })
  @ApiResponse({ status: 200, description: 'Admin removed successfully' })
  async removeAdmin(
    @Param('id') id: string,
    @Param('adminId') adminId: string,
    @CurrentUser() user: UserDto,
  ) {
    return await this.courseService.removeAdmin(id, adminId, user._id);
  }
}
