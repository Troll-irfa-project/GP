export const MAX_RACERS = 12;
export function gridSlot(index) {return {along:-4-Math.floor(index/4)*3.5,lane:(index%4-1.5)*2.5};}
