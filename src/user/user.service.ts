import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, RefreshSession } from './schemas/user.schema';
import { hasher } from 'src/config/hasher';
import { UpdateUserDto } from './DTOs/user.dto';
import type { SafeUserProfile } from './DTOs/user.dto';
import { SupabaseStorageService } from './supabase-storage.service';
import sharp from 'sharp';
import { Course, CourseDocument } from 'src/course/schemas/course.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
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
      user = await this.userModel.findOne({ _id: identifier }).select('+authVersion');
    } else {
      user = await this.userModel.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      }).select('+authVersion');
    }

    return user;
  }

  async create({
    firstName,
    lastName,
    email,
    password,
  }: {
    firstName?: string;
    lastName?: string;
    email: string;
    password: string;
  }) {
    const passHash = await hasher.hash(password);

    return this.userModel.create({
      firstName,
      lastName,
      email,
      passwordHash: passHash,
    });
  }

  async addRefreshSession(userId: string, session: RefreshSession, authVersion: number) {
    const result = await this.userModel.updateOne(
      { _id: userId, authVersion: authVersion === 0 ? { $in: [0, null] } : authVersion },
      { $push: { refreshSessions: { $each: [session], $slice: -10 } } },
    );
    if (result.modifiedCount !== 1) throw new UnauthorizedException('Account credentials changed. Log in again.');
  }

  async rotateRefreshSession(userId: string, previousHash: string, session: RefreshSession, authVersion: number) {
    const result = await this.userModel.updateOne(
      { _id: userId, authVersion: authVersion === 0 ? { $in: [0, null] } : authVersion, refreshSessions: { $elemMatch: { tokenHash: previousHash, expiresAt: { $gt: new Date() } } } },
      { $set: { 'refreshSessions.$': session } },
    );
    if (result.modifiedCount !== 1) throw new UnauthorizedException('Refresh token expired, revoked, or already used');
  }

  async revokeRefreshSession(userId: string, tokenHash: string) {
    await this.userModel.updateOne({ _id: userId }, { $pull: { refreshSessions: { tokenHash } } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId);
    if (!user?.passwordHash || !(await hasher.verify(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (await hasher.verify(newPassword, user.passwordHash)) throw new BadRequestException('Choose a different new password');
    const passwordHash = await hasher.hash(newPassword);
    const result = await this.userModel.updateOne(
      { _id: userId, passwordHash: user.passwordHash },
      { $set: { passwordHash, refreshSessions: [] }, $inc: { authVersion: 1 } },
    );
    if (result.modifiedCount !== 1) throw new UnauthorizedException('Account credentials changed. Log in again.');
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
  private formatProfile(user: User & { _id: Types.ObjectId }): SafeUserProfile {
    return {
      _id: user._id.toString(),
      username: user.username,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
      avatarUrl: user.avatarUrl,
      favorites: user.favorites.map(id => id.toString()),
      isVerified: user.isVerified,
      avatarUploadEnabled: this.supabaseStorage.isConfigured,
    };
  }


  async findByIdSafe(userId: string): Promise<SafeUserProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel
      .findById(userId)
      .select('-passwordHash -authVersion -refreshSessions -__v')
      .lean();

    if (!user) throw new NotFoundException('User not found');
    return this.formatProfile(user);
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

    return this.formatProfile(updated);
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

    return this.formatProfile(updated);
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

    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    if (course.creatorId.toString() !== userId && !course.admins.some(id => id.toString() === userId) && !course.students.some(id => id.toString() === userId)) {
      throw new BadRequestException('Course membership required');
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
