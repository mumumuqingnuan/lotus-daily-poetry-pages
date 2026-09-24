import assert from 'node:assert/strict';
import test from 'node:test';
import { ShrineAudio } from '../src/lib/shrine-audio';
import { beijingInstant, getCalendar, hours, hourSlot, shiftDay, validDay } from '../src/lib/almanac';

class FakeNode {
 connections:unknown[]=[];
 disconnectCount=0;
 connect(destination:unknown){this.connections.push(destination);}
 disconnect(){this.disconnectCount++;}
}
class FakeGain extends FakeNode {
 gain={value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}};
}
class FakeOscillator extends FakeNode {
 type='sine';frequency={value:0};onended:(()=>void)|null=null;
 starts:number[]=[];stops:(number|undefined)[]=[];
 start(at:number){this.starts.push(at);}
 stop(at?:number){this.stops.push(at);}
}

async function withAudio(run:(h:{
 instances:FakeContext[];
 timers:Map<number,{callback:()=>void,delay:number}>;
 visibility:{hidden:boolean};
 useSafari:()=>void;
 unsupported:()=>void;
 deferResume:()=>void;
})=>Promise<void>){
 const originals=new Map<string,PropertyDescriptor|undefined>();
 const replace=(key:string,value:unknown)=>{
  if(!originals.has(key))originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 };
 const timers=new Map<number,{callback:()=>void,delay:number}>();
 const instances:FakeContext[]=[];
 const visibility={hidden:false};
 let nextTimer=0,defer=false;
 class Context extends FakeContext {
  constructor(){super();this.deferred=defer;instances.push(this);}
 }
 replace('AudioContext',Context);replace('webkitAudioContext',undefined);
 replace('document',visibility);
 replace('setInterval',(callback:()=>void,delay:number)=>{
  const id=nextTimer++;timers.set(id,{callback,delay});return id;
 });
 replace('clearInterval',(id:number)=>{timers.delete(id);});
 try{await run({instances,timers,visibility,
  useSafari:()=>{replace('AudioContext',undefined);replace('webkitAudioContext',Context);},
  unsupported:()=>{replace('AudioContext',undefined);replace('webkitAudioContext',undefined);},
  deferResume:()=>{defer=true;},
 });}finally{
  for(const [key,descriptor] of originals){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);
   else Reflect.deleteProperty(globalThis,key);
  }
 }
}
class FakeContext {
 state='suspended';currentTime=0;destination={};
 gains:FakeGain[]=[];oscillators:FakeOscillator[]=[];
 deferred=false;finishResume:(()=>void)|null=null;
 suspends=0;closes=0;
 createGain(){const node=new FakeGain();this.gains.push(node);return node;}
 createOscillator(){const node=new FakeOscillator();this.oscillators.push(node);return node;}
 resume(){
  if(!this.deferred){this.state='running';return Promise.resolve();}
  return new Promise<void>(resolve=>{this.finishResume=()=>{
   if(this.state!=='closed')this.state='running';resolve();
  };});
 }
 suspend(){this.suspends++;this.state='suspended';return Promise.resolve();}
 close(){this.closes++;this.state='closed';return Promise.resolve();}
}

test('audio stays opt-in and preserves the original bell, background notes and shake sound',async()=>{
 await withAudio(async({instances,timers,visibility})=>{
  const audio=new ShrineAudio();
  audio.bell();audio.shake();
  assert.equal(instances.length,0);assert.equal(timers.size,0);
  try{
   assert.equal(await audio.enable(),true);
   const context=instances[0];
   assert.deepEqual(context.oscillators.map(node=>node.frequency.value),[261.63,524.9,788.8,1053.6]);
   const ambient=[...timers.values()].find(timer=>timer.delay===2500)!;
   ambient.callback();assert.equal(context.oscillators.at(-1)!.frequency.value,196);
   visibility.hidden=true;ambient.callback();assert.equal(context.oscillators.length,5);
   visibility.hidden=false;audio.shake();
   const shake=[...timers.values()].find(timer=>timer.delay===95)!;
   shake.callback();const voice=context.oscillators.at(-1)!;
   assert.equal(voice.type,'triangle');assert.ok(voice.frequency.value>=700&&voice.frequency.value<1400);
   audio.stopShake();assert.equal(timers.size,1);
  }finally{audio.dispose();}
  assert.equal(timers.size,0);
 });
});

test('repeated toggles reuse one output connection and mute stops all existing voices',async()=>{
 await withAudio(async({instances,timers})=>{
  const audio=new ShrineAudio();
  try{
   await audio.enable();await audio.enable();
   assert.equal(instances.length,1);
   const context=instances[0],master=context.gains[0];
   assert.equal(master.connections.length,1);assert.equal(timers.size,1);
   audio.shake();assert.equal(timers.size,2);
   audio.disable();
   assert.equal(master.gain.value,0);assert.equal(context.state,'suspended');assert.equal(timers.size,0);
   assert.ok(context.oscillators.every(node=>node.disconnectCount===1&&node.stops.includes(undefined)));
   const count=context.oscillators.length;audio.bell();audio.shake();
   assert.equal(context.oscillators.length,count);assert.equal(timers.size,0);
   await audio.enable();
   assert.equal(master.connections.length,1);assert.equal(master.gain.value,.36);
   assert.equal(context.oscillators.length,count+4);
   assert.ok(context.oscillators.slice(0,count).every(node=>node.disconnectCount===1));
  }finally{audio.dispose();audio.dispose();}
  assert.equal(instances[0].closes,1);assert.equal(timers.size,0);
  assert.equal(await audio.enable(),false);
 });
});

