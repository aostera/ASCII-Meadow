#!/usr/bin/env python3
"""The Ashen Vow / reference sculpt — 3 view color-projected GLB mesh.

Reproducible, DRAFT, not rigged/game-ready; extracts real supplied FRONT / SIDE /
BACK pixels, constructs volumetric visual hull and free-hanging physical cape.
Do not call this final, cinematic-quality photogrammetry or the exact hidden
geometry from the illustration. Never use the rejected blob/glyph cloud.
Usage: python build_ashen_reference.py original_reference.jpg output.glb
Dependencies: numpy pillow opencv-python-headless scipy scikit-image trimesh
"""
import sys, numpy as np, cv2, trimesh
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes, label
from PIL import Image
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
if len(sys.argv)!=3:
    raise SystemExit("Usage: build_ashen_reference.py reference.jpg output.glb")
source=Image.open(sys.argv[1]).convert('RGB')
if source.width!=1448 or source.height!=1086:
    # the source sheet is proportionally scaled, preserving view rectangles
    source=source.resize((1448,1086),Image.Resampling.LANCZOS)
boxes={'front':(615,52,908,620),'side':(906,64,1155,620),'back':(1154,65,1448,618)}
images={};silhouettes={}
for view,box in boxes.items():
    color=np.asarray(source.crop(box)).copy()
    h,w=color.shape[:2];cvcolor=cv2.cvtColor(color,cv2.COLOR_RGB2BGR)
    seeds=np.zeros((h,w),np.uint8)
    rect={'front':(17,24,w-24,h-41),'side':(11,23,w-20,h-41),'back':(6,15,w-12,h-30)}[view]
    cv2.grabCut(cvcolor,seeds,rect,None,None,12,cv2.GC_INIT_WITH_RECT)
    mask=np.where((seeds==cv2.GC_FGD)|(seeds==cv2.GC_PR_FGD),255,0).astype(np.uint8)
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    components,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
    largest=max(range(1,components),key=lambda i:stats[i,cv2.CC_STAT_AREA])
    mask=(labels==largest).astype(np.uint8)*255
    silhouettes[view]=mask
    # Matte opacity is supplied by mesh geometry, not alpha transparency.
    images[view]=Image.fromarray(np.concatenate([color,np.full((h,w,1),255,np.uint8)],axis=2),'RGBA')
nx,ny,nz=138,270,128
x=np.linspace(-.575,.575,nx);y=np.linspace(0,2.055,ny);z=np.linspace(-.640,.450,nz)
frontU=151.0+x*257;frontV=545-y*256
sideU=138.0+z*240;sideV=528-y*245
def sampled(mask,U,V):
    return cv2.remap(mask,
      np.broadcast_to(U[None,:],(ny,len(U))).astype(np.float32),
      np.broadcast_to(V[:,None],(ny,len(U))).astype(np.float32),
      cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)/255.0
frontMask=sampled(silhouettes['front'],frontU,frontV)
sideMask=sampled(silhouettes['side'],sideU,sideV)
bodyMask=frontMask.copy()
for iy,height in enumerate(y):
    if height<1.18:
        min_x=104 if height<.46 else 83
        max_x=235 if height<.46 else 236
        bodyMask[iy,frontU<min_x]=0
        bodyMask[iy,frontU>max_x]=0
minDepth=np.zeros(ny,np.float32);maxDepth=np.zeros(ny,np.float32)
for i,height in enumerate(y):
    if height<.29: minDepth[i],maxDepth[i]=-.13,.245
    elif height<1.07: minDepth[i],maxDepth[i]=-.16,.24
    elif height<1.65: minDepth[i],maxDepth[i]=-.185,.22
    else: minDepth[i],maxDepth[i]=-.16,.19
depthOK=(z[None,:]>=minDepth[:,None])&(z[None,:]<=maxDepth[:,None])
volume=(bodyMask.T[:,:,None]>.36)&(sideMask[None,:,:]>.30)&depthOK[None,:,:]
regions,num=label(volume,return_num=True)
sizes=np.bincount(regions.ravel());sizes[0]=0
big=[int(i) for i in np.argsort(sizes)[::-1] if i and sizes[i]>1800][:4]
volume=np.isin(regions,big)
field=gaussian_filter(volume.astype('float32'),sigma=(.95,.8,1.),mode='constant')
vertices,faces,_,_=marching_cubes(field,level=.46,
          spacing=(x[1]-x[0],y[1]-y[0],z[1]-z[0]))
vertices+=np.array([x[0],y[0],z[0]])
hull=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
if hull.volume<0:hull.invert()
result=trimesh.Scene()
def projection(view,xyz):
    if view=='front':
        u=(151+xyz[:,0]*257)/images[view].width
        v=1-(545-xyz[:,1]*256)/images[view].height
    elif view=='back':
        u=(146-xyz[:,0]*252)/images[view].width
        v=1-(535-xyz[:,1]*254)/images[view].height
    else:
        u=(138+xyz[:,2]*240)/images[view].width
        v=1-(528-xyz[:,1]*245)/images[view].height
    return np.column_stack([u,v])
