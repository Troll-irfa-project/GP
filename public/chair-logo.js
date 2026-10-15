import {allLogos as logos} from './logo-catalog.js';

// One shared 512x256 canvas per selected logo, never recreated per frame/car.
const textures=new Map();
export function attachChairLogo(THREE,body,spec,logoId){
  const badge=new THREE.Group();badge.name='logo-mount';
  badge.position.set(0,.84+spec.back*.72,.626);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.80,.43,.025),new THREE.MeshStandardMaterial({color:'#182537',roughness:.55,metalness:.3}));
  plate.name='logo-plate';badge.add(plate);
  const logo=logos.find(l=>l.id===logoId);
  if(logo){
    let texture=textures.get(logo.id);
    if(!texture&&typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,512,256);
      texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.userData.shared=true;textures.set(logo.id,texture);
      const image=new Image();image.onload=()=>{
        const scale=Math.min(480/image.naturalWidth,224/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
        ctx.drawImage(image,(512-w)/2,(256-h)/2,w,h);texture.needsUpdate=true;
      };image.src=logo.art;
    }
    const sticker=new THREE.Mesh(new THREE.PlaneGeometry(.76,.38),new THREE.MeshBasicMaterial({map:texture||null,color:'#ffffff',toneMapped:false}));
    sticker.name='chair-logo';sticker.position.z=.014;sticker.userData.logoId=logo.id;badge.add(sticker);
  }
  body.add(badge);return badge;
}