test('muting while the browser waits to resume cannot restart the sound',async()=>{
 await withAudio(async({instances,timers,deferResume})=>{
  deferResume();const audio=new ShrineAudio();
  try{
   const pending=audio.enable(),context=instances[0];
   assert.equal(context.gains[0].gain.value,0);
   audio.disable();context.finishResume!();
   assert.equal(await pending,false);
   assert.equal(context.state,'suspended');assert.equal(context.gains[0].gain.value,0);
   assert.equal(context.oscillators.length,0);assert.equal(timers.size,0);
  }finally{audio.dispose();}
 });
});

test('unmounting during browser resume releases resources without starting timers',async()=>{
 await withAudio(async({instances,timers,deferResume})=>{
  deferResume();const audio=new ShrineAudio();
  const pending=audio.enable();audio.dispose();instances[0].finishResume!();
  assert.equal(await pending,false);assert.equal(instances[0].state,'closed');
  assert.equal(instances[0].closes,1);assert.equal(timers.size,0);
  assert.equal(instances[0].oscillators.length,0);
 });
});

test('legacy Safari constructor works and unavailable Web Audio reports a recoverable error',async()=>{
 await withAudio(async({useSafari,unsupported})=>{
  useSafari();const audio=new ShrineAudio();
  try{assert.equal(await audio.enable(),true);}finally{audio.dispose();}
  unsupported();const unsupportedAudio=new ShrineAudio();
  await assert.rejects(unsupportedAudio.enable(),/当前浏览器不支持音效/);
  unsupportedAudio.disable();unsupportedAudio.dispose();
 });
});

test('a rejected browser resume remains muted and can be retried without rebuilding the audio graph',async()=>{
 await withAudio(async({instances,timers})=>{
  const audio=new ShrineAudio();
  try{
   await audio.enable();audio.disable();
   const context=instances[0],resume=context.resume.bind(context);
   context.resume=()=>Promise.reject(new Error('browser denied playback'));
   await assert.rejects(audio.enable(),/browser denied playback/);
   assert.equal(context.gains[0].gain.value,0);assert.equal(timers.size,0);
   context.resume=resume;
   assert.equal(await audio.enable(),true);
   assert.equal(context.gains[0].connections.length,1);assert.equal(timers.size,1);
  }finally{audio.dispose();}
 });
});

test('Beijing day boundaries are independent of ISO input offset and cross months and years',()=>{
 assert.deepEqual(beijingInstant('2026-09-24T15:59:59Z'),{day:'2026-09-24',hour:23,time:'23:59'});
 assert.deepEqual(beijingInstant('2026-09-24T16:00:00Z'),{day:'2026-09-25',hour:0,time:'00:00'});
 assert.deepEqual(beijingInstant('2026-09-25T00:00:00+08:00'),beijingInstant('2026-09-24T09:00:00-07:00'));
 assert.equal(beijingInstant('2026-12-31T16:00:00Z').day,'2027-01-01');
 assert.equal(shiftDay('2024-02-28',1),'2024-02-29');
 assert.equal(shiftDay('2024-02-29',1),'2024-03-01');
 assert.equal(shiftDay('2026-03-01',-1),'2026-02-28');
 assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
});

test('calendar retains lunar holidays, solar terms and every traditional two-hour slot',()=>{
 assert.ok(getCalendar('2024-02-10').lunar.endsWith('正月初一'));
 assert.ok(getCalendar('2024-09-17').lunar.endsWith('八月十五'));
 assert.equal(getCalendar('2024-04-04').jieqi,'清明');
 assert.equal(getCalendar('2024-12-21').jieqi,'冬至');
 assert.equal(getCalendar('2024-02-10').weekday,'星期六');
 assert.deepEqual(Object.keys(getCalendar('2024-02-10')).sort(),['day','jieqi','lunar','weekday']);
 assert.equal(hours.length,12);
 assert.deepEqual(Array.from({length:24},(_,hour)=>hourSlot(hour)),[0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,0]);
});

test('calendar validates dates and its supported range without normalizing impossible days',()=>{
 for(const day of ['1901-01-01','2099-12-31','2024-02-29'])assert.equal(validDay(day),true,day);
 for(const day of ['1900-12-31','2100-01-01','2026-02-29','2026-02-30','2026-13-01','2026-00-01','2026-9-1','']){
  assert.equal(validDay(day),false,day);assert.throws(()=>getCalendar(day),/日期格式不正确/);
 }
 assert.doesNotThrow(()=>getCalendar('1901-01-01'));
 assert.doesNotThrow(()=>getCalendar('2099-12-31'));
});
