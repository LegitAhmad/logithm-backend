import { Test, TestingModule } from '@nestjs/testing';
import { CourseService } from './course.service';
import { getModelToken } from '@nestjs/mongoose';
import { Course } from './schemas/course.schema';
import { User } from 'src/user/schemas/user.schema';
import { Types } from 'mongoose';

describe('CourseService', () => {
  let service: CourseService;
  let courseModel: any;
  let userModel: any;

  beforeEach(async () => {
    courseModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      save: jest.fn(),
    };

    userModel = {
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        {
          provide: getModelToken(Course.name),
          useValue: courseModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<CourseService>(CourseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCoursesByUser', () => {
    it('should return courses where user is creator, admin or student', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockCourses = [{ toObject: () => ({ name: 'Course 1' }) }];
      
      courseModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockCourses),
            }),
          }),
        }),
      });

      const result = await service.getCoursesByUser(userId, 10, 0);

      expect(courseModel.find).toHaveBeenCalledWith({
        $or: [
          { creatorId: new Types.ObjectId(userId) },
          { admins: new Types.ObjectId(userId) },
          { students: new Types.ObjectId(userId) },
        ],
      });
      expect(result).toEqual(mockCourses);
    });
  });

  describe('getCourseById', () => {
    it('should return course if requester is a student', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId('507f1f77bcf86cd799439013'),
        admins: [],
        students: [new Types.ObjectId(userId)],
        toObject: () => ({ name: 'Test Course' }),
      };

      courseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCourse),
      });

      const result = await service.getCourseById(courseId, userId);

      expect(result).toEqual(mockCourse);
    });

    it('should throw ForbiddenException if requester is not enrolled', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId('507f1f77bcf86cd799439013'),
        admins: [],
        students: [],
      };

      courseModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCourse),
      });

      await expect(service.getCourseById(courseId, userId)).rejects.toThrow(
        'Only enrolled students and teachers can view this course',
      );
    });
  });

  describe('update', () => {
    it('should update course if requester is creator', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId(userId),
        admins: [],
      };
      const updateData = { name: 'Updated Name' };

      courseModel.findById.mockResolvedValue(mockCourse);
      courseModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockCourse, ...updateData }),
      });

      const result = await service.update(courseId, updateData, userId);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Name');
    });

    it('should throw ForbiddenException if requester is not creator or admin', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const otherUserId = '507f1f77bcf86cd799439013';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId(otherUserId),
        admins: [],
      };

      courseModel.findById.mockResolvedValue(mockCourse);

      await expect(service.update(courseId, {}, userId)).rejects.toThrow(
        'Only the course creator or admins can update course details',
      );
    });
  });

  describe('delete', () => {
    it('should delete course if requester is creator', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId(userId),
      };

      courseModel.findById.mockResolvedValue(mockCourse);
      courseModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCourse),
      });

      const result = await service.delete(courseId, userId);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if requester is not creator', async () => {
      const courseId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const adminId = '507f1f77bcf86cd799439013';
      const mockCourse = {
        _id: courseId,
        creatorId: new Types.ObjectId(adminId),
        admins: [new Types.ObjectId(userId)],
      };

      courseModel.findById.mockResolvedValue(mockCourse);

      await expect(service.delete(courseId, userId)).rejects.toThrow(
        'Only the course creator can delete it',
      );
    });
  });
});
