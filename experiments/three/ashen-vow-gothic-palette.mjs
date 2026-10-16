// Optional material study for the REAL skinned Tripo V2 model, studio ONLY.
// A reversible vertex-color tint, not a mesh substitute, new texture, or
// an approved character skin. Existing GLB textures, bones and skin weights stay intact.
import * as THREE from 'three';

const STEEL=new THREE.Color(0x4b4852);
const DARK_STEEL=new THREE.Color(0x28272e);
const BURGUNDY=new THREE.Color(0x4d2431);
const HOOD=new THREE.Color(0x42222d);
const BONE=new THREE.Color(0xd8cdbb);
const CLOTH=new THREE.Color(0xbeb4a5);
const LEATHER=new THREE.Color(0x6b4a3f);
const EYES=new THREE.Color(0x130f14);
const smooth=(a,b,v)=>{
  const t=Math.min(1,Math.max(0,(v-a)/(b-a)));
  return t*t*(3-2*t);
};
const blend=(out,color,amount)=>out.lerp(color,Math.min(1,Math.max(0,amount)));

function shadeVertices(mesh){
  const geo=mesh.geometry;
  const positions=geo.attributes.position;
  if(!positions)return null;
  const colors=new Float32Array(positions.count*3);
  const skinIndices=geo.attributes.skinIndex;
  const skinWeights=geo.attributes.skinWeight;
  const col=new THREE.Color();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const width=Math.abs(z);
    col.copy(y<.45?DARK_STEEL:STEEL);
    // Crown hood: retain a dark silhouette and keep the bone face separate.
    const hood=smooth(.68,.76,y)*(1-smooth(.065,.14,x));
    blend(col,HOOD,hood*.92);
    // Cloth back: use original Tripo clothing joints and spatial silhouette,
    // rather than tinting a solid red block across the whole torso.
    let clothJoint=0;
    if(skinIndices&&skinWeights){
      for(let j=0;j<4;j++){
        const index=skinIndices.getComponent(i,j);
        if(index>=36&&index<=39)clothJoint+=skinWeights.getComponent(i,j);
      }
    }
    const rear=1-smooth(-.19,-.02,x);
    const cape=Math.max(clothJoint*.9,rear*smooth(.08,.19,width))*
      (1-smooth(.69,.80,y));
    blend(col,BURGUNDY,cape*.93);
    // Old white tabard is a vertical cloth plane in front of armour.
    const tabard=smooth(.06,.13,x)*(1-smooth(.125,.19,width))*
      smooth(.18,.28,y)*(1-smooth(.69,.78,y));
    blend(col,CLOTH,tabard*.92);
    // Parchment mask and black eye sockets preserve the locked silhouette.
    const face=smooth(.035,.065,x)*(1-smooth(.11,.165,width))*
      smooth(.79,.825,y)*(1-smooth(.955,.99,y));
    blend(col,BONE,face);
    const eyes=face*smooth(.845,.86,y)*(1-smooth(.905,.925,y))*
      smooth(.025,.038,width)*(1-smooth(.089,.104,width));
    blend(col,EYES,eyes);
    // Leather belt and straps are subdued; original texture detail stays.
    const belt=smooth(.43,.49,y)*(1-smooth(.54,.59,y))*
      smooth(.055,.12,x);
    blend(col,LEATHER,belt*.26);
    const k=i*3;colors[k]=col.r;colors[k+1]=col.g;colors[k+2]=col.b;
  }
  return new THREE.Float32BufferAttribute(colors,3);
}

export function createGothicPalettePreview(root,{enabled=true}={}){
  const records=[];
  root.traverse(obj=>{
    if(!obj.isSkinnedMesh)return; // never recolor the separate wrist sword
    const attribute=shadeVertices(obj);
    if(!attribute)return;
    records.push({
      mesh:obj,originalColor:obj.geometry.getAttribute('color')||null,
      originalMaterial:obj.material,
      palette:attribute
    });
  });
  let applied=false;
  function setEnabled(next){
    applied=Boolean(next);
    for(const item of records){
      const {mesh,originalMaterial,originalColor,palette}=item;
      if(applied){
        mesh.geometry.setAttribute('color',palette);
        if(!item.tintedMaterial){
          const tint=m=>{
            const copy=m.clone();
            copy.vertexColors=true;
            // Retain source roughness/metalness/normal maps. This is a
            // color experiment, not a replacement of the approved texture.
            return copy;
          };
          item.tintedMaterial=Array.isArray(originalMaterial)?
            originalMaterial.map(tint):tint(originalMaterial);
        }
        mesh.material=item.tintedMaterial;
      }else{
        if(originalColor)mesh.geometry.setAttribute('color',originalColor);
        else mesh.geometry.deleteAttribute('color');
        mesh.material=originalMaterial;
      }
    }
    return applied;
  }
  setEnabled(enabled);
  return {
    get enabled(){return applied},
    get skinnedMeshes(){return records.length},
    setEnabled,
    dispose(){
      setEnabled(false);
      for(const item of records){
        for(const m of Array.isArray(item.tintedMaterial)?item.tintedMaterial:
          (item.tintedMaterial?[item.tintedMaterial]:[]))m.dispose();
      }
      records.length=0;
    }
  };
}
