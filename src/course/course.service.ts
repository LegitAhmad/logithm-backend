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
import { User, UserDocument } from 'src/user/schemas/user.schema';

export interface FavoriteCourseResponse {
  favorited: boolean;
  favorites: Types.ObjectId[];
}

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private async ensureUserCanFavoriteCourse(courseId: string, userId: string) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new BadRequestException('Invalid course id');
    }

    const course = await this.courseModel
      .findById(courseId)
      .select('creatorId admins students')
      .lean();

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const isCreator = course.creatorId.toString() === userId;
    const isAdmin = course.admins.some(
      (adminId) => adminId.toString() === userId,
    );
    const isStudent = course.students.some(
      (studentId) => studentId.toString() === userId,
    );

    if (!isCreator && !isAdmin && !isStudent) {
      throw new ForbiddenException(
        'Only enrolled students and teachers can favorite this course',
      );
    }
  }

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
      creatorId: creatorId,
      joinCode,
      admins: [creatorId],
    });

    return newCourse.save();
  }

  async getCoursesByUser(userId: string, limit: number, offset: number) {
    const v = await this.courseModel
      .find({ creatorId: new Types.ObjectId(userId) })
      .select('-assignments')
      .skip(offset)
      .limit(limit)
      .exec();
    return v;
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

  async favoriteCourse(
    courseId: string,
    userId: string,
  ): Promise<FavoriteCourseResponse> {
    await this.ensureUserCanFavoriteCourse(courseId, userId);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { favorites: new Types.ObjectId(courseId) } },
        { new: true },
      )
      .select('favorites')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      favorited: true,
      favorites: updatedUser.favorites as [],
    };
  }

  async unfavoriteCourse(
    courseId: string,
    userId: string,
  ): Promise<FavoriteCourseResponse> {
    await this.ensureUserCanFavoriteCourse(courseId, userId);

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { favorites: new Types.ObjectId(courseId) } },
        { new: true },
      )
      .select('favorites')
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      favorited: false,
      favorites: updatedUser.favorites as [],
    };
  }
}
