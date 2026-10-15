// Download referenced vector artwork unchanged. Never part of server startup.
import {mkdir,writeFile,access} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../public/assets/logos/',import.meta.url);
const cdn=slug=>'https://cdn.worldvectorlogo.com/logos/'+slug+'.svg';
const wiki=(name,project='commons')=>{const file=name.replaceAll(' ','_'),hash=createHash('md5').update(file).digest('hex');return 'https://upload.wikimedia.org/wikipedia/'+project+'/'+hash[0]+'/'+hash.slice(0,2)+'/'+encodeURIComponent(file);};
const sources={cocacola:cdn('coca-cola-logo'),shell:cdn('shell-4'),renault:cdn('renault-7'),gulf:cdn('gulf-logo'),handicap:wiki('International Symbol of Access.svg'),worldcup:cdn('fifa-world-cup-2026-3'),mercedes:cdn('mercedes-benz-9'),redbull:cdn('redbullenergydrink'),avengers:cdn('avengers-1'),ferrari:cdn('ferrari-4'),leagueoflegends:'https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/039a7a75db4ec01820c6289b30258ee03320de22.zip',ricard:wiki('Logo Ricard.svg','fr')};
function officialLogoFromZip(buffer){
  // Read only this explicitly named SVG, never extract arbitrary archive paths.
  const wanted='LoL_Logo_Gold/LoL_Logo_Flat_GOLD.svg';
  for(let offset=0;offset<buffer.length-46;offset++){
    if(buffer.readUInt32LE(offset)!==0x02014b50)continue;
    const nameLength=buffer.readUInt16LE(offset+28),name=buffer.subarray(offset+46,offset+46+nameLength).toString();
    if(name!==wanted)continue;
    const method=buffer.readUInt16LE(offset+10),size=buffer.readUInt32LE(offset+20),local=buffer.readUInt32LE(offset+42);
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28),data=buffer.subarray(start,start+size);
    if(method===0)return data.toString();
    if(method===8)return inflateRawSync(data,{maxOutputLength:100000}).toString();
    throw Error('Unsupported ZIP method');
  }
  throw Error('Official SVG missing in Riot archive');
}
await mkdir(root,{recursive:true});
for(const [id,url] of Object.entries(sources)){
  const destination=new URL(id+'.svg',root);
  try{await access(destination);console.log(id+': already present');continue;}catch{}
  const response=await fetch(url,{headers:{'User-Agent':'RollRushAssetImport/1.0 (local game asset reference)'},signal:AbortSignal.timeout(20000)});
  const svg=url.endsWith('.zip')&&response.ok?officialLogoFromZip(Buffer.from(await response.arrayBuffer())):await response.text();
  if(!response.ok||!/<svg[\s>]/i.test(svg)||svg.length>2000000||/<(?:script|foreignObject)\b|\bonload\s*=/i.test(svg))throw Error(id+': unsafe or unavailable SVG '+response.status);
  await writeFile(destination,svg);console.log(id+': '+Buffer.byteLength(svg)+' bytes from '+url);
}
