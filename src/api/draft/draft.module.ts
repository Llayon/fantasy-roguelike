import { Module } from '@nestjs/common';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { RunModule } from '../run/run.module';

/**
 * Draft management module.
 * Provides API endpoints for card drafting in roguelike mode.
 *
 * Exports:
 * - DraftService: Draft management business logic
 * - DraftController: HTTP endpoints
 *
 * Dependencies:
 * - RunModule: For run management integration
 *
 * @module api/draft
 */
@Module({
  imports: [RunModule],
  controllers: [DraftController],
  providers: [DraftService],
  exports: [DraftService],
})
export class DraftModule {}
