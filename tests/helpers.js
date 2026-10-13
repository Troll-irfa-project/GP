import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const TEST_PASSWORD='Local-QA-password-2026!';
export async function startTestServer(port) {
  const directory=await mkdtemp(join(tmpdir(),'rollrush-test-'));
  let child;
  async function start() {
    child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),DB_PATH:join(directory,'test.sqlite'),ROOM_COUNT:'3'},stdio:'pipe'});
    let output='';child.stderr.on('data',data=>output+=data);child.stdout.on('data',data=>output+=data);
    for(let i=0;i<150;i++) {
      if(child.exitCode!==null) throw new Error('Test server exited: '+output);
      try {if((await fetch(`http://127.0.0.1:${port}/api/me`)).ok)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    throw new Error('Test server did not start: '+output);
  }
  async function stop() {if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
  await start();
  return {url:`http://127.0.0.1:${port}`,directory,async restart(){await stop();await start();},async close(){await stop();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}};
}
export async function register(url, username='QA_'+randomUUID().slice(0,8)) {
  const response=await fetch(url+'/api/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({username,password:TEST_PASSWORD})});
  const value=await response.json();if(!response.ok)throw new Error(value.error);
  return {user:value.user,cookie:response.headers.get('set-cookie').split(';')[0]};
}
export async function signInPage(page,url) {
  const response=await page.request.post(url+'/api/register',{headers:{Origin:url},data:{username:'QA_'+randomUUID().slice(0,8),password:TEST_PASSWORD}});
  if(!response.ok())throw new Error(await response.text());
  return (await response.json()).user;
}
export async function enterGarage(page,room='room-1') {
  await page.locator(`[data-room="${room}"]`).click();
  await page.locator('#roomRoster .room-seat').first().waitFor();
  await page.locator('#roomGarageButton').click();
  await page.locator('.pilot-card').first().waitFor();
}
export async function startRoomRace(page) {await page.locator('#startButton').click();await page.locator('#launchRace').click();}
