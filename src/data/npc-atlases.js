// Reviewed source-of-truth animation manifest. Only catalog NPCs use these PNGs.
// The villager starter is a grayscale pixel-art PROTOTYPE, not final hand-painted art.
// Map v1, the player's knight and cows continue using their original assets.
const NPC_SHIPPED_ATLASES = Object.freeze([{
  type: 'villager',
  source: 'assets/npc/villager-starter.png',
  layout: {
    frameWidth: 40, frameHeight: 56,
    states: {
      idle: { frames: 12, fps: 6, rows: [0,1,2,3,4,5,6,7] },
      walk: { frames: 12, fps: 12, rows: [8,9,10,11,12,13,14,15] },
      talk: { frames: 12, fps: 8, rows: [16,17,18,19,20,21,22,23] }
    }
  }
}]);
for (const spec of NPC_SHIPPED_ATLASES) npcAtlasAttach(spec.type, spec.layout, spec.source);
