import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DraftService } from '../draft.service';
import { RunService } from '../../run/run.service';

describe('DraftService', () => {
  let service: DraftService;
  let runService: RunService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DraftService, RunService],
    }).compile();

    service = module.get<DraftService>(DraftService);
    runService = module.get<RunService>(RunService);
  });

  describe('getDraftOptions', () => {
    it('should return 3 draft options', () => {
      // Create a run first
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      // Get draft options
      const options = service.getDraftOptions(runId);

      expect(options.options).toHaveLength(3);
      expect(options.rerollsRemaining).toBe(2);
      expect(options.options[0]).toHaveProperty('unitId');
      expect(options.options[0]).toHaveProperty('tier');
      expect(options.options[0]).toHaveProperty('cost');
    });

    it('should throw NotFoundException for non-existent run', () => {
      expect(() => service.getDraftOptions('non-existent-run')).toThrow(NotFoundException);
    });

    it('should return same options on subsequent calls without reroll', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      const options1 = service.getDraftOptions(runId);
      const options2 = service.getDraftOptions(runId);

      expect(options1.options).toEqual(options2.options);
    });
  });

  describe('pickCard', () => {
    it('should add card to deck', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      const draftOptions = service.getDraftOptions(runId);
      const cardToPick = draftOptions.options[0].unitId;

      const result = service.pickCard(runId, cardToPick);

      expect(result.success).toBe(true);
      expect(result.deck.length).toBeGreaterThan(1); // Leader + picked card
      expect(result.deck.some((u) => u.unitId === cardToPick)).toBe(true);
    });

    it('should throw BadRequestException for invalid card', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      service.getDraftOptions(runId); // Initialize draft

      expect(() => service.pickCard(runId, 'invalid-card')).toThrow(BadRequestException);
    });

    it('should reset rerolls after pick', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      const draftOptions = service.getDraftOptions(runId);
      const cardToPick = draftOptions.options[0].unitId;

      service.pickCard(runId, cardToPick);

      const newOptions = service.getDraftOptions(runId);
      expect(newOptions.rerollsRemaining).toBe(2);
    });
  });

  describe('rerollOptions', () => {
    it('should generate new options', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      service.getDraftOptions(runId);
      const rerolledOptions = service.rerollOptions(runId);

      // Options might be the same by chance, but rerolls should decrease
      expect(rerolledOptions.rerollsRemaining).toBe(1);
    });

    it('should decrease reroll count', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      service.getDraftOptions(runId);
      const result1 = service.rerollOptions(runId);
      expect(result1.rerollsRemaining).toBe(1);

      const result2 = service.rerollOptions(runId);
      expect(result2.rerollsRemaining).toBe(0);
    });

    it('should throw BadRequestException when no rerolls remaining', () => {
      const runResponse = runService.startRun('human', 'knight');
      const runId = runResponse.runId;

      service.getDraftOptions(runId);
      service.rerollOptions(runId);
      service.rerollOptions(runId);

      expect(() => service.rerollOptions(runId)).toThrow(BadRequestException);
    });
  });
});
