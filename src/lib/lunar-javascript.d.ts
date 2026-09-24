declare module 'lunar-javascript' {
 type Lunar = {
  getYearInChinese():string;getMonthInChinese():string;getDayInChinese():string;
  getYearInGanZhi():string;getMonthInGanZhi():string;getDayInGanZhi():string;getTimeInGanZhi():string;
  getDayTianShen():string;getDayTianShenType():string;getDayTianShenLuck():string;
  getTimeTianShen():string;getTimeTianShenType():string;getTimeTianShenLuck():string;
  getDayYi(sect?:number):string[];getDayJi(sect?:number):string[];getTimeYi():string[];getTimeJi():string[];
  getDayZhiIndex():number;getDayChongShengXiao():string;getDaySha():string;getTimeChongShengXiao():string;getTimeSha():string;
  getTimePositionCaiDesc():string;getJieQi():string;
 };
 export const Solar:{fromYmdHms(y:number,m:number,d:number,h:number,min:number,s:number):{getLunar():Lunar}};
}
