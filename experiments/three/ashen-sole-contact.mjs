// Pure CPU-side source-foot surface selection. Does not require WebGL or Three.
// Uses the owner's genuine GLB skin joint weights; NEVER creates replacement geometry.
// Select small, actual weighted lower-boot mesh regions once at load.
// Sample REAL CPU-skinned GLB triangles thereafter, not joint positions.
// The sole proxy remains a vertex-point diagnostic, NOT collision physics.
export function locateBootSoleVertices(meshes,legSets){
  const pairs=[legSets.leftLeg,legSets.rightLeg];
  return pairs.map((leg,side)=>{
    let best=null;
    for(const mesh of meshes){
      if(!mesh.isSkinnedMesh||!mesh.skeleton)continue;
      const geo=mesh.geometry,p=geo?.attributes?.position;
      const si=geo?.attributes?.skinIndex,sw=geo?.attributes?.skinWeight;
      if(!p||!si||!sw)continue;
      const footJointIndices=new Set([leg[2],leg[3]].map(b=>mesh.skeleton.bones.indexOf(b))
        .filter(i=>i>=0));
      if(!footJointIndices.size)continue;
      const candidates=[];let lowY=Infinity;
      for(let i=0;i<p.count;i++){
        let weight=0;
        for(let j=0;j<4;j++)if(footJointIndices.has(si.getComponent(i,j)))
          weight+=sw.getComponent(i,j);
        if(weight<.42)continue;
        const x=p.getX(i),y=p.getY(i);
        if(!Number.isFinite(x+y))continue;
        candidates.push({i,x,y});
        lowY=Math.min(lowY,y);
      }
      if(!candidates.length)continue;
      // The bottom ~7cm of the source GLB boots. A rigid mesh component
      // outside this band is never mistaken for the ground-contact sole.
      const lower=candidates.filter(v=>v.y<=lowY+.07);
      if(lower.length<12)continue;
      lower.sort((a,b)=>a.x-b.x);
      const choose=(a,start,end,count)=>Array.from({length:count},(_,k)=>
        a[Math.round(start+(end-start)*(k+.5)/count)]?.i).filter(Number.isInteger);
      const n=lower.length;
      const heel=choose(lower,0,Math.max(0,n*.24),4);
      const toe=choose(lower,Math.max(0,n*.76),n-1,4);
      const middle=choose(lower,Math.max(0,n*.30),Math.max(0,n*.70),4);
      const indices=[...new Set([...heel,...middle,...toe])];
      if(!best||lower.length>best.candidateCount)
        best={mesh,side,candidateCount:lower.length,indices,
          heel:heel.filter(i=>indices.includes(i)),
          toe:toe.filter(i=>indices.includes(i))};
    }
    return best;
  });
}
