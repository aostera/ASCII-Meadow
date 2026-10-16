// Pure geometric envelope of the temporary Gothic longsword's actual
// diamond-section blade stations. Shared with the rendered 3D blade;
// avoids pretending a zero-width line can detect mesh penetration.
export const ASHEN_BLADE_STATIONS=[
  [-.045,.022,.0053],[-.085,.021,.005],[-.135,.0195,.0047],
  [-.215,.017,.004],[-.30,.0135,.003],[-.37,.0095,.0024],
  [-.422,.0054,.0013],[-.475,.0003,.0002]
];

// Input must already be sword-local coordinates, in original GLB units.
// Negative clearance means the point lies INSIDE the interpolated diamond
// blade envelope. This checks sample VERTICES, not whole character triangles.
export function pointBladeGap(x,y,z){
  if(![x,y,z].every(Number.isFinite))return NaN;
  const top=ASHEN_BLADE_STATIONS[0],tip=ASHEN_BLADE_STATIONS.at(-1);
  const clamped=Math.max(tip[0],Math.min(top[0],y));
  let width=tip[1],depth=tip[2];
  for(let i=0;i<ASHEN_BLADE_STATIONS.length-1;i++){
    const a=ASHEN_BLADE_STATIONS[i],b=ASHEN_BLADE_STATIONS[i+1];
    if(clamped<=a[0]&&clamped>=b[0]){
      const u=(a[0]-clamped)/(a[0]-b[0]);
      width=a[1]+(b[1]-a[1])*u;
      depth=a[2]+(b[2]-a[2])*u;
      break;
    }
  }
  // Distance to the authentic diamond contour in the absolute quadrant:
  // line segment (width,0) -> (0,depth), projected orthogonally.
  const px=Math.abs(x),pz=Math.abs(z);
  const t=Math.max(0,Math.min(1,
    ((px-width)*(-width)+pz*depth)/(width*width+depth*depth)));
  const edgeX=width*(1-t),edgeZ=depth*t;
  const crossDistance=Math.hypot(px-edgeX,pz-edgeZ);
  const inSection=px/width+pz/depth<1;
  const axial=Math.abs(y-clamped);
  if(axial<1e-9&&inSection)return -crossDistance;
  return Math.hypot(inSection?0:crossDistance,axial);
}
