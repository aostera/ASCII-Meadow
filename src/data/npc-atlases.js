// Persistent NPC animation assets are declared here and copied into the Cloudflare dist folder.
// Keep this empty until an *authored*, reviewed PNG is committed under assets/npc/.
// This registry never creates characters or modifies the designer-authored map.
//
// Example (remove the comment after assets/npc/villager.png has been committed):
// const NPC_SHIPPED_ATLASES = [{
//   type: 'villager', source: 'assets/npc/villager.png',
//   layout: { frameWidth: 64, frameHeight: 96, states: {
//     idle: { frames: 8, fps: 6, rows: [0] },
//     walk: { frames: 8, fps: 10, rows: [1,2,3,4,5,6,7,8] },
//     talk: { frames: 8, fps: 6, rows: [9] }
//   } }
// }];
const NPC_SHIPPED_ATLASES = Object.freeze([]);
for (const a of NPC_SHIPPED_ATLASES) npcAtlasAttach(a.type, a.layout, a.source);
