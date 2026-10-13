import * as THREE from 'three';
import { pitZone } from './endurance.js';
// The service lane is painted within the existing asphalt corridor: no new solid
// scenery blocks the racing line or creates a shortcut through checkpoints.
export function createPitVisuals(course){
  const zone=pitZone(course),root=new THREE.Group();root.name='endurance-pit';
  root.position.set(zone.x,.415,zone.z);root.rotation.y=Math.atan2(zone.tx,zone.tz);
  const cyan=new THREE.MeshBasicMaterial({color:'#3debd9',transparent:true,opacity:.35,depthWrite:false});
  const white=new THREE.MeshBasicMaterial({color:'#c6fff6'});
  const patch=new THREE.Mesh(new THREE.PlaneGeometry(zone.halfWidth*2,zone.halfLength*2),cyan);patch.rotation.x=-Math.PI/2;root.add(patch);
  const railGeo=new THREE.BoxGeometry(.07,.025,zone.halfLength*2);
  for(const side of [-1,1]){const rail=new THREE.Mesh(railGeo,white);rail.position.set(side*zone.halfWidth,.018,0);root.add(rail);}
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#072947';ctx.fillRect(0,0,256,512);ctx.strokeStyle='#59f7e7';ctx.lineWidth=12;ctx.strokeRect(6,6,244,500);
  ctx.fillStyle='#e6fff9';ctx.textAlign='center';ctx.font='bold 82px Arial';ctx.fillText('PIT',128,135);ctx.font='bold 135px Arial';ctx.fillText('E',128,305);ctx.font='bold 120px Arial';ctx.fillText('↑',128,450);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,4.8),new THREE.MeshBasicMaterial({map:texture}));sign.rotation.x=-Math.PI/2;sign.rotation.z=Math.PI;sign.position.set(0,.025,0);root.add(sign);
  root.userData.zone=zone;return root;
}
