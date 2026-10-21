import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course } from '../course/schemas/course.schema';
import { Assignment, AssignmentStatus } from '../assignment/schemas/assignment.schema';
import { Question } from '../question/schemas/question.schema';

@Injectable()
export class ResourceAccessService {
  constructor(
    @InjectModel(Course.name) private readonly courses: Model<Course>,
    @InjectModel(Assignment.name) private readonly assignments: Model<Assignment>,
    @InjectModel(Question.name) private readonly questions: Model<Question>,
  ) {}

  async courseAccess(courseId: string, userId?: string) {
    if (!Types.ObjectId.isValid(courseId)) throw new BadRequestException('Invalid course id');
    const course = await this.courses.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const teacher = !!userId && (course.creatorId.toString() === userId || course.admins.some(id => id.toString() === userId));
    const member = teacher || (!!userId && course.students.some(id => id.toString() === userId));
    if (!member) throw new ForbiddenException('Course membership required');
    return { course, teacher };
  }

  async assertCourseTeacher(courseId: string, userId: string) {
    const access = await this.courseAccess(courseId, userId);
    if (!access.teacher) throw new ForbiddenException('Only course teachers can author assignments');
    return access.course;
  }

  async assertAssignmentAccess(assignment: Assignment, userId?: string) {
    const access = await this.courseAccess(assignment.courseId.toString(), userId);
    const owner = assignment.ownerId.toString() === userId;
    if (assignment.status === AssignmentStatus.DRAFT && !owner) {
      throw new ForbiddenException('Draft assignments are visible only to their owner');
    }
    return { ...access, owner };
  }

  async assertQuestionAccess(question: Question, userId?: string, assignmentId?: string) {
    if (assignmentId) {
      if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('Invalid assignment id');
      const assignment = await this.assignments.findById(assignmentId);
      if (!assignment) throw new NotFoundException('Assignment not found');
      const access = await this.assertAssignmentAccess(assignment, userId);
      if (!assignment.questionIds.some(id => id.toString() === String((question as Question & { _id: unknown })._id))) {
        throw new ForbiddenException('Question is not part of this assignment');
      }
      if (!access.teacher && assignment.startAt && assignment.startAt > new Date()) {
        throw new ForbiddenException('Assignment has not started');
      }
      return assignment;
    }
    if (question.isPublic || question.ownerId.toString() === userId) return;
    if (userId) {
      const assignments = await this.assignments.find({ questionIds: (question as Question & { _id: unknown })._id, status: AssignmentStatus.PUBLISHED });
      for (const assignment of assignments) {
        if (assignment.startAt && assignment.startAt > new Date()) continue;
        const course = await this.courses.findOne({ _id: assignment.courseId, $or: [{ creatorId: userId }, { admins: userId }, { students: userId }] });
        if (course) return;
      }
    }
    throw new ForbiddenException('Question is private');
  }

  async assertSubmissionAccess(question: Question, userId: string, assignmentId?: string) {
    const assignment = await this.assertQuestionAccess(question, userId, assignmentId);
    if (assignmentId && assignment) {
      const now = new Date();
      if (assignment.status !== AssignmentStatus.PUBLISHED || (assignment.startAt && assignment.startAt > now)) {
        throw new ForbiddenException('Assignment is not open for submissions');
      }
      if (assignment.deadline && assignment.deadline <= now) throw new ForbiddenException('Assignment deadline has passed');
    }
  }

  async assertAttachableQuestions(questionIds: string[], userId: string) {
    const uniqueIds = [...new Set(questionIds)];
    const count = await this.questions.countDocuments({ _id: { $in: uniqueIds }, $or: [{ ownerId: userId }, { isPublic: true }] });
    if (count !== uniqueIds.length) throw new ForbiddenException('Use only public questions or questions you own');
  }
}
