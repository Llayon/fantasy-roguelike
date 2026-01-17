import { Module } from '@nestjs/common';
import { RunController } from './run.controller';
import { RunService } from './run.service';

/**
 * Run management module.
 * Provides API endpoints for roguelike run management.
 *
 * Exports:
 * - RunService: Run management business logic
 * - RunController: HTTP endpoints
 *
 * @module api/run
 */
@Module({
  controllers: [RunController],
  providers: [RunService],
  exports: [RunService],
})
export class RunModule {}
