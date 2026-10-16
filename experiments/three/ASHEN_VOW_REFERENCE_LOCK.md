# The Ashen Vow — AUTHORITATIVE VISUAL REFERENCE / no substitute silhouettes

Status: **REFERENCE LOCKED · NO CHARACTER ART APPROVED YET** (owner rejection, 2026-10-15).

The authoritative target is the full image **uploaded directly by the game owner in ChatGPT on 2026-10-15** showing THE ASHEN VOW: full hero portrait, FRONT / SIDE / BACK views and four details. The source is held in the owner's project conversation; this document describes it to avoid drifting into unrelated generic knight designs. The image is not yet imported into git; do NOT misrepresent this text as the source artwork itself.

## Unambiguous visual acceptance criteria

- **Silhouette:** adult knight, ~8-head character, HUMAN anatomical proportions. Angular, wide layered Gothic pauldrons and narrow waist. No cylinders/ellipsoids/blockout puffiness/bubble torso. Legs have realistic thigh, knee, shin, boot articulation.
- **Head:** long and narrow pale cracked expressionless mask, black slit eye recesses; deep burgundy hood wrapped tight about neck; high irregular wire/thorn metal crown. Face must remain recognizable and cleanly separated from hood at actual game size.
- **Torso:** aged blackened steel with actual raised multi-layer plates, bevelled metallic contours, scratches/engraving, fasteners; leather crossed straps with recognizable round embossed medallion at shoulder. Not one convex torso mass.
- **Tabard:** long, distressed off-white linen hanging *in front of* the armour, reddish stained cross markings, asymmetric ragged hem; genuine hanging cloth geometry, not a short square attached to a sphere.
- **Arms:** heavy articulated segmented pauldrons, upper arm armour, elbow cops, fluted forearm vambraces, distinct plated gloves and fingers. Proper arm length and weight.
- **Waist/legs:** multi-layer belt and tassets, prominent cuisses/knees/greaves/sabatons, long natural adult proportions. Clearly separate boots.
- **Back:** heavyweight dark desaturated crimson cloak draping from shoulders almost to ground, with torn edge, holes, long trailing fragments and centered large pale occult/cross-like rear insignia.
- **Weapon:** realistically proportioned longsword held at right side, long steel blade and identifiable thorn-engraved ornamental guard. No crude rod with plus sign.
- **Material/readability:** actual metal, leather, fabric, bone/paint, grime and edge wear at silhouette-first and detail levels. True 3D visibility across rotation, including side/back.

## Technical approach — REQUIRED sequence

1. Build/acquire a **high quality real 3D mesh** matching the owner-approved image (front, side, back), not ad-hoc primitive geometry or a cloud of glyph points. Verify silhouette in neutral studio renders before generating ASCII.
2. Rig as a skinned mesh with anatomically placed bones, elbows/knees/wrists/ankles, credible foot contact, and cloth bone/secondary physics. Review walk/run/jump/attack across all angles using 60 FPS playback; claims of realistic motion require inspection.
3. Render the **actual mesh surface** into ASCII (shader/postprocess or world-space glyph sampling on tessellated surface preserving depth and normals). Glyphs are a *rendering mode*, not a mesh replacement. The game must retain legible helmet/pauldrons/tabard/cape/weapon silhouettes.
4. Compare screenshots **against the owner image** at same three viewing angles; do not call a model complete based on browser tests or the existence of scripts. Show closeups of mask/armour/fabric/weapon.
5. Keep the first 3D model in a standalone, rotatable animation workshop. Only migrate after visual acceptance. Do not change prod or authored map.

## Explicitly REJECTED prior routes

- `experiments/three/ashen-vow.html`: hand-built procedural primitive knight, not faithful to approved target.
- `experiments/three/ashen-glyph-rig.html` on `feat/three-ashen-glyph-skeleton`: glyph point cloud over skeletal pivots; results in balloon-like body and non-readable metal/mask/cape. **DO NOT MERGE**.
- Third-party `Masked Knight` GLB on `feat/three-gltf-knight` is a separate external asset. It must not be renamed the approved original The Ashen Vow model or used as a drop-in substitute.

**Stop condition:** if no faithful mesh exists, report this clearly and DO NOT substitute an illustrated concept or another simple procedurally generated avatar.
