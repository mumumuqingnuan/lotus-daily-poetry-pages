'use client';
import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,CalendarDays,Clock3} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {getCalendar,hours,hourSlot,beijingInstant,shiftDay,validDay} from '@/lib/almanac';
export default function Almanac({today}:{today:string}){
 const [date,setDate]=useState(today);
 const [slot,setSlot]=useState(()=>hourSlot(beijingInstant(new Date().toISOString()).hour));
 const a=useMemo(()=>getCalendar(date),[date]);
 const terms=useMemo(()=>Array.from({length:32},(_,i)=>shiftDay(date,i)).filter(d=>validDay(d)).map(d=>getCalendar(d)).filter(x=>x.jieqi).slice(0,2),[date]);
 return <div className="almanac"><div className="heading-block"><p className="eyebrow">日 月 往 来 · 记 得 当 下</p><h1>日历与时光</h1><p className="lead">看一看日期，也留意季节的变化。</p></div>
 <div className="calendar-date"><button aria-label="前一天" disabled={date<='1901-01-01'} onClick={()=>setDate(shiftDay(date,-1))}><ChevronLeft size={19}/></button><label><CalendarDays size={17}/><input aria-label="选择日历日期" type="date" min="1901-01-01" max="2099-12-31" value={date} onChange={e=>{if(validDay(e.target.value))setDate(e.target.value)}}/></label><button aria-label="后一天" disabled={date>='2099-12-31'} onClick={()=>setDate(shiftDay(date,1))}><ChevronRight size={19}/></button><button className="today-button" onClick={()=>setDate(today)}>今日</button></div>
 <section className="calendar-hero"><div><span className="caption">农历 · {a.lunar}</span><h2>{a.weekday}</h2><p>{a.jieqi?`今日节气 · ${a.jieqi}`:'寻常的一天，也有值得留意的小事。'}</p></div><span className="calendar-seal">{Number(date.slice(8))}</span></section>
 <section className="reading-card"><h2>接下来的节气</h2><div className="season-list">{terms.map(t=><button key={t.day} onClick={()=>setDate(t.day)}><span>{t.day}</span><strong>{t.jieqi}</strong><ChevronRight size={16}/></button>)}</div>{!terms.length&&<p>所选日期已接近日历查询范围的末尾。</p>}<p className="caption">节气标记一年中的季节节点；当天的天气仍以当地实况为准。</p></section>
 <section className="reading-card"><h2><Clock3 size={18}/> 认识十二时辰</h2><p>古人将一昼夜分为十二时辰。这里按北京时间展示现代常用的两小时对应表。</p><RadioGroup value={String(slot)} onValueChange={v=>setSlot(Number(v))} className="hour-grid" aria-label="选择时辰">{hours.map((h,i)=><label key={h.name} className={slot===i?'selected':''}><RadioGroupItem value={String(i)} className="sr-only"/><strong>{h.name}时</strong><span>{h.range}</span></label>)}</RadioGroup><div className="hour-detail" aria-live="polite"><h3>{hours[slot].name}时 · {hours[slot].label}</h3><p>{hours[slot].range}。{slot===0?'子时跨越两个公历日期。':''}这些名称来自古人对日光和生活节奏的观察，实际日出、日落会随地点和季节变化。</p></div></section>
 <section className="reading-card"><h2>给今天留一点空白</h2><p>读两页书，看看窗外，或把一件小事做完。按自己的时间安排，哪一刻都可以开始。</p></section>
 <p className="calendar-source">农历与节气换算：<a href="https://github.com/6tail/lunar-javascript" target="_blank" rel="noreferrer">lunar-javascript</a>。日历只展示日期和历法知识。</p></div>;
}
