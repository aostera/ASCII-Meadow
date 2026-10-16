// Unit-check original world projection and unchanged authored map placement.
import assert from 'node:assert/strict';
import {
 projectedPixel,anchorForSource,projectToNativeWorld,
 nativeCameraFrame,createNativeSourceWorld,configureNativeCamera
} from '../../experiments/three/source-world.mjs';
const approx=(got,want,msg)=>assert.ok(Math.abs(got-want)<1e-6,msg+': expected '+want+', got '+got);
const pitch=.87,s=Math.sin(pitch),c=Math.cos(pitch);
const anchor=[5400,2400],scale=.75;
const W=1280,H=800,VZ=1,camLeft=4800,camTop=2000;
const camera=nativeCameraFrame(W,H,VZ,camLeft,camTop,pitch);
for(const p of [[0,0,0],[10,20,30],[-400,170,400],[3,420,-50]]){
 const [px,py]=projectedPixel(p,anchor,scale,pitch);
 const [nx,ny,nz]=projectToNativeWorld(p,anchor,scale,pitch);
 const delta=[nx-camera.target[0],ny-camera.target[1],nz-camera.target[2]];
 approx(W/2-delta[0]*VZ,(px-camLeft)*VZ,'native X equals original pixel');
 approx(H/2-(delta[1]*c+delta[2]*s)*VZ,(py-camTop)*VZ,'native Y equals original pixel');
}
const cat={kx:4500,ky:3600,ox:4800,oy:3900};
const site={id:'abbey',type:'abbey',x:-301.4,z:-946.9,yaw:2.5398};
assert.deepEqual(anchorForSource('castle',null,cat,1.5,pitch),[4500,3600]);
const ruin=anchorForSource('ruin',site,cat,1.5,pitch);
approx(ruin[0],4800+site.x*1.5,'ruin X uses authored map');
approx(ruin[1],3900-site.z*s*1.5,'ruin Y uses authored map');
const fakeTHREE={Group:class {
 constructor(){this.children=[];this.userData={}}
 add(mesh){this.children.push(mesh)}
}};
const makeMesh=()=>{
 const mesh={
   position:{set(x,y,z){mesh.pos=[x,y,z]}},
   scale:{set(x,y,z){mesh.size=[x,y,z]}},
   userData:{sourceStatistics:{solids:12,skipped:0,triangles:44,drawCalls:2}}
 };
 return mesh;
};
const solids=[{kind:'castle'}],originalSite=JSON.stringify(site),calls=[];
const root=createNativeSourceWorld(fakeTHREE,{
 solids,ruinSites:()=>[site],
 ruinDetail:o=>{calls.push('built:'+o.id);solids.push({kind:'ruin'})},
 ruinRotateMesh:(added,o)=>{assert.equal(added.length,1);calls.push('rotated:'+o.yaw)},
 cathedral:cat,WS:1.5,MS:.8,pitch,
 materials:{},makeSourceArchitecture:()=>makeMesh()
});
assert.equal(solids.length,1,'temporary source solids must not modify castle');
assert.equal(JSON.stringify(site),originalSite,'authored map unchanged');
assert.deepEqual(root.userData.sourceSites,['castle','abbey']);
assert.deepEqual(calls,['built:abbey','rotated:2.5398']);
assert.deepEqual(root.children[0].size,[-.8,.8,.8]);
assert.deepEqual(root.children[1].size,[-1.5,1.5,1.5]);
approx(root.children[1].pos[0],-ruin[0],'native ruin world X');
const camMock={
 position:{set(...p){this.p=p}},
 up:{set(...p){this.p=p}},
 lookAt(...p){this.target=p},
 updateProjectionMatrix(){this.updated=true}
};
const view=configureNativeCamera(null,camMock,{
 W,H,VZ,camX:camLeft/8,camY:camTop/12,CW:8,CH:12,pitch
});
assert.ok(camMock.updated);assert.deepEqual(camMock.target,view.target);
console.log('PASS source world: same projected pixels, castle/ruins relative placement, camera and source immutability');
