import { Solar } from 'lunar-javascript';
export const hours = [
 ['子','23:00–00:59','夜半'],['丑','01:00–02:59','鸡鸣'],['寅','03:00–04:59','平旦'],
 ['卯','05:00–06:59','日出'],['辰','07:00–08:59','食时'],['巳','09:00–10:59','隅中'],
 ['午','11:00–12:59','日中'],['未','13:00–14:59','日昳'],['申','15:00–16:59','晡时'],
 ['酉','17:00–18:59','日入'],['戌','19:00–20:59','黄昏'],['亥','21:00–22:59','人定'],
].map(([name,range,label])=>({name,range,label}));
export function hourSlot(hour:number){return Math.floor((hour+1)/2)%12;}
export function beijingInstant(iso:string){const s=new Date(new Date(iso).getTime()+8*3600000).toISOString();return {day:s.slice(0,10),hour:Number(s.slice(11,13)),time:s.slice(11,16)};}
export function shiftDay(day:string,amount:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
export function validDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day>='1901-01-01'&&day<='2099-12-31'&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;}
export function getCalendar(day:string){
 if(!validDay(day))throw new Error('日期格式不正确');
 const [y,m,d]=day.split('-').map(Number);const l=Solar.fromYmdHms(y,m,d,12,0,0).getLunar();
 return {day,lunar:`${l.getYearInChinese()}年${l.getMonthInChinese()}月${l.getDayInChinese()}`,jieqi:l.getJieQi(),weekday:new Intl.DateTimeFormat('zh-CN',{weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date(day+'T04:00:00Z'))};
}
