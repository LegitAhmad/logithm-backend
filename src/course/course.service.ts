import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Course, CourseDocument } from './schemas/course.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateCourseDto, UpdateCourseDto } from './DTOs/course.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
  ) {}

  private async generateUniqueJoinCode(): Promise<string> {
    let code = '';
    let isUnique = false;
    let attempts = 0;

    // Try generating a code until we find one that doesn't exist
    while (!isUnique && attempts < 10) {
      code = randomBytes(4).toString('hex').toUpperCase(); // e.g., 'A1B2C3D4'
      const existing = await this.courseModel
        .findOne({ joinCode: code })
        .select('_id')
        .lean();

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException(
        'Could not generate a unique join code. Please try again.',
      );
    }

    return code;
  }

  async create(
    dto: CreateCourseDto,
    creatorId: string,
  ): Promise<CourseDocument> {
    const joinCode = await this.generateUniqueJoinCode();

    const newCourse = new this.courseModel({
      ...dto,
      creator: creatorId,
      joinCode,
      admins: [creatorId],
    });

    return newCourse.save();
  }

  async getCoursesByUser(userId: string, limit: number, offset: number) {
    return this.courseModel
      .find({ owner: userId })
      .select('-assignments -students')
      .skip(offset)
      .limit(limit)
      .exec();
  }

  async getCourseById(id: string) {
    return this.courseModel.findById(id).exec();
  }
  async update(
    id: string,
    updateData: UpdateCourseDto,
  ): Promise<CourseDocument | null> {
    // { new: true } returns the updated document instead of the old one
    return this.courseModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.courseModel.findByIdAndDelete(id).exec();

    // Returns true if something was deleted, false if the ID didn't exist
    return !!result;
  }

  async enrollByCode(joinCode: string, userId: string) {
    const course = await this.courseModel.findOneAndUpdate(
      { joinCode: joinCode.toUpperCase() },
      { $addToSet: { students: userId } },
      { new: true },
    );

    if (!course) {
      throw new NotFoundException(`Invalid join code: ${joinCode}`);
    }

    return course;
  }

  async unenrollStudent(courseId: string, userId: string) {
    const course = await this.courseModel.findByIdAndUpdate(
      courseId,
      { $pull: { students: userId } },
      { new: true },
    );

    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async addAdmin(courseId: string, targetUserId: string, requesterId: string) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    // Only the owner (creator) can add admins
    if (course.creatorId.toString() !== requesterId) {
      throw new ForbiddenException('Only the course creator can add admins');
    }

    const target = new Types.ObjectId(targetUserId);
    course.admins.push(target);
    return await course.save();
  }

  async removeAdmin(
    courseId: string,
    targetUserId: string,
    requesterId: string,
  ) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    // Only the owner can remove admins
    if (course.creatorId.toString() !== requesterId) {
      throw new ForbiddenException('Only the course creator can manage admins');
    }

    // Prevent the creator from accidentally removing themselves if they are in the admin list
    if (targetUserId === course.creatorId.toString()) {
      throw new BadRequestException(
        'The creator cannot be removed from admins',
      );
    }

    await this.courseModel.updateOne(
      { _id: courseId },
      { $pull: { admins: targetUserId } },
    );

    return { success: true };
  }
}
