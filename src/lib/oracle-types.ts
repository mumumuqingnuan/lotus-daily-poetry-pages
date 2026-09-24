export const categories = ['随心一读','工作推进','学习成长','人际相处','生活整理','方向选择'] as const;
export type Category = typeof categories[number];
export type Poem = {id:number;title:string;author:string;lines:string[];reading:string;reflection:string;theme:string;source:string};
export type DailyRecord = {day:string;startedAt:string;question:string;category:Category;progress:number;poem:Omit<Poem,'reflection'|'theme'>|null;reflection:string|null;action:string|null};
export type HistoryEntry = {day:string;question:string;category:string;progress:number;title:string;legacy:boolean};
export type DailyResponse = {day:string;record:DailyRecord|null;history?:HistoryEntry[];error?:string};
export function dateLabel(day:string) {const a=day.split('-');return `${a[0]} 年 ${Number(a[1])} 月 ${Number(a[2])} 日`;}
