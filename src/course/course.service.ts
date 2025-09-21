import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class CourseService {
  constructor() {}
  async getAllByUser(userId: string) {}
}
