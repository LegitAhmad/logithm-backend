import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { hasher } from 'src/config/hasher';
import { UpdateUserDto } from './DTOs/user.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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

  async findPublicProfile(username: string) {
    const user = await this.userModel
      .findOne({ username })
      .select(
        'username name bio avatarUrl githubUrl linkedinUrl website createdAt',
      )
      .lean();

    if (!user) throw new NotFoundException('User not found');
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

  async removeAvatar(userId: string) {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatarUrl: null }, { new: true })
      .select('-passwordHash -__v');

    if (!updated) throw new NotFoundException('User not found');

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
