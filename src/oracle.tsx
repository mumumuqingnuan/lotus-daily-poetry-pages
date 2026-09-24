'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,ChevronRight,Flower2,Maximize2,Volume2,VolumeX,ArrowLeft,BookOpen,History,RotateCcw} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {categories,dateLabel,type Category,type DailyRecord,type HistoryEntry} from '@/lib/oracle-types';
import {beijingInstant,hours,hourSlot} from '@/lib/almanac';
import Almanac from './almanac';
import {ShrineAudio} from '@/lib/shrine-audio';
import {beijingDay,readDaily,readHistory,updateDaily,storageKey} from '@/lib/local-daily';

type Screen='welcome'|'prepare'|'ritual'|'result';
type Phase='rest'|'shaking'|'ready'|'drawing'|'drawn';
const roundNames=['读一句诗','想一个问题','做一件小事'];
const roundWords=['轻摇笺页，让一句诗来到眼前。','把这句诗，放回今天的生活里想一想。','选一件做得到的小事，从这里开始。'];
const lotusImage=import.meta.env.BASE_URL+'assets/white-lotus.png';

export default function Oracle(){
 const [tab,setTab]=useState('poetry'),[screen,setScreen]=useState<Screen>('welcome'),[phase,setPhase]=useState<Phase>('rest');
 const [day,setDay]=useState(beijingDay),[record,setRecord]=useState<DailyRecord|null>(null),[archive,setArchive]=useState<DailyRecord|null>(null);
 const [question,setQuestion]=useState(''),[category,setCategory]=useState<Category>('随心一读');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [sound,setSound]=useState(false),[soundError,setSoundError]=useState(''),[imageOpen,setImageOpen]=useState(false),[round,setRound]=useState(0);
 const [history,setHistory]=useState<HistoryEntry[]>([]),[historyLoading,setHistoryLoading]=useState(false),[historyError,setHistoryError]=useState('');
 const lock=useRef(false),audio=useRef<ShrineAudio|null>(null),timeouts=useRef<ReturnType<typeof setTimeout>[]>([]),panel=useRef<HTMLElement>(null),title=useRef<HTMLHeadingElement>(null),epoch=useRef(0);
 const dayRef=useRef(day),recordRef=useRef<DailyRecord|null>(null);
 const saveRecord=useCallback((next:DailyRecord|null)=>{recordRef.current=next;setRecord(next);},[]);
 const resetMotion=useCallback(()=>{epoch.current++;timeouts.current.forEach(clearTimeout);timeouts.current=[];audio.current?.stopShake();setPhase('rest');lock.current=false;setBusy(false);},[]);
 const loadDaily=useCallback(()=>{
  const alignDay=(today:string)=>{if(today!==dayRef.current){resetMotion();dayRef.current=today;setDay(today);setScreen('welcome');setArchive(null);saveRecord(null);setQuestion('');setCategory('随心一读');setRound(0);}};
  alignDay(beijingDay());
  setLoading(true);setError('');
  try{const data=readDaily();alignDay(data.day);saveRecord(data.record);if(data.record){setQuestion(data.record.question);setCategory(data.record.category);}}
  catch(e){setError(e instanceof Error?e.message:'暂时无法读取，请重试。');}
  finally{setLoading(false);}
 },[resetMotion,saveRecord]);
 const ensureCurrentDay=()=>{if(dayRef.current!==beijingDay()){loadDaily();return false;}return true;};
 const later=(fn:()=>void,ms:number)=>{const version=epoch.current,scheduledDay=dayRef.current;const t=setTimeout(()=>{if(version!==epoch.current)return;if(scheduledDay!==beijingDay()){loadDaily();return;}fn();},ms);timeouts.current.push(t);};
 const loadHistory=useCallback(()=>{setHistoryLoading(true);setHistoryError('');try{setHistory(readHistory().history??[]);}catch(e){setHistoryError(e instanceof Error?e.message:'手记暂时无法读取。');}finally{setHistoryLoading(false);}},[]);
 useEffect(()=>{loadDaily();audio.current=new ShrineAudio();return()=>{epoch.current++;timeouts.current.forEach(clearTimeout);audio.current?.dispose();};},[loadDaily]);
 useEffect(()=>{
  const check=()=>{if(beijingDay()!==dayRef.current){loadDaily();loadHistory();}};
  const visibility=()=>{if(document.hidden){audio.current?.disable();setSound(false);}else check();};
  const storage=(event:StorageEvent)=>{
   if(event.storageArea!==window.localStorage||(event.key!==storageKey&&event.key!==null))return;
   check();
   try{
    const data=readDaily();
    if(data.day!==dayRef.current){loadDaily();loadHistory();return;}
    // Read the latest persisted snapshot instead of the event's possibly older value.
    resetMotion();saveRecord(data.record);setError('');
    if(data.record){setQuestion(data.record.question);setCategory(data.record.category);setRound(Math.min(data.record.progress,2));}
    setScreen(previous=>previous==='ritual'||previous==='prepare'?(data.record?(data.record.progress===3?'result':'ritual'):'welcome'):previous);
    setArchive(previous=>previous?.day===data.day?data.record:previous);
    loadHistory();
   }catch(e){setError(e instanceof Error?e.message:'暂时无法读取，请重试。');}
  };
  document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',check);window.addEventListener('storage',storage);
  const timer=setInterval(check,1000);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',check);window.removeEventListener('storage',storage);};
 },[loadDaily,loadHistory,resetMotion,saveRecord]);
 useEffect(()=>{if(screen!=='welcome'){title.current?.focus({preventScroll:true});if(window.matchMedia('(max-width:960px)').matches)panel.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}},[screen]);
 function request(action:'start'|'draw'){
  if(!ensureCurrentDay())return null;
  const data=updateDaily({action,day:dayRef.current,question,category,progress:recordRef.current?.progress??0});
  saveRecord(data.record);return data.record;
 }
 async function toggleSound(){setSoundError('');if(sound){audio.current?.disable();setSound(false);}else try{const enabled=await audio.current?.enable();if(!enabled)return;if(document.hidden){audio.current?.disable();return;}setSound(true);}catch{setSoundError('声音暂时无法播放，仍可继续阅读。');}}
 function enter(){
  if(!ensureCurrentDay())return;
  setError('');setArchive(null);
  try{const data=readDaily();if(data.day!==dayRef.current){loadDaily();return;}const current=data.record;saveRecord(current);if(current?.progress===3){setScreen('result');return;}if(current){setQuestion(current.question);setCategory(current.category);setRound(current.progress);setPhase('rest');setScreen('ritual');return;}setScreen('prepare');}
  catch(e){setError(e instanceof Error?e.message:'暂时无法读取，请重试。');}
 }
 function begin(){if(lock.current||!ensureCurrentDay())return;lock.current=true;setBusy(true);setError('');try{const r=request('start');if(!r)return;if(r.progress===3){setScreen('result');return;}setQuestion(r.question);setCategory(r.category);setRound(r.progress);setPhase('rest');setScreen('ritual');if(sound)audio.current?.bell();}catch(e){if(ensureCurrentDay())setError(e instanceof Error?e.message:'暂时未能开始，请重试。');}finally{setBusy(false);lock.current=false;}}
 function shake(){if(phase!=='rest'||lock.current||!ensureCurrentDay())return;setError('');setPhase('shaking');if(sound)audio.current?.shake();later(()=>{audio.current?.stopShake();setPhase('ready');},window.matchMedia('(prefers-reduced-motion: reduce)').matches?200:1600);}
 function draw(){if(phase!=='ready'||lock.current||!ensureCurrentDay())return;lock.current=true;setBusy(true);setError('');try{const r=request('draw');if(!r)return;setRound(r.progress-1);setPhase('drawing');later(()=>{setPhase('drawn');if(sound)audio.current?.bell();},window.matchMedia('(prefers-reduced-motion: reduce)').matches?20:650);}catch(e){if(ensureCurrentDay())setError(e instanceof Error?e.message:'暂时未能展开，请重试。');}finally{lock.current=false;setBusy(false);}}
 function next(){if(phase!=='drawn'||!ensureCurrentDay())return;if(recordRef.current?.progress===3){setScreen('result');return;}setRound(recordRef.current?.progress??0);setPhase('rest');}
 function openHistory(entry:HistoryEntry){if(entry.legacy)return;setHistoryError('');setHistoryLoading(true);try{const data=readDaily(entry.day);if(!data.record)throw new Error('这篇手记暂时无法读取。');resetMotion();setArchive(data.record);setScreen('result');setTab('poetry');}catch(e){setHistoryError(e instanceof Error?e.message:'手记暂时无法读取。');}finally{setHistoryLoading(false);}}
 const active=archive??record,poem=active?.poem,ritualBusy=busy||phase==='shaking'||phase==='drawing';
 const heading=screen==='welcome'?'每日诗笺':screen==='prepare'?'给自己片刻':screen==='ritual'?roundNames[round]:poem?.title||(active?'未展开的诗笺':'今日诗笺');
 const revealed=phase==='drawn'||phase==='drawing';
 const drawnText=round===0?record?.poem?.lines.join('\n'):round===1?record?.reflection:record?.action;
 return <main className={`temple screen-${screen}`}>
 <header className="topbar"><button className="brand" disabled={ritualBusy} onClick={()=>{setScreen('welcome');setArchive(null);setTab('poetry');setError('');}} aria-label="莲心首页"><Flower2 strokeWidth={1.2}/><span>莲心</span><span className="brand-stamp">诗笺</span></button><div className="top-actions"><span className="day-top">{day?dateLabel(day):'每日一笺'}</span><button className="sound-button" onClick={toggleSound} aria-pressed={sound}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>清音{sound?' · 开':' · 关'}</span></button></div></header>
 <aside className="sacred-view" aria-label="白莲插画"><img className="guanyin-image" src={lotusImage} width="1086" height="1448" alt="白底上的一朵白莲，花瓣边缘有细微金色，叶片舒展" fetchPriority="high"/><div className="portrait-shade"/><p className="sacred-caption">一页诗 · 一刻闲</p><button className="portrait-button" onClick={()=>setImageOpen(true)}><Maximize2 size={15}/>看看这朵莲</button></aside>
 <section className="oracle-surface" ref={panel}><div className="surface-inner">
 <Tabs value={tab} onValueChange={value=>{if(ritualBusy)return;setTab(value);if(value==='history')void loadHistory();}} className="main-tabs"><TabsList className="main-tab-list" aria-label="诗笺、日历与手记"><TabsTrigger value="poetry">每日诗笺</TabsTrigger><TabsTrigger value="calendar" disabled={ritualBusy}>日历</TabsTrigger><TabsTrigger value="history" disabled={ritualBusy}>手记</TabsTrigger></TabsList>
 <TabsContent value="calendar">{day&&<Almanac key={day} today={day}/>}</TabsContent>
 <TabsContent value="history"><div className="heading-block"><p className="eyebrow">把 平 常 的 一 天 留 下</p><h1>我的手记</h1></div><p className="lead">诗句、当时的想法，留待以后回看。</p>{historyLoading&&<p role="status" className="quiet-note">正在翻开手记…</p>}{historyError&&<div className="error-box" role="alert">{historyError}<button onClick={loadHistory}>重新读取</button></div>}{!historyLoading&&!historyError&&history.length===0&&<div className="empty-note"><BookOpen size={28}/><p>还没有手记，开启今天的诗笺后会自动保存。</p><button className="text-button" onClick={()=>setTab('poetry')}>去读今日诗笺<ChevronRight size={16}/></button></div>}<div className="history-list">{history.map(e=><article key={`${e.day}-${e.legacy}`}><div className="history-meta"><span>{e.day} · {e.category}</span><span>{e.legacy?'旧版文字':e.progress===3?'已读':'未读完'}</span></div><h2>{e.title}</h2><p>{e.question||'这一天，留一刻给自己。'}</p>{!e.legacy&&<button className="text-button" disabled={historyLoading} onClick={()=>openHistory(e)}>回看诗笺<ChevronRight size={16}/></button>}{!e.legacy&&e.day===day&&e.progress<3&&<button className="text-button" onClick={()=>{setTab('poetry');enter();}}>继续阅读<ChevronRight size={16}/></button>}</article>)}</div>{history.length>0&&<p className="quiet-note">已保存的手记按日期排列，未读完的诗笺也可回看。</p>}</TabsContent>
 <TabsContent value="poetry">
 {screen!=='welcome'&&<nav className="steps" aria-label="阅读进度">{['留一念','三次展开','今日手记'].map((label,i)=>{const step=screen==='prepare'?0:screen==='ritual'||(screen==='result'&&active&&active.progress<3)?1:2;return <span key={label} className={step===i?'current':step>i?'done':''}>{step>i?<Check size={13}/>:<b>{['壹','贰','叁'][i]}</b>}{label}</span>;})}</nav>}
 <div className="heading-block"><p className="eyebrow">{screen==='welcome'?'读 诗 · 想 一 想 · 慢 慢 做':screen==='prepare'?'今 天 · 我 想 聊 聊':screen==='ritual'?`第 ${['一','二','三'][round]} 页 / 共 三 页`:'一 日 一 笺 · 留 住 此 刻'}</p><h1 ref={title} tabIndex={-1}>{heading}</h1></div>
 {screen==='welcome'&&<div className="welcome-body"><p className="lead">让诗句，陪你停一小会儿。</p><div className="welcome-poem-cards" aria-hidden="true"><span>读诗</span><span>想一想</span><span>做一点</span></div><p className="welcome-instruction">轻摇三次，展开诗句、思考题与小行动。<br/>每天一份，写给当下的自己。</p>{record&&<div className="daily-status"><span className="small-seal">{record.progress===3?'已读':'待续'}</span><div><strong>{record.progress===3?`今天读了《${record.poem?.title}》`:'今日诗笺还没读完'}</strong><span>{record.progress===3?'重开仍可回看这份诗笺。':`已展开 ${record.progress} 页，从下一页继续。`}</span></div></div>}<button className="primary" disabled={loading||!!error} onClick={enter}>{loading?'正在打开今日诗笺…':record?.progress===3?'回看 · 今日诗笺':record?'继续 · 今日诗笺':'开始 · 今日诗笺'}<ChevronRight size={17}/></button><p className="quiet-note">同一天诗句固定，思考与行动由你选择。</p><div className="welcome-meta"><span>24篇古诗选句</span><span>三次轻摇</span><span>每天留存</span></div></div>}
 {screen==='prepare'&&<div className="prayer-body"><div className="question-form"><p className="field-label" id="category-label">今天想关注什么</p><RadioGroup className="topic-options" value={category} onValueChange={v=>setCategory(v as Category)} aria-labelledby="category-label">{categories.map((c,i)=><label key={c} className={category===c?'topic selected':'topic'}><RadioGroupItem value={c} id={`topic-${i}`}/><span>{c}</span></label>)}</RadioGroup><label className="field-label question-label" htmlFor="question">留下一句话 <span>可留空</span></label><textarea id="question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={120} placeholder="今天，我想花一点时间想想……" rows={3}/></div><div className="prepare-note"><Flower2 size={22}/><p>放松肩膀，慢慢呼吸。<br/>不必急着得到答案，先给自己一点时间。</p></div><button className="primary" disabled={busy} onClick={begin}>{busy?'正在保存这一刻…':'准备好了 · 展开诗笺'}<ChevronRight size={17}/></button><p className="quiet-note">这句话与阅读进度保存在当前浏览器。</p><button className="text-button" disabled={busy} onClick={()=>setScreen('welcome')}><ArrowLeft size={15}/>返回</button></div>}
 {screen==='ritual'&&<div className="ritual-body"><p className="round-prayer">{roundWords[round]}</p><div className={`paper-stage phase-${phase}`}><button className="poetry-deck" disabled={phase!=='rest'&&phase!=='ready'} onClick={phase==='rest'?shake:draw} aria-label={phase==='ready'?'展开这一页':'轻摇笺页'}>{revealed?<><span className="deck-label">{roundNames[round]}</span><span className={`deck-content ${round===0?'verse':''}`}>{drawnText}</span>{round===0&&<span className="deck-credit">{record?.poem?.author} ·《{record?.poem?.title}》</span>}</>:<><span className="deck-label">第 {['一','二','三'][round]} 页</span><span className="deck-symbol">{['诗','思','行'][round]}</span><span className="deck-credit">{phase==='shaking'?'轻摇片刻…':phase==='ready'?'轻触展开':'轻触笺页，开始摇动'}</span></>}</button></div><div className="ritual-instruction" aria-live="polite"><strong>{phase==='rest'?'轻轻一摇，打开这一页':phase==='shaking'?'笺页轻动，停留片刻':phase==='ready'?'准备好了，请展开':phase==='drawing'?'正在展开…':round===2?'把这件小事，留给今天':'读一读，再慢慢往下'}</strong></div>{phase==='drawn'?<button className="primary" onClick={next}>{round===2?<><BookOpen size={18}/>收好 · 今日诗笺</>:<>收好这一页 · 继续<ChevronRight size={17}/></>}</button>:<button className="primary" disabled={ritualBusy} onClick={phase==='ready'?draw:shake}>{phase==='rest'?`轻摇 · 第${['一','二','三'][round]}次`:phase==='ready'?'展开 · 这一页':phase==='shaking'?'笺页轻摇中…':'正在展开…'}</button>}<div className="round-tracker" aria-label="三次展开进度">{['诗','思','行'].map((label,i)=><span key={label} className={i<round?'finished':i===round?'active':''}><b>{i<round?<Check size={14}/>:['一','二','三'][i]}</b>{label}</span>)}</div></div>}
 {screen==='result'&&active&&<div className="result-body">
  {poem&&active.progress>=1?<article className="fortune-paper"><div className="paper-top"><span>古诗选句</span><span>唐 · {poem.author}</span></div><div className="poem">{poem.lines.map((line,i)=><p key={i}>{line}</p>)}</div><div className="paper-bottom"><span>{dateLabel(active.day)}</span><span className="red-stamp">莲心</span></div></article>:<section className="reading-card"><h2>读一句诗 · 尚未展开</h2><p>这天留下一句话，还没有展开诗句。</p></section>}
  <div className="asked-question"><span>{dateLabel(active.day)} · 当时的关注 · {active.category}</span><p>{active.question||'今天，留一点时间给自己。'}</p></div>
  {poem&&active.progress>=1&&<section className="reading-card"><h2>读懂这两句</h2><p>{poem.reading}</p><p className="caption">原文节选自唐·{poem.author}《{poem.title}》。选句保留数字版繁体文字；赏读与思考题为本站编写。</p><a className="poem-source" href={poem.source} target="_blank" rel="noreferrer">查看《唐诗三百首》数字版出处<ChevronRight size={14}/></a></section>}
  <section className="reading-card"><h2>{active.progress>=2?'留给自己的一个问题':'想一个问题 · 尚未展开'}</h2><p>{active.progress>=2?active.reflection:'这一步尚未阅读，手记保留在当时的进度。'}</p></section>
  {active.progress>=3?<div className="guanyin-advice"><Flower2 size={23} strokeWidth={1}/><span>{active.category} · 一个小行动</span><p>{active.action}</p></div>:<section className="reading-card"><h2>做一件小事 · 尚未展开</h2><p>这一步尚未阅读，手记保留在当时的进度。</p></section>}
  <p className="result-note">{active.progress===3?'只选与你有关的部分，按自己的情况决定。':`已展开 ${active.progress} / 3 页。`}</p>
  <p className="quiet-note">{(()=>{const t=beijingInstant(active.startedAt);return `开启于 ${t.day} ${t.time} · ${hours[hourSlot(t.hour)].name}时（北京时间）`;})()}</p>
  {active.day===day&&active.progress<3&&<button className="primary" onClick={enter}>继续 · 今日诗笺<ChevronRight size={17}/></button>}
  <button className="text-button" onClick={()=>{setArchive(null);setScreen('welcome');}}><ArrowLeft size={15}/>回到今日</button><button className="text-button" onClick={()=>{setTab('history');loadHistory();}}><History size={15}/>查看手记</button>
 </div>}
 {(error||soundError)&&<div className="error-box" role="alert"><p>{error||soundError}</p>{error&&screen==='welcome'?<button onClick={loadDaily} disabled={loading}><RotateCcw size={14}/>重新读取</button>:null}</div>}
 </TabsContent></Tabs></div><footer className="page-footer"><span>每日一笺 · 北京时间零点更新</span><p>记录保存在当前浏览器。</p></footer></section>
 <Dialog open={imageOpen} onOpenChange={setImageOpen}><DialogContent className="sacred-dialog"><DialogTitle className="sr-only">白莲插画</DialogTitle><DialogDescription className="sr-only">白莲与金色微光。关闭后继续阅读。</DialogDescription><img src={lotusImage} alt="白莲与金色微光" width="1086" height="1448"/></DialogContent></Dialog>
 </main>;
}
