#!/usr/bin/env python3
"""Convert the already paid-for Tripo GLB to a small untextured mobile-view LOD.
NO network calls, NO Tripo task submission, no extra credits.
"""
from pathlib import Path
import sys
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

if len(sys.argv)!=3:
    raise SystemExit("Usage: python scripts/tripo_mobile_preview.py original.glb output.glb")
src,out=Path(sys.argv[1]),Path(sys.argv[2])
if src.read_bytes()[:4]!=b'glTF':
    raise RuntimeError("Expected original Tripo glTF2 binary")
scene=trimesh.load(src,force='scene')
if len(scene.geometry)!=1:
    raise RuntimeError("Unexpected GLB mesh count; refuse to guess")
g=next(iter(scene.geometry.values()))
vertices=np.asarray(g.vertices,dtype=np.float32)
faces=np.asarray(g.faces,dtype=np.int32)
if len(faces)<200000:
    raise RuntimeError("GLB mesh too small; this is not the original Tripo H3.1 model.")
# fast mobile preview mesh; original geometry stays unmodified in the GitHub artifact
cluster=np.rint(vertices/.004).astype('int32')
_,first,reverse=np.unique(cluster,axis=0,return_index=True,return_inverse=True)
verts=vertices[first]
newfaces=reverse[faces]
valid=(newfaces[:,0]!=newfaces[:,1])&(newfaces[:,0]!=newfaces[:,2])&(newfaces[:,1]!=newfaces[:,2])
newfaces=newfaces[valid]
# Original Tripo front points toward +X; render front as +Z in Three.js.
verts=np.stack([-verts[:,2]*2.04,(verts[:,1]+.5)*2.04,verts[:,0]*2.04],axis=1)
mesh=trimesh.Trimesh(vertices=verts,faces=newfaces,process=False)
mesh.visual=TextureVisuals(material=PBRMaterial(name="Tripo H3.1 The Ashen Vow - neutral grey",
    baseColorFactor=[175,174,177,255],metallicFactor=.12,roughnessFactor=.80,doubleSided=True))
out.parent.mkdir(parents=True,exist_ok=True)
mesh.export(out)
print(f"Tripo real model: {len(faces):,} triangles -> mobile preview: {len(newfaces):,}; "
      f"size={out.stat().st_size:,} bytes")
