// Verify the native Three.js geometry uses the *actual* convex planes of
// ASCII Meadow's original raycaster. No art, brightness or alpha changes.
import assert from 'node:assert/strict';
import {planeIntersection,solidFaces,triangulateSourceSolids} from '../../experiments/three/source-masonry.mjs';

const box={
 kind:'wall',
 pl:[[1,0,0,1],[-1,0,0,1],[0,1,0,1],[0,-1,0,1],[0,0,1,1],[0,0,-1,1]],
 bb:[-1,1,-1,1,-1,1]
};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const hit=planeIntersection(box.pl[0],box.pl[2],box.pl[4]);
assert.ok(hit?.every(v=>Math.abs(v-1)<1e-7),'Three orthogonal planes intersect at exact box corner');
const faces=solidFaces(box);
assert.equal(faces.length,6,'all six original walls of box preserved');
for(const face of faces){
 assert.equal(face.vertices.length,4,'the wall is a true quad, not a fake silhouette');
 const [a,b,c]=face.vertices;
 assert.ok(dot(cross(sub(b,a),sub(c,a)),face.normal)>0,'outward surface winding');
}
const pyramid={
 kind:'spire',
 // Four upward-sloping walls and a real square bottom.
 pl:[[0,-1,0,0],[1,1,0,1],[-1,1,0,1],[0,1,1,1],[0,1,-1,1]],
 bb:[-1,1,0,1,-1,1]
};
const roofFaces=solidFaces(pyramid);
assert.equal(roofFaces.length,5,'roof: 4 nonflat gables + bottom');
const model=triangulateSourceSolids([box,pyramid,{pl:[],kind:'invalid'}]);
assert.equal(model.sourceCount,2);
assert.equal(model.skipped,0);
assert.equal(model.triangles,18,'cube 12 + roof 6 triangles');
assert.equal(model.groups.length,2,'batch meshes by source-material kind');
assert.equal(model.groups.find(g=>g.kind==='wall').triangles,12);
assert.equal(model.groups.find(g=>g.kind==='spire').triangles,6);
for(const g of model.groups){
 assert.equal(g.positions.length,g.normals.length);
 assert.ok(g.positions.every(Number.isFinite));
 assert.ok(g.normals.every(Number.isFinite));
}
console.log('PASS source masonry: real raycast half-spaces -> 6 cube faces + 5 roof faces, 18 valid outward triangles in 2 mesh batches');
