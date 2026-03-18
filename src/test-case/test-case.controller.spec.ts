import { Test, TestingModule } from '@nestjs/testing';
import { TestCaseController } from './test-case.controller';

describe('TestCaseController', () => {
  let controller: TestCaseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestCaseController],
    }).compile();

    controller = module.get<TestCaseController>(TestCaseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
