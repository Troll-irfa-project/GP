import * as THREE from 'three';
import { surfaceTexture } from './material-textures.js';

// Fixed pools, shared geometry/materials: no asset creation in the render loop.
export function createItemVisuals(scene) {
  const root=new THREE.Group();root.name='race-items';scene.add(root);
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
  const geometry=new THREE.BoxGeometry(1,1,1);
  const cubeMat=new THREE.MeshStandardMaterial({color:'#49cffa',map:surfaceTexture(THREE,'paint','#49cffa','#d9fbff'),metalness:.45,roughness:.2,emissive:'#0b6385',emissiveIntensity:.8});
  const cubes=new THREE.InstancedMesh(geometry,cubeMat,12);cubes.name='mystery-boxes';
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#102b55';ctx.fillRect(0,0,128,128);
  ctx.strokeStyle='#ffe665';ctx.lineWidth=9;ctx.strokeRect(7,7,114,114);
  ctx.fillStyle='#fff1a0';ctx.font='bold 100px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',64,68);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const faceMat=new THREE.MeshBasicMaterial({map:texture});
  const faces=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.16,1.16),faceMat,48);faces.name='mystery-question-marks';
  const ringMat=new THREE.MeshBasicMaterial({color:'#59e7ff',transparent:true,opacity:.65,depthWrite:false});
  const shards=new THREE.InstancedMesh(geometry,faceMat,72);shards.name='mystery-opening-shards';
  const rings=new THREE.InstancedMesh(new THREE.TorusGeometry(1.2,.045,4,20),ringMat,12);rings.name='mystery-halos';
  const ladderMat=new THREE.MeshStandardMaterial({color:'#ffbf48',map:surfaceTexture(THREE,'metal','#ffbf48','#fff0a0'),metalness:.65,roughness:.35});
  const ladders=new THREE.InstancedMesh(geometry,ladderMat,24*13);ladders.name='ladder-traps';
  const shotMat=new THREE.MeshBasicMaterial({color:'#fff19a',transparent:true,opacity:.85});
  const shots=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.045,1,5),shotMat,24);shots.name='item-shot-trails';
  for(const mesh of [cubes,faces,rings,ladders,shots,shards]){mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);}
  function matrix(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  return {root,update(world,now){
    root.visible=Boolean(world?.enabled);if(!root.visible)return;
    let count=0,faceCount=0,shardCount=0;
    for(const box of world.boxes){
      if(box.respawn>0){
        const elapsed=8-box.respawn;
        if(elapsed<.45)for(let i=0;i<6;i++){const angle=i*Math.PI/3,spread=.8+elapsed*4,size=.25*(1-elapsed/.45);matrix(shards,shardCount++,box.x+Math.cos(angle)*spread,1.8+elapsed*2,box.z+Math.sin(angle)*spread,size,size,size,angle+elapsed*6,angle);}
        continue;
      }
      const t=now*.001+Number(box.id.split('-')[1]),y=1.8+Math.sin(t*2)*.2,yaw=t*.7;
      matrix(cubes,count,box.x,y,box.z,1.4,1.4,1.4,0,yaw);
      for(let i=0;i<4;i++){const a=yaw+i*Math.PI/2;matrix(faces,faceCount++,box.x+Math.sin(a)*.706,y,box.z+Math.cos(a)*.706,1,1,1,0,a);}
      matrix(rings,count++,box.x,.47,box.z,1,1,1,Math.PI/2);
    }
    cubes.count=rings.count=count;faces.count=faceCount;shards.count=shardCount;
    let rail=0;
    for(const trap of world.traps){
      const yaw=Math.atan2(trap.tx,trap.tz),width=trap.halfWidth*2;
      for(const offset of [-.48,.48])matrix(ladders,rail++,trap.x+trap.tx*offset,.61,trap.z+trap.tz*offset,width,.16,.13,0,yaw);
      for(let i=0;i<11;i++){const across=(i/10-.5)*width;matrix(ladders,rail++,trap.x-trap.tz*across,.61,trap.z+trap.tx*across,.12,.13,.96,0,yaw);}
    }
    ladders.count=rail;
    let shot=0;
    for(const s of world.shots.slice(-24)){
      direction.set(s.targetX-s.x,0,s.targetZ-s.z);const length=direction.length();
      dummy.position.set((s.x+s.targetX)/2,1.5,(s.z+s.targetZ)/2);dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.scale.set(1,length,1);dummy.updateMatrix();shots.setMatrixAt(shot++,dummy.matrix);
    }
    shots.count=shot;
    for(const mesh of [cubes,faces,rings,ladders,shots,shards])mesh.instanceMatrix.needsUpdate=true;
  }};
}
