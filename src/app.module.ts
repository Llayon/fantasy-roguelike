import { Module } from '@nestjs/common';
import { RunModule } from './api/run/run.module';
import { BattleModule } from './api/battle/battle.module';
import { DraftModule } from './api/draft/draft.module';

/**
 * Root application module.
 * Imports all feature modules for the roguelike battle simulator.
 */
@Module({
  imports: [
    RunModule,
    BattleModule,
    DraftModule,
    // Feature modules will be added here as they are implemented:
    // - UpgradeModule (unit upgrades)
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
