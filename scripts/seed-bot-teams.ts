/**
 * Seed script for bot teams.
 * Generates and persists bot teams for all stages (1-9) and difficulties (1-10).
 * 
 * Usage:
 *   npx ts-node scripts/seed-bot-teams.ts
 * 
 * This script:
 * 1. Connects to the database
 * 2. Clears existing bot teams (optional)
 * 3. Generates 5+ unique compositions per stage
 * 4. Creates teams for all 9 stages and 10 difficulties
 * 5. Validates all teams respect budget constraints
 * 6. Persists teams to database
 * 7. Prints statistics
 * 
 * @fileoverview Bot team seeding script for roguelike mode
 */

/// <reference types="node" />

import 'dotenv/config';
import { DataSource } from 'typeorm';
import { BotTeam } from '../src/entities/bot-team.entity';
import { BotTeamGenerator } from '../src/roguelike/bot/bot-generator';
import { UNIT_TEMPLATES } from '../src/game/units/unit.data';

/**
 * Database configuration from environment variables.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fantasy_roguelike',
  entities: [BotTeam],
  synchronize: false,
  logging: false,
});

/**
 * Get unit cost by ID.
 * 
 * @param unitId - Unit ID
 * @returns Unit cost or 0 if not found
 */
function getUnitCost(unitId: string): number {
  const template = UNIT_TEMPLATES[unitId as keyof typeof UNIT_TEMPLATES];
  return template?.cost ?? 0;
}

/**
 * Validate bot team respects budget constraints.
 * 
 * @param botTeam - Bot team to validate
 * @param maxBudget - Maximum budget
 * @returns True if valid
 */
function validateBotTeam(botTeam: BotTeam, maxBudget: number): boolean {
  if (!botTeam.team?.units) {
    return false;
  }

  const totalCost = botTeam.team.units.reduce((sum, unit) => {
    return sum + getUnitCost(unit.unitId);
  }, 0);

  return totalCost <= maxBudget;
}

/**
 * Seed bot teams for all stages and difficulties.
 */
async function seedBotTeams(): Promise<void> {
  console.log('🤖 Starting bot team seeding...\n');

  try {
    // Initialize database connection
    console.log('📦 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const botTeamRepository = AppDataSource.getRepository(BotTeam);
    const generator = new BotTeamGenerator();

    // Clear existing bot teams (optional)
    console.log('🗑️  Clearing existing bot teams...');
    const deletedCount = await botTeamRepository.delete({});
    console.log(`✅ Deleted ${deletedCount.affected ?? 0} existing bot teams\n`);

    // Generate bot teams
    console.log('🎲 Generating bot teams...\n');
    const botTeams: BotTeam[] = [];
    let totalGenerated = 0;
    let totalValidated = 0;

    // Stages 1-9
    for (let stage = 1; stage <= 9; stage++) {
      console.log(`Stage ${stage}:`);
      const stageTeams: BotTeam[] = [];

      // Difficulties 1-10
      for (let difficulty = 1; difficulty <= 10; difficulty++) {
        // Generate 5 unique compositions per stage/difficulty
        for (let composition = 0; composition < 5; composition++) {
          const seed = stage * 1000 + difficulty * 100 + composition;

          const teamSetup = generator.generateTeam({
            difficulty,
            stage,
            seed,
          });

          const botTeam = new BotTeam();
          botTeam.stage = stage;
          botTeam.difficulty = difficulty;
          botTeam.team = {
            units: teamSetup.units.map((unit, index) => ({
              unitId: unit.unitId,
              tier: unit.tier,
              position: teamSetup.positions[index],
            })),
          };

          // Validate team
          const budget = 10 + (difficulty - 1) * (20 / 9);
          if (validateBotTeam(botTeam, Math.round(budget))) {
            stageTeams.push(botTeam);
            totalValidated++;
          }

          totalGenerated++;
        }
      }

      console.log(`  ✅ Generated ${stageTeams.length} teams (50 total)\n`);
      botTeams.push(...stageTeams);
    }

    // Persist to database
    console.log(`💾 Persisting ${botTeams.length} bot teams to database...\n`);
    const savedTeams = await botTeamRepository.save(botTeams);
    console.log(`✅ Saved ${savedTeams.length} bot teams\n`);

    // Print statistics
    console.log('📊 Seeding Statistics:\n');
    console.log(`  Total Generated: ${totalGenerated}`);
    console.log(`  Total Validated: ${totalValidated}`);
    console.log(`  Total Persisted: ${savedTeams.length}`);
    console.log(`  Validation Rate: ${((totalValidated / totalGenerated) * 100).toFixed(1)}%\n`);

    // Print coverage by stage
    console.log('📈 Coverage by Stage:\n');
    for (let stage = 1; stage <= 9; stage++) {
      const stageTeams = savedTeams.filter((t) => t.stage === stage);
      console.log(`  Stage ${stage}: ${stageTeams.length} teams`);

      // Show difficulty distribution
      const difficultyDistribution: Record<number, number> = {};
      for (let d = 1; d <= 10; d++) {
        difficultyDistribution[d] = stageTeams.filter((t) => t.difficulty === d).length;
      }

      const difficulties = Object.entries(difficultyDistribution)
        .filter(([, count]) => count > 0)
        .map(([d, count]) => `D${d}:${count}`)
        .join(', ');

      console.log(`    Difficulties: ${difficulties}`);
    }

    console.log('\n✨ Bot team seeding completed successfully!\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run the seed script
seedBotTeams().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
