import {createCourse,pointAt} from './racing.js';
import {distanceToRoute} from './motion.js';
import {groundHeight} from './environment-math.js';

// Instanced landmarks and silhouettes: density grows with length, not draw calls.
export function decorateHorizons(THREE,root,track){
  const course=createCourse(track),palette=track.palette,batches=new Map(),pose=new THREE.Object3D();
  root.userData.timeUniforms=[];root.userData.animated=[];root.userData.horizonFootprints=[];
  const shapes={box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,8),rock:new THREE.IcosahedronGeometry(1,0),pole:new THREE.CylinderGeometry(1,1,1,8),orb:new THREE.SphereGeometry(1,12,8)};
  function add(shape,color,x,y,z,sx,sy,sz,glow=false){
    const key=shape+color+glow;
    if(!batches.has(key))batches.set(key,{shape,color,glow,items:[]});
    batches.get(key).items.push([x,y,z,sx,sy,sz]);
  }
  let n=0;
  for(let along=15;along<course.total;along+=19)for(const side of [-1,1]){
    const p=pointAt(course,along,side*(track.width+18+(n%3)*5));n++;
    if(distanceToRoute(p.x,p.z,track.route)<track.width+12)continue;
    const {x,z}=p,y=groundHeight(track,x,z);
    root.userData.horizonFootprints.push({x,z,radius:10});
    if(track.id==='canyon'){
      if(n%3){
        const height=8+n%13;
        add('rock',palette.stone,x,y+height*.5,z,7,height*.7,7);
        add('rock','#efb570',x,y+height,z,5,2,5);
      }else{
        add('pole','#618255',x,y+3,z,.7,6,.7);
        add('box','#618255',x+1.4,y+3.5,z,2.8,.7,.7);
        add('pole','#618255',x+2.6,y+4.4,z,.5,2,.5);
      }
    }else if(track.id==='glacier'){
      add('cone','#94d8ef',x,y+7,z,4,14+n%7,4);
      add('cone','#edfcff',x+3,y+4,z+2,3,8,3);
      add('rock','#5fa4c8',x-3,y+1,z,4,2,3);
    }else if(track.id==='volcano'){
      add('cone','#392f3a',x,y+7,z,9,14,9);
      add('cone','#ef673c',x,y+13,z,2.4,2,2.4,true);
      for(let j=0;j<3;j++)add('orb','#a46362',x+j*.5,y+16+j*2.7,z,1.4+j*.6,1.5+j*.6,1.4+j*.6);
      add('rock','#f89c3f',x-4,y+.2,z+5,3,.15,1,true);
    }else if(track.id==='jungle'){
      if(n%4){
        add('pole','#68533e',x,y+4,z,.65,8,.65);
        add('orb','#246b49',x,y+8,z,6,3,5);
        add('orb','#61a760',x-1,y+10,z,4,2,4);
      }else{
        for(let j=0;j<5;j++)add('box',j%2?'#b6ac7b':'#848c68',x,y+.7+j*1.3,z,12-j*1.9,1.4,12-j*1.9);
        add('box','#d8ce8c',x,y+7.5,z,3,2.5,3);
        add('box','#254c43',x,y+7.5,z-1.55,1.2,1.7,.1);
      }
    }else{
      const color=['#ce7254','#4c91a2','#d4af55'][n%3];
      add('box',color,x,y+1.7,z,6,3.4,9);
      for(let j=-2;j<=2;j++)add('box','#b2c0c8',x+j,y+1.7,z-4.55,.08,3,.1);
      if(n%4===0){
        add('box','#e7bd59',x-7,y+7,z,1,14,1);
        add('box','#e7bd59',x,y+14,z,16,.8,1);
        add('pole','#b2c0c8',x+6,y+11,z,.08,6,.08);
        add('box','#e7bd59',x+6,y+8,z,1.2,.5,1.2);
        add('orb','#ffe6ac',x-7,y+15,z,.35,.35,.35,true);
      }
    }
  }
  // Mountain skyline lies outside the entire circuit envelope.
  const radius=Math.max(...track.route.map(p=>Math.hypot(...p)))+65;
  for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,h=22+i%5*7;
    add('cone',palette.stone,x,h*.35-5,z,22,h,22);
    if(track.id==='glacier')add('cone','#f4fbff',x,h*.66-5,z,10,h*.4,10);
  }
  const g=course.finishGate;
  for(const side of [-1,1])add('box',track.accent,g.x-g.tz*10*side,3.8,g.z+g.tx*10*side,.7,7.6,.7);
  // All five starts face +X, so the beam spans Z.
  add('box','#132e48',g.x,7.5,g.z,.7,1,21);
  add('box',track.accent,g.x-.4,7.5,g.z,.1,.35,19,true);
  const used=new Set();
  for(const b of batches.values()){
    const mesh=new THREE.InstancedMesh(shapes[b.shape],new THREE.MeshStandardMaterial({color:b.color,roughness:.78,emissive:b.glow?b.color:'#000000',emissiveIntensity:b.glow?.7:0}),b.items.length);
    mesh.name='horizon-'+b.shape;mesh.castShadow=!b.glow;mesh.receiveShadow=true;used.add(b.shape);
    b.items.forEach(([x,y,z,sx,sy,sz],i)=>{pose.position.set(x,y,z);pose.scale.set(sx,sy,sz);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
    mesh.computeBoundingSphere();root.add(mesh);
  }
  for(const [name,g] of Object.entries(shapes))if(!used.has(name))g.dispose();
}
