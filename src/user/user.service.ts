import { Injectable } from '@nestjs/common';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { hasher } from 'src/config/hasher';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findByIdentifier(identifier: string) {
    let user = await this.userModel.findOne({
      $or: [{ username: identifier }, { email: identifier }],
    });
    if (!user) {
      user = await this.userModel.findOne({ _id: identifier });
    }

    return user;
  }

  async create({ email, password }: { email: string; password: string }) {
    const passHash = await hasher.hash(password);
    return await this.userModel.create({
      email,
      passwordHash: passHash,
    });
  }
}
