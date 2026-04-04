/**
 * Pokemon-style Evolution System for Agents
 * Agents earn XP, level up, evolve, and grow their memory banks.
 *
 * Stages (Maori-themed):
 *   Seed   (Kakano)  — Level 1-4   — 10 memory slots
 *   Sprout (Pihi)    — Level 5-9   — 25 memory slots
 *   Bloom  (Puawai)  — Level 10-19 — 50 memory slots
 *   Tane   (Tane)    — Level 20+   — 100 memory slots
 */

export const EVOLUTION_STAGES = [
  { id: 'seed',   label: 'Kakano',  icon: 'seed',   minLevel: 1,  memoryCapacity: 10,  color: '#A3E635' },
  { id: 'sprout', label: 'Pihi',    icon: 'sprout', minLevel: 5,  memoryCapacity: 25,  color: '#22C55E' },
  { id: 'bloom',  label: 'Puawai',  icon: 'bloom',  minLevel: 10, memoryCapacity: 50,  color: '#A855F7' },
  { id: 'tane',   label: 'Tane',    icon: 'tane',   minLevel: 20, memoryCapacity: 100, color: '#F59E0B' },
];

export const XP_REWARDS = {
  chat: 10,
  task: 25,
  relay: 5,
  scan: 3,
  memory_add: 2,
};

export function xpForNextLevel(currentLevel) {
  return currentLevel * 100;
}

export function getStageForLevel(level) {
  for (let i = EVOLUTION_STAGES.length - 1; i >= 0; i--) {
    if (level >= EVOLUTION_STAGES[i].minLevel) {
      return EVOLUTION_STAGES[i];
    }
  }
  return EVOLUTION_STAGES[0];
}

/**
 * Award XP to an agent and handle level-ups + evolution.
 * Returns { leveled, evolved, agent } with the updated state.
 */
export function awardXP(db, agentId, action) {
  const reward = XP_REWARDS[action] || 0;
  if (reward === 0) return { leveled: false, evolved: false, agent: null };

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return { leveled: false, evolved: false, agent: null };

  let newXP = (agent.xp || 0) + reward;
  let newLevel = agent.level || 1;
  let newInteractions = (agent.total_interactions || 0) + 1;
  let leveled = false;
  let evolved = false;

  // Check for level-ups (can level multiple times)
  while (newXP >= xpForNextLevel(newLevel)) {
    newXP -= xpForNextLevel(newLevel);
    newLevel++;
    leveled = true;
  }

  // Check for evolution
  const newStage = getStageForLevel(newLevel);
  const oldStage = agent.evolution_stage || 'seed';
  if (newStage.id !== oldStage) {
    evolved = true;
  }

  db.prepare(`
    UPDATE agents
    SET xp = ?, level = ?, evolution_stage = ?, memory_capacity = ?, total_interactions = ?
    WHERE id = ?
  `).run(newXP, newLevel, newStage.id, newStage.memoryCapacity, newInteractions, agentId);

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);

  return { leveled, evolved, newLevel, newStage: newStage.id, agent: updated };
}
