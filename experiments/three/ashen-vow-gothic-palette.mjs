// Optional material study for the REAL skinned Tripo V2 model, studio ONLY.
// A reversible vertex-color tint, not a mesh substitute, new texture, or
// an approved character skin. Existing GLB textures, bones and skin weights stay intact.
import * as THREE from 'three';

// V20 ARTOUT: tone the actual source vertices using subtle multipliers,
// without repainting the entire torso off-white or replacing the Tripo GLB.
// This remains an opt-in material study until its screenshots are approved.
const ARMOR=new THREE.Color(0x919aa5);
const LIT_STEEL=new THREE.Color(0xb1b7bd);
const SHADE=new THREE.Color(0x727b85);
const CAPE=new THREE.Color(0x884c56);
const TABARD=new THREE.Color(0xb1a18c);
const LEATHER=new THREE.Color(0x6a5952);
const HOOD=new THREE.Color(0x65616a);
const VISOR=new THREE.Color(0x716c6e);
const blend=(c,next,t)=>c.lerp(next,Math.max(0,Math.min(1,t)));
const smooth=(a,b,v)=>{
 const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);
};

function shadeVertices(mesh){
 const geo=mesh.geometry,position=geo.attributes.position;
 if(!position)return null;
 const skinIndex=geo.attributes.skinIndex,skinWeight=geo.attributes.skinWeight;
 const values=new Float32Array(position.count*3);
 const base=new THREE.Color();
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  const absZ=Math.abs(z);
  const subtle=Math.sin(x*117+y*53+z*79)*.065;
  base.copy(ARMOR);
  // Vary the metal response by height without introducing a flat
  // untextured white "face", breastplate or uniform white skirt.
  blend(base,LIT_STEEL,(.22+.11*subtle)*smooth(.58,.93,y));
  blend(base,SHADE,.24*(1-smooth(.35,.76,y)));
  // The source cape carries the last four skin joints. Use its actual
  // weights instead of painting a burgundy rectangle across the chest.
  let capeWeight=0;
  if(skinIndex&&skinWeight)for(let j=0;j<4;j++){
    const index=skinIndex.getComponent(i,j);
    if(index>=36&&index<=39)capeWeight+=skinWeight.getComponent(i,j);
  }
  const back=1-smooth(-.17,.025,x);
  const mantle=back*smooth(.11,.23,absZ)*(1-smooth(.86,.99,y));
  blend(base,CAPE,Math.max(capeWeight*.95,mantle*.65));
  // The torn front tabard remains a warm sooty linen, never pure white.
  const front=smooth(.10,.17,x)*(1-smooth(.085,.145,absZ));
  const tabard=front*smooth(.10,.20,y)*(1-smooth(.47,.59,y));
  blend(base,TABARD,tabard*.70);
  const belt=smooth(.40,.46,y)*(1-smooth(.52,.57,y));
  blend(base,LEATHER,belt*.45);
  const hood=smooth(.72,.81,y)*(1-smooth(.045,.11,x));
  blend(base,HOOD,hood*.55);
  const visor=smooth(.80,.85,y)*(1-smooth(.94,.97,y))*
    smooth(.025,.055,x)*(1-smooth(.065,.105,absZ));
  blend(base,VISOR,visor*.35);
  const k=3*i,variation=1+subtle;
  values[k]=base.r*variation;
  values[k+1]=base.g*variation;
  values[k+2]=base.b*variation;
 }
 return new THREE.Float32BufferAttribute(values,3);
}

export function createGothicPalettePreview(root,{enabled=false}={}){
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
            // glTF base material already contains a grey albedo multiplier.
            // Multiplying its albedo AGAIN by dark vertex factors made the
            // entire knight almost BLACK. Use authored vertex colors as the
            // actual preview albedo, while retaining maps/PBR properties.
            if(copy.color)copy.color.set(0xffffff);
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
