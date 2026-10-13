// Stage 3a: validated scene descriptors only. No teleport, room loading or map mutation.
function createSceneRegistry() {
  const records = new Map();
  const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(id);
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function register(definition) {
    if (!plain(definition) || !validId(definition.id)) throw Error('Invalid scene id');
    if (records.has(definition.id)) throw Error('Duplicate scene id');
    if (definition.kind !== 'outdoor' && definition.kind !== 'interior') throw Error('Invalid scene kind');
    if (definition.entries !== undefined && !plain(definition.entries)) throw Error('Invalid scene entries');
    if (definition.portals !== undefined && !plain(definition.portals)) throw Error('Invalid scene portals');
    const entries = Object.create(null);
    for (const [id, point] of Object.entries(definition.entries || {})) {
      if (!validId(id) || !Array.isArray(point) || point.length !== 2 ||
          !point.every(Number.isFinite)) throw Error('Invalid scene entry');
      entries[id] = Object.freeze([point[0], point[1]]);
    }
    const portals = Object.create(null);
    for (const [id, link] of Object.entries(definition.portals || {})) {
      if (!validId(id) || !plain(link) || !validId(link.to) || !validId(link.at))
        throw Error('Invalid scene portal');
      portals[id] = Object.freeze({ to: link.to, at: link.at });
    }
    const scene = Object.freeze({
      id: definition.id, kind: definition.kind,
      entries: Object.freeze(entries), portals: Object.freeze(portals)
    });
    records.set(scene.id, scene);
    return scene;
  }
  function resolve(fromId, portalId) {
    const from = records.get(fromId);
    const portal = from && from.portals[portalId];
    const target = portal && records.get(portal.to);
    const world = target && target.entries[portal.at];
    return world ? Object.freeze({ from: from.id, to: target.id, entry: portal.at, world }) : null;
  }
  return Object.freeze({
    register, resolve, get: id => records.get(id) || null,
    ids: () => Object.freeze([...records.keys()])
  });
}
const SCENE_REGISTRY = createSceneRegistry();
SCENE_REGISTRY.register({ id: 'meadow', kind: 'outdoor' });
