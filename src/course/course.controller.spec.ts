import { Test, TestingModule } from '@nestjs/testing';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';

describe('CourseController', () => {
  let controller: CourseController;
  let service: any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      getCoursesByUser: jest.fn(),
      getCourseById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      enrollByCode: jest.fn(),
      unenrollStudent: jest.fn(),
      favoriteCourse: jest.fn(),
      unfavoriteCourse: jest.fn(),
      addAdmin: jest.fn(),
      removeAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [
        {
          provide: CourseService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CourseController>(CourseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a course', async () => {
      const createCourseDto = {
        name: 'Test Course',
        description: 'Test Description',
        bannerUrl: 'http://banner.com',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      };
      const user = { _id: '507f1f77bcf86cd799439011' };
      const mockCourseData = {
        ...createCourseDto,
        _id: '507f1f77bcf86cd799439012',
        creatorId: '507f1f77bcf86cd799439011',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const mockCourse = {
        ...mockCourseData,
        toObject: jest.fn().mockReturnValue(mockCourseData),
      };

      service.create.mockResolvedValue(mockCourse);

      const result = await controller.create(createCourseDto as any, user as any);

      expect(service.create).toHaveBeenCalledWith(createCourseDto, user._id);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Course');
    });
  });

  describe('getUserCourses', () => {
    it('should return paginated courses', async () => {
      const user = { _id: '507f1f77bcf86cd799439011' };
      const query = { limit: 10, offset: 0 };
      const mockCourseData = {
        _id: '507f1f77bcf86cd799439012',
        name: 'Course 1',
        description: 'Desc 1',
        bannerUrl: '',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        creatorId: '507f1f77bcf86cd799439011',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const mockCourses = [
        {
          toObject: jest.fn().mockReturnValue(mockCourseData),
        },
      ];

      service.getCoursesByUser.mockResolvedValue(mockCourses);

      const result = await controller.getUserCourses(user as any, query as any);

      expect(service.getCoursesByUser).toHaveBeenCalledWith(user._id, 10, 0);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Course 1');
    });
  });

  describe('getOne', () => {
    it('should return a single course', async () => {
      const user = { _id: '507f1f77bcf86cd799439011' };
      const courseId = '507f1f77bcf86cd799439012';
      const mockCourseData = {
        _id: courseId,
        name: 'Test Course',
        description: 'Test Desc',
        bannerUrl: '',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        creatorId: '507f1f77bcf86cd799439011',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const mockCourse = {
        ...mockCourseData,
        toObject: jest.fn().mockReturnValue(mockCourseData),
      };

      service.getCourseById.mockResolvedValue(mockCourse);

      const result = await controller.getOne(courseId, user as any);

      expect(service.getCourseById).toHaveBeenCalledWith(courseId, user._id);
      expect(result.name).toBe('Test Course');
    });
  });
});
