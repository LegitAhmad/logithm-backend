import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserController } from './user.controller';
import { SupabaseStorageService } from './supabase-storage.service';
import { Course, CourseSchema } from 'src/course/schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  providers: [UserService, SupabaseStorageService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
