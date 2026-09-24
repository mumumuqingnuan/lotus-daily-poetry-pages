export class ShrineAudio {
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private ambient:ReturnType<typeof setInterval>|null=null;
 private ticks:ReturnType<typeof setInterval>|null=null;
 private voices=new Map<OscillatorNode,GainNode>();
 private step=0;
 private enabled=false;
 private disposed=false;
 private generation=0;

 async enable():Promise<boolean> {
  if(this.disposed)return false;
  const generation=++this.generation;
  if(!this.context||this.context.state==='closed'){
   const host=globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext};
   const Context=host.AudioContext||host.webkitAudioContext;
   if(!Context)throw new Error('当前浏览器不支持音效。');
   this.context=new Context();
   this.master=this.context.createGain();
   this.master.gain.value=0;
   // Keep exactly one connection for the lifetime of this context.
   this.master.connect(this.context.destination);
  }
  this.enabled=true;
  const context=this.context;
  try{await context.resume();}catch(error){
   if(generation!==this.generation||this.disposed)return false;
   this.disable();
   throw error;
  }
  if(generation!==this.generation||!this.enabled||this.disposed){
   // A late resume must not undo a user's mute or an unmount.
   if(!this.enabled&&context.state!=='closed')void context.suspend().catch(()=>{});
   return false;
  }
  if(context.state!=='running'){
   this.disable();
   throw new Error('声音暂时无法播放。');
  }
  this.master!.gain.value=.36;
  if(this.ambient===null){
   this.bell();
   this.ambient=setInterval(()=>{
    if(document.hidden)return;
    const notes=[196,246.94,293.66,329.63,392,329.63,293.66,246.94];
    this.tone(notes[this.step++%notes.length],3.8,.055);
   },2500);
  }
  return true;
 }

 private tone(freq:number,duration:number,volume:number,kind:OscillatorType='sine') {
  if(!this.enabled||!this.context||!this.master||this.context.state!=='running')return;
  const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();
  o.type=kind;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(volume,t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(this.master);
  this.voices.set(o,g);
  o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(o);};
  o.start(t);o.stop(t+duration+.1);
 }

 bell(){[261.63,524.9,788.8,1053.6].forEach((f,i)=>this.tone(f,5-i*.5,.10/(i+1)));}
 shake(){
  this.stopShake();
  if(!this.enabled||this.context?.state!=='running')return;
  this.ticks=setInterval(()=>{if(!document.hidden)this.tone(700+Math.random()*700,.065,.09,'triangle');},95);
 }
 stopShake(){if(this.ticks!==null)clearInterval(this.ticks);this.ticks=null;}
 disable(){
  this.generation++;this.enabled=false;
  if(this.master)this.master.gain.value=0;
  if(this.ambient!==null)clearInterval(this.ambient);
  this.ambient=null;this.stopShake();
  // Disconnect now so a later resume cannot replay the tail of old notes.
  for(const [oscillator,gain] of this.voices){
   oscillator.onended=null;
   try{oscillator.stop();}catch{/* Already ended. */}
   oscillator.disconnect();gain.disconnect();
  }
  this.voices.clear();
  if(this.context&&this.context.state!=='closed')void this.context.suspend().catch(()=>{});
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.disable();
  this.master?.disconnect();
  if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});
 }
}
