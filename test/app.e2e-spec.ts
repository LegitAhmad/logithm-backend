import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

jest.setTimeout(60000);

describe('typed grading API with real persistence and executor transport', () => {
  let app: NestExpressApplication;
  let connection: Connection;
  let teacherToken: string;
  let studentToken: string;
  let questionId: string;
  const userIds: string[] = [];
  const questionIds: string[] = [];
  const courseIds: string[] = [];
  const assignmentIds: string[] = [];
  const execution = { functionName: 'add', parameters: [{ name: 'a', type: { type: 'integer' } }, { name: 'b', type: { type: 'integer' } }], returnType: { type: 'integer' } };
  const definition = { title: 'Typed addition regression', descriptionMd: 'Return the sum of both integer arguments.', functionSignature: 'add(a, b)', execution, testCases: [{ input: '[2,3]', expectedOutput: '5', isHidden: false, points: 1 }, { input: '[3,4]', expectedOutput: '7', isHidden: true, points: 2 }], checker: { type: 'exact' }, difficulty: 'easy', isPublic: true };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useBodyParser('json', { limit: '6mb' });
    app.use(cookieParser());
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
    for (const name of ['Teacher', 'Student']) {
      const response = await request(app.getHttpServer()).post('/auth/signup').send({ firstName: name, lastName: 'Integration', email: `${name.toLowerCase()}-${randomUUID()}@example.com`, password: 'IntegrationPassword123!' }).expect(201);
      const profile = await request(app.getHttpServer()).get('/users/me').auth(response.body.accessToken, { type: 'bearer' }).expect(200);
      userIds.push(profile.body._id);
      if (name === 'Teacher') teacherToken = response.body.accessToken;
      else studentToken = response.body.accessToken;
    }
    const question = await request(app.getHttpServer()).post('/questions').auth(teacherToken, { type: 'bearer' }).send(definition).expect(201);
    questionId = question.body._id;
    questionIds.push(questionId);
  });
  afterAll(async () => {
    if (connection) {
      await connection.collection('submissions').deleteMany({ userId: { $in: userIds.map(id => new Types.ObjectId(id)) } });
      await connection.collection('questions').deleteMany({ _id: { $in: questionIds.map(id => new Types.ObjectId(id)) } });
      await connection.collection('assignments').deleteMany({ _id: { $in: assignmentIds.map(id => new Types.ObjectId(id)) } });
      await connection.collection('courses').deleteMany({ _id: { $in: courseIds.map(id => new Types.ObjectId(id)) } });
      await connection.collection('users').deleteMany({ _id: { $in: userIds.map(id => new Types.ObjectId(id)) } });
    }
    await app?.close();
  });

  it('rejects later malformed tests and incompatible partial contract updates', async () => {
    const invalid = structuredClone(definition);
    invalid.testCases[1].expectedOutput = 'false';
    await request(app.getHttpServer()).post('/questions').auth(teacherToken, { type: 'bearer' }).send(invalid).expect(400);
    await request(app.getHttpServer()).patch(`/questions/${questionId}`).auth(teacherToken, { type: 'bearer' }).send({ execution: { ...execution, returnType: { type: 'boolean' } } }).expect(400);
  });

  it('blocks course admins from changing ownership or roles through profile updates', async () => {
    const course = await request(app.getHttpServer()).post('/courses').auth(teacherToken, { type: 'bearer' }).send({ name: 'Ownership boundary regression', startDate: '2026-01-01T00:00:00.000Z', endDate: '2028-01-01T00:00:00.000Z' }).expect(201);
    courseIds.push(course.body._id);
    await request(app.getHttpServer()).patch(`/courses/${course.body._id}/admins/add`).auth(teacherToken, { type: 'bearer' }).send({ userId: userIds[1] }).expect(200);
    await request(app.getHttpServer()).patch(`/courses/${course.body._id}`).auth(studentToken, { type: 'bearer' }).send({ creatorId: userIds[1] }).expect(400);
    await request(app.getHttpServer()).patch(`/courses/${course.body._id}`).auth(studentToken, { type: 'bearer' }).send({ $set: { creatorId: userIds[1] } }).expect(400);
    await request(app.getHttpServer()).patch(`/courses/${course.body._id}`).auth(studentToken, { type: 'bearer' }).send({ admins: [] }).expect(400);
    const updated = await request(app.getHttpServer()).patch(`/courses/${course.body._id}`).auth(studentToken, { type: 'bearer' }).send({ name: 'Authorized admin edit' }).expect(200);
    expect(updated.body.creatorId).toBe(userIds[0]);
    expect(updated.body.name).toBe('Authorized admin edit');
    await request(app.getHttpServer()).delete(`/courses/${course.body._id}`).auth(studentToken, { type: 'bearer' }).expect(403);
  });

  it('requires publication transitions and protects assignment owner and course fields', async () => {
    const course = await request(app.getHttpServer()).post('/courses').auth(teacherToken, { type: 'bearer' }).send({ name: 'Assignment lifecycle regression', startDate: '2026-01-01T00:00:00.000Z', endDate: '2028-01-01T00:00:00.000Z' }).expect(201);
    courseIds.push(course.body._id);
    const draft = { title: 'Publication boundary regression', courseId: course.body._id };
    await request(app.getHttpServer()).post('/assignments').auth(teacherToken, { type: 'bearer' }).send({ ...draft, status: 'published' }).expect(400);
    const created = await request(app.getHttpServer()).post('/assignments').auth(teacherToken, { type: 'bearer' }).send(draft).expect(201);
    assignmentIds.push(created.body._id);
    for (const fields of [{ status: 'published' }, { ownerId: userIds[1] }, { courseId: userIds[1] }]) {
      await request(app.getHttpServer()).patch(`/assignments/${created.body._id}`).auth(teacherToken, { type: 'bearer' }).send(fields).expect(400);
    }
    const updated = await request(app.getHttpServer()).patch(`/assignments/${created.body._id}`).auth(teacherToken, { type: 'bearer' }).send({ title: 'Authorized draft edit' }).expect(200);
    expect(updated.body.status).toBe('draft');
    expect(updated.body.ownerId).toBe(userIds[0]);
    expect(updated.body.courseId).toBe(course.body._id);
    await request(app.getHttpServer()).post(`/assignments/${created.body._id}/publish`).auth(teacherToken, { type: 'bearer' }).send({}).expect(400);
    await request(app.getHttpServer()).get(`/assignments/${created.body._id}`).auth(studentToken, { type: 'bearer' }).expect(403);
  });

  it('rejects a printed expected answer, hides private results, and prevents cross-user reads', async () => {
    const result = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({ questionId, language: 'python', code: 'def add(a, b):\n    print(a + b)\n    return 0\n' }).expect(201);
    expect(result.body.score).toBe(0);
    expect(result.body.results[0].actualOutput).toBe('0');
    expect(Object.keys(result.body.results[1]).sort()).toEqual(['isHidden', 'passed', 'points', 'testCaseIndex', 'verdict']);
    await request(app.getHttpServer()).get(`/submissions/${result.body._id}`).auth(teacherToken, { type: 'bearer' }).expect(403);
  });

  it('reports a native Python return-type error rather than coercing strings', async () => {
    const result = await request(app.getHttpServer()).post('/submissions/run').auth(studentToken, { type: 'bearer' }).send({ questionId, language: 'python', code: 'def add(a, b):\n    return str(a + b)\n' }).expect(201);
    expect(result.body.score).toBe(0);
    expect(result.body.results[0].verdict).toBe('Return Type Error');
    expect(result.body.results[0].diagnostic).toMatch(/return.*integer/);
    expect(result.body.maxScore).toBe(1);
  });

  it('completes malformed Go grading without a service error and redacts hidden compiler diagnostics', async () => {
    const result = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({ questionId, language: 'go', code: 'package main\nfunc add(a int64, b int64) int64 { return a + }\n' }).expect(201);
    expect(result.body.status).toBe('completed');
    expect(result.body.score).toBe(0);
    expect(result.body.maxScore).toBe(3);
    expect(Object.keys(result.body.results[1]).sort()).toEqual(['isHidden', 'passed', 'points', 'testCaseIndex', 'verdict']);
  });

  it('completes a sandbox time-limit failure with zero score instead of an infrastructure error', async () => {
    const result = await request(app.getHttpServer()).post('/submissions/run').auth(studentToken, { type: 'bearer' }).send({
      questionId, language: 'python', code: 'def add(a, b):\n    while True: pass\n',
    }).expect(201);
    expect(result.body.status).toBe('completed');
    expect(result.body.score).toBe(0);
    expect(result.body.maxScore).toBe(1);
    expect(result.body.results[0].passed).toBe(false);
  });

  it.each([
    ['python', 'def solve(text):\n    return text\n'],
    ['javascript', 'function solve(text) { return text; }'],
    ['typescript', 'function solve(text: string): string { return text; }'],
    ['go', 'func solve(text string) string { return text }\n'],
  ])('round-trips large Unicode arguments and returns in %s across bounded HTTP and executor envelopes', async (language, code) => {
    const expected = '\u2028'.repeat(100000);
    const question = await request(app.getHttpServer()).post('/questions').auth(teacherToken, { type: 'bearer' }).send({
      ...definition, functionSignature: 'solve(text)',
      execution: { functionName: 'solve', parameters: [{ name: 'text', type: { type: 'string' } }], returnType: { type: 'string' } },
      testCases: [{ input: JSON.stringify([expected]), expectedOutput: JSON.stringify(expected), isHidden: false, points: 1 }],
    }).expect(201);
    questionIds.push(question.body._id);
    const result = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({
      questionId: question.body._id, language, code,
    }).expect(201);
    expect(result.body.score).toBe(1);
    expect(JSON.parse(result.body.results[0].actualOutput)).toBe(expected);
    if (language === 'go') {
      const failed = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({
        questionId: question.body._id, language, code: 'func solve(text string) string { return }\n',
      }).expect(201);
      expect(failed.body.status).toBe('completed');
      expect(failed.body.score).toBe(0);
    }
  });

  it('passes parsed nested return values and false/null arguments to a separate teacher validator', async () => {
    const arrayType = { type: 'array', items: { type: 'integer' } };
    const question = await request(app.getHttpServer()).post('/questions').auth(teacherToken, { type: 'bearer' }).send({
      ...definition, functionSignature: 'solve(items, flag, empty)',
      execution: {
        functionName: 'solve',
        parameters: [{ name: 'items', type: arrayType }, { name: 'flag', type: { type: 'boolean' } }, { name: 'empty', type: { type: 'null' } }],
        returnType: { type: 'object', properties: { items: arrayType, flag: { type: 'boolean' }, empty: { type: 'null' } } },
      },
      testCases: [{ input: '[[1,2,3],false,null]', expectedOutput: '{"items":[1,2,3],"flag":false,"empty":null}', isHidden: false, points: 2 }],
      checker: { type: 'custom', code: 'def validate(actual, expected, args):\n    return actual["items"] == list(reversed(expected["items"])) and actual["flag"] is False and actual["empty"] is None and args == [[1, 2, 3], False, None]\n' },
    }).expect(201);
    questionIds.push(question.body._id);
    const result = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({
      questionId: question.body._id, language: 'python', code: 'def solve(items, flag, empty):\n    return {"items": list(reversed(items)), "flag": flag, "empty": empty}\n',
    }).expect(201);
    expect(result.body.score).toBe(2);
    expect(JSON.parse(result.body.results[0].actualOutput)).toEqual({ items: [3, 2, 1], flag: false, empty: null });
  });

  it.each([
    ['python', 'def add(a, b):\n    return a + b\n'],
    ['javascript', 'function add(a, b) { return a + b; }'],
    ['typescript', 'function add(a: number, b: number): number { return a + b; }'],
    ['go', 'package main\nfunc add(a int64, b int64) int64 { return a + b }\n'],
  ])('grades real %s function returns', async (language, code) => {
    const result = await request(app.getHttpServer()).post('/submissions').auth(studentToken, { type: 'bearer' }).send({ questionId, language, code }).expect(201);
    expect(result.body.score).toBe(3);
    expect(result.body.results.every((test: { passed: boolean }) => test.passed)).toBe(true);
  });
});
