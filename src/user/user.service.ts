import { Injectable } from '@nestjs/common';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getUserByIdentifier(
    identifier: string,
    type: 'username' | 'email' | 'id',
  ) {
    let user: User | null = null;
    if (type === 'id') user = await this.userModel.findOne({ id: identifier });
    else if (type === 'email')
      user = await this.userModel.findOne({ email: identifier });
    else if (type === 'username')
      user = await this.userModel.findOne({ username: identifier });
    else throw new Error('An Invalid identifier type was just passed');

    return user;
  }
}
