import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { hasher } from 'src/config/hasher';
import { UpdateUserDto } from './DTOs/user.dto';
import { SupabaseStorageService } from './supabase-storage.service';
import sharp from 'sharp';
import { Course, CourseDocument } from 'src/course/schemas/course.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  /*
   * -------------------------------------
   * AUTH HELPERS (already existed)
   * -------------------------------------
   */

  async findByIdentifier(identifier: string): Promise<UserDocument | null> {
    let user: UserDocument | null = null;

    if (Types.ObjectId.isValid(identifier)) {
      user = await this.userModel.findOne({ _id: identifier });
    } else {
      user = await this.userModel.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      });
    }

    return user;
  }

  async create({ email, password }: { email: string; password: string }) {
    const passHash = await hasher.hash(password);

    return this.userModel.create({
      email,
      passwordHash: passHash,
    });
  }

  /*
   * -------------------------------------
   * PUBLIC PROFILE
   * -------------------------------------
   */

  async findPublicProfile(identifier: string) {
    const isObjectId = Types.ObjectId.isValid(identifier);

    const query = isObjectId ? { _id: identifier } : { username: identifier };

    const user = await this.userModel
      .findOne(query)
      .select('username firstName lastName bio avatarUrl createdAt')
      .lean();
    console.log(user);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
  /*
   * -------------------------------------
   * SELF USER METHODS
   * -------------------------------------
   */

  async findByIdSafe(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel
      .findById(userId)
      .select('-passwordHash -__v')
      .lean();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    if (!Object.keys(dto).length) {
      throw new BadRequestException('No fields provided');
    }

    if (dto.username) {
      const exists = await this.userModel.exists({
        username: dto.username,
        _id: { $ne: userId },
      });
      if (exists) throw new ConflictException('Username taken');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(userId, dto, {
        new: true,
        runValidators: true,
      })
      .select('-passwordHash -__v');

    if (!updated) throw new NotFoundException('User not found');

    return updated;
  }

  /*
   * -------------------------------------
   * AVATAR
   * -------------------------------------
   */

  async updateAvatar(userId: string, avatarUrl: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    if (!avatarUrl) {
      throw new BadRequestException('Avatar URL required');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { avatarUrl },
        { new: true, runValidators: true },
      )
      .select('-passwordHash -__v');

    if (!updated) throw new NotFoundException('User not found');

    return updated;
  }

  async uploadAvatar(
    userId: string,
    file?: { buffer: Buffer; mimetype: string },
  ) {
    console.log('[user.uploadAvatar] start', {
      userId,
      hasFile: Boolean(file),
      mimetype: file?.mimetype,
      size: file?.buffer?.length,
    });

    if (!Types.ObjectId.isValid(userId)) {
      console.log('[user.uploadAvatar] invalid user id', { userId });
      throw new BadRequestException('Invalid user id');
    }

    if (!file?.buffer) {
      console.log('[user.uploadAvatar] missing file buffer');
      throw new BadRequestException('Profile image is required');
    }

    if (!file.mimetype?.startsWith('image/')) {
      console.log('[user.uploadAvatar] invalid mimetype', {
        mimetype: file.mimetype,
      });
      throw new BadRequestException('Only image uploads are allowed');
    }

    let webpBuffer: Buffer;

    try {
      webpBuffer = await sharp(file.buffer)
        .rotate()
        .resize({
          width: 512,
          height: 512,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[user.uploadAvatar] image processing failed', {
        userId,
        message,
      });
      throw new BadRequestException('Invalid image file');
    }

    try {
      const avatarUrl = await this.supabaseStorage.uploadProfilePicture(
        userId,
        webpBuffer,
      );

      console.log('[user.uploadAvatar] uploaded image', { userId, avatarUrl });

      return this.updateAvatar(userId, avatarUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[user.uploadAvatar] upload/persist failed', {
        userId,
        message,
      });

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to upload avatar');
    }
  }

  async removeAvatar(userId: string) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatarUrl: null }, { new: true })
      .select('-passwordHash -__v');

    if (!updated) throw new NotFoundException('User not found');

    return updated;
  }

  async favoriteCourse(userId: string, courseId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new BadRequestException('Invalid course id');
    }

    const courseExists = await this.courseModel.exists({ _id: courseId });
    if (!courseExists) {
      throw new NotFoundException('Course not found');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { favorites: new Types.ObjectId(courseId) } },
        { new: true, runValidators: true },
      )
      .select('-passwordHash -__v');

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  /*
   * -------------------------------------
   * UTILITIES
   * -------------------------------------
   */

  async usernameAvailable(username: string): Promise<boolean> {
    const exists = await this.userModel.exists({ username });
    return !exists;
  }
}
