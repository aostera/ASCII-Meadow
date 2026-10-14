// Convert ASCII Meadow's actual raycast castle/ruin solids into native 3D mesh
// triangles. No hand-modeled substitutes, color edits, or opacity changes.
// This is a geometric source migration, NOT a replacement for the proven
// original-pixel rasterizer. The UI may opt into a future 3D architectural pass.
//
// Original primitive format: {kind, pl: [[nx,ny,nz,d]...], bb:[x0,x1,y0,y1,z0,z1]}.
// Each plane is an outward half-space nx*x+ny*y+nz*z <= d.

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0]
];
const length=v=>Math.hypot(v[0],v[1],v[2]);
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];

export function planeIntersection(a,b,c){
  const na=a.slice(0,3),nb=b.slice(0,3),nc=c.slice(0,3);
  const bxc=cross(nb,nc),cxa=cross(nc,na),axb=cross(na,nb);
  const det=dot(na,bxc);
  if(Math.abs(det)<1e-9)return null;
  return mul(add(add(mul(bxc,a[3]),mul(cxa,b[3])),mul(axb,c[3])),1/det);
}

export function solidFaces(solid){
  if(!solid||!Array.isArray(solid.pl)||solid.pl.length<4)return [];
  const planes=solid.pl;
  const points=[];
  // Every vertex of a bounded convex solid lies at a triple-plane intersection.
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)
    for(let k=j+1;k<planes.length;k++){
      const v=planeIntersection(planes[i],planes[j],planes[k]);
      if(!v||!v.every(Number.isFinite))continue;
      // Relative tolerance protects geometry spanning hundreds of map units.
      if(planes.some(p=>dot(p,v)-p[3]>1e-4+1e-7*Math.abs(p[3])))continue;
      if(points.some(p=>length(sub(p,v))<1e-3))continue;
      points.push(v);
    }
  const faces=[];
  for(const p of planes){
    const n=p.slice(0,3),nn=length(n);
    if(nn<1e-9)continue;
    const verts=points.filter(v=>Math.abs(dot(n,v)-p[3])/nn<1e-3);
    if(verts.length<3)continue;
    const center=mul(verts.reduce((s,v)=>add(s,v),[0,0,0]),1/verts.length);
    const N=mul(n,1/nn);
    const seed=Math.abs(N[1])<.9?[0,1,0]:[1,0,0];
    const u=cross(seed,N),ul=length(u);
    if(ul<1e-9)continue;
    const U=mul(u,1/ul),V=cross(N,U);
    verts.sort((a,b)=>{
      const aa=sub(a,center),bb=sub(b,center);
      return Math.atan2(dot(aa,V),dot(aa,U))-Math.atan2(dot(bb,V),dot(bb,U));
    });
    faces.push({normal:N,vertices:verts});
  }
  return faces;
}

export function triangulateSourceSolids(solids){
  const groups=new Map();
  let skipped=0,sourceCount=0,triangles=0;
  for(const solid of solids){
    if(!solid?.pl?.length)continue;
    sourceCount++;
    const faces=solidFaces(solid);
    if(!faces.length){skipped++;continue;}
    const kind=solid.kind||'wall';
    if(!groups.has(kind))groups.set(kind,{kind,positions:[],normals:[],sourceSolids:0,triangles:0});
    const g=groups.get(kind);
    g.sourceSolids++;
    for(const face of faces){
      const vs=face.vertices,N=face.normal;
      for(let k=1;k+1<vs.length;k++){
        const a=vs[0],b=vs[k],c=vs[k+1];
        if(length(cross(sub(b,a),sub(c,a)))<1e-6)continue;
        g.positions.push(...a,...b,...c);
        g.normals.push(...N,...N,...N);
        g.triangles++;triangles++;
      }
    }
  }
  return {groups:[...groups.values()],sourceCount,skipped,triangles};
}

// The source raycaster and Three now share the same convex faces. Material
// styling stays isolated from the production ASCII renderer and is deferred
// until the art-director accepts an optional true 3D architectural view.
export function makeSourceArchitecture(THREE,solids,materialsByKind){
  const data=triangulateSourceSolids(solids);
  const group=new THREE.Group();
  for(const item of data.groups){
    if(!item.positions.length)continue;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(item.normals,3));
    geo.computeBoundingSphere();
    const material=materialsByKind[item.kind]||materialsByKind.wall;
    if(!material)throw Error('Source architecture needs explicit material for '+item.kind);
    const mesh=new THREE.Mesh(geo,material);
    mesh.name='source-'+item.kind;
    mesh.userData.sourceSolids=item.sourceSolids;
    group.add(mesh);
  }
  group.userData.sourceStatistics={
    solids:data.sourceCount,skipped:data.skipped,triangles:data.triangles,
    drawCalls:group.children.length
  };
  return group;
}
