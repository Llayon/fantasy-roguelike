import { Module } from '@nestjs/common';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';
import { RunModule } from '../run/run.module';

/**
 * Battle simulation module.
 * Provides API endpoints for battle management and simulation.
 *
 * Exports:
 * - BattleService: Battle simulation business logic
 * - BattleController: HTTP endpoints
 *
 * Dependencies:
 * - RunModule: For run progression updates
 *
 * @module api/battle
 */
@Module({
  imports: [RunModule],
  controllers: [BattleController],
  providers: [BattleService],
  exports: [BattleService],
})
export class BattleModule {}
