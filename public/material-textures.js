const cache=new Map();
export function surfaceTexture(THREE,key,base='#777',accent='#fff'){
  if(typeof document==='undefined')return null;
  const id=`${key}/${base}/${accent}`;if(cache.has(id))return cache.get(id);
  const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');
  ctx.fillStyle=base;ctx.fillRect(0,0,size,size);let seed=key.length*97+base.length*31+accent.length*13;
  const random=()=>((seed=seed*1664525+1013904223>>>0)/4294967296);
  if(key==='paint'){
    ctx.globalAlpha=.14;ctx.strokeStyle=accent;ctx.lineWidth=2;for(let i=-size;i<size*2;i+=22){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+size,size);ctx.stroke();}
    ctx.globalAlpha=.4;for(let i=0;i<420;i++){ctx.fillStyle=i%3?'#ffffff':'#111827';ctx.fillRect(random()*size,random()*size,1+random()*2,1+random()*2);}
    ctx.globalAlpha=.22;ctx.strokeStyle='#ffffff';ctx.lineWidth=1;for(let i=0;i<7;i++){const y=20+i*37;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y+random()*8);ctx.stroke();}
  }else if(key==='fabric'){
    ctx.globalAlpha=.2;ctx.strokeStyle=accent;ctx.lineWidth=2;for(let i=0;i<size;i+=8){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}
    ctx.globalAlpha=.12;ctx.fillStyle='#ffffff';for(let i=0;i<500;i++)ctx.fillRect(random()*size,random()*size,2,2);
  }else if(key==='metal'){
    ctx.globalAlpha=.25;ctx.strokeStyle=accent;ctx.lineWidth=1;for(let i=0;i<120;i++){const y=random()*size;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y+random()*5-2);ctx.stroke();}
    ctx.globalAlpha=.42;ctx.fillStyle='#ffffff';for(let i=0;i<22;i++){ctx.beginPath();ctx.arc(random()*size,random()*size,1.5+random()*2,0,Math.PI*2);ctx.fill();}
  }else if(key==='rubber'){
    ctx.globalAlpha=.24;ctx.fillStyle=accent;for(let y=-size;y<size*2;y+=26)for(let x=-size;x<size*2;x+=32){ctx.save();ctx.translate(x,y);ctx.rotate(-.35);ctx.fillRect(0,0,18,8);ctx.restore();}
    ctx.globalAlpha=.25;ctx.fillStyle='#000000';for(let i=0;i<160;i++)ctx.fillRect(random()*size,random()*size,2+random()*5,1+random()*2);
  }else if(key==='stone'){
    ctx.globalAlpha=.22;ctx.strokeStyle=accent;ctx.lineWidth=2;for(let i=0;i<28;i++){let x=random()*size,y=random()*size;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<3;j++){x+=random()*34-17;y+=random()*28-14;ctx.lineTo(x,y);}ctx.stroke();}
    ctx.globalAlpha=.22;ctx.fillStyle='#ffffff';for(let i=0;i<220;i++){ctx.beginPath();ctx.arc(random()*size,random()*size,1+random()*4,0,Math.PI*2);ctx.fill();}
  }else if(key==='ground'){
    ctx.globalAlpha=.22;ctx.strokeStyle=accent;ctx.lineWidth=1;for(let i=0;i<420;i++){const x=random()*size,y=random()*size;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-2+random()*5,y-4-random()*9);ctx.stroke();}
    ctx.globalAlpha=.16;ctx.fillStyle='#183c27';for(let i=0;i<260;i++)ctx.fillRect(random()*size,random()*size,1+random()*4,1+random()*3);
  }else if(key==='curb'){
    ctx.globalAlpha=.34;ctx.fillStyle=accent;for(let x=-size;x<size*2;x+=48){ctx.save();ctx.translate(x,0);ctx.rotate(-.48);ctx.fillRect(0,0,25,size*2);ctx.restore();}
    ctx.globalAlpha=.3;ctx.fillStyle='#111827';for(let x=-size;x<size*2;x+=96){ctx.save();ctx.translate(x,0);ctx.rotate(-.48);ctx.fillRect(0,0,7,size*2);ctx.restore();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;const repeat=key==='ground'?3:key==='paint'?2:1.5;texture.repeat.set(repeat,repeat);texture.anisotropy=8;cache.set(id,texture);return texture;
}
