/**
 * Battle simulation API endpoints.
 *
 * @module api/battle
 */

export { BattleController } from './battle.controller';
export {
  BattleService,
  StartBattleRequest,
  StartBattleResponse,
  SimulateBattleRequest,
  SimulateBattleResponse,
  GetBattleReplayResponse,
} from './battle.service';