def part(name,which,view):
    subset=hull.faces[which];verts=hull.vertices[subset].reshape(-1,3)
    if len(verts)==0:return
    uv=projection(view,verts)
    face=np.arange(len(verts),dtype=np.int32).reshape(-1,3)
    mesh=trimesh.Trimesh(vertices=verts,faces=face,process=False)
    mesh.visual=TextureVisuals(uv=uv,material=PBRMaterial(
        name='Approved_concept_'+view,baseColorTexture=images[view],
        metallicFactor=0.,roughnessFactor=.95,alphaMode='OPAQUE',doubleSided=True))
    result.add_geometry(mesh,geom_name=name)
normals=hull.face_normals
fwd=normals[:,2]>=.37;rear=normals[:,2]<=-.38
part('Sculpt_body_front_original_ref',fwd,'front')
part('Sculpt_body_rear_original_ref',rear,'back')
part('Sculpt_body_side_original_ref',~(fwd|rear),'side')

# Separate sheet of actual ragged fabric behind shoulder and legs.
# It is a real 3D free surface (not a volume-extruded robe, not a billboard).
v=[];uv=[];tri=[]
cols,rows=94,160;mask=silhouettes['back']
for ri in range(rows):
    t=ri/(rows-1);Y=1.67-t*1.43
    pixY=535-Y*254
    width=(.27+.24*t)*(1+.025*np.sin(t*9))
    for ci in range(cols):
        p=ci/(cols-1)
        X=(p*2-1)*width+.010*np.sin(t*11.1)
        Z=-.155-.32*t**1.55+.07*abs(p-.5)*2+.012*np.sin(p*19+t*10)*t
        v.append([X,Y,Z])
        uv.append([(146-X*252)/images['back'].width,1-pixY/images['back'].height])
for ri in range(rows-1):
  for ci in range(cols-1):
    k=ri*cols+ci
    X=(v[k][0]+v[k+cols+1][0])*.5
    Y=(v[k][1]+v[k+cols+1][1])*.5
    pu=int(np.clip(146-X*252,0,mask.shape[1]-1))
    pv=int(np.clip(535-Y*254,0,mask.shape[0]-1))
    if mask[pv,pu]<80:continue
    if ri>rows*.79 and np.sin(ci*1.4+ri*.53)>.88:continue
    tri.extend([(k,k+cols,k+1),(k+1,k+cols,k+cols+1)])
fabric=trimesh.Trimesh(vertices=np.asarray(v),faces=np.asarray(tri,dtype=np.int32),process=False)
fabric.visual=TextureVisuals(uv=np.asarray(uv),material=PBRMaterial(
    name='Worn_heraldic_red_cloak',baseColorTexture=images['back'],metallicFactor=0,
    roughnessFactor=.98,alphaMode='OPAQUE',doubleSided=True))
result.add_geometry(fabric,geom_name='Real separate long shredded crimson cape with rear insignia')

# True independent 3D crown thorns and steel sword (can be rigged separately).
bronze=PBRMaterial(name='Forged_worn_bronze',baseColorFactor=[125,103,73,255],metallicFactor=.72,roughnessFactor=.53)
steel=PBRMaterial(name='Forged_dirty_steel',baseColorFactor=[150,153,157,255],metallicFactor=.85,roughnessFactor=.39)
def attach_rod(name,a,b,r,mat):
    a=np.array(a,dtype=float);b=np.array(b,dtype=float)
    d=b-a
    geo=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(d),sections=12)
    matrix=trimesh.geometry.align_vectors([0,0,1],d)
    matrix[:3,3]=(a+b)/2;geo.apply_transform(matrix)
    geo.visual.material=mat;result.add_geometry(geo,geom_name=name)
for i,a in enumerate(np.linspace(0,2*np.pi,13,endpoint=False)):
    p=np.array([.097*np.cos(a),1.966,.100*np.sin(a)])
    q=p+np.array([.030*np.cos(a),.083+(i%3)*.025,.030*np.sin(a)])
    d=q-p;cone=trimesh.creation.cone(.009,np.linalg.norm(d),sections=7)
    matrix=trimesh.geometry.align_vectors([0,0,1],d)
    matrix[:3,3]=p;cone.apply_transform(matrix)
    cone.visual.material=bronze;result.add_geometry(cone,geom_name=f'Thorn_crown_{i:02d}')
hand=np.array([-.310,1.055,.19]);tip=np.array([-.505,.052,.265])
length=tip-hand;right=np.cross(length,[0,0,1]);right=right/np.linalg.norm(right)*.043
bladeVerts=[hand+right,hand-right,tip,hand+[0,0,.020],hand-[0,0,.020]]
bladeFaces=[[0,2,3],[2,1,3],[1,2,4],[2,0,4],[0,3,1],[1,4,0]]
bladeMesh=trimesh.Trimesh(vertices=np.array(bladeVerts),faces=np.array(bladeFaces),process=False)
bladeMesh.visual.material=steel;result.add_geometry(bladeMesh,geom_name='Separate_forged_longsword_blade')
pommel=hand-length*.22
attach_rod('Sword_ornamented_grip',pommel,hand,.025,bronze)
attach_rod('Sword_crossguard',hand+[-.14,-.014,0],hand+[.14,.014,0],.014,bronze)
attach_rod('Sword_pommel',pommel,pommel-length*.04,.04,bronze)
result.export(sys.argv[2])
print('WROTE',sys.argv[2], 'TRIS',len(hull.faces),'FABRIC_TRIS',len(fabric.faces))
