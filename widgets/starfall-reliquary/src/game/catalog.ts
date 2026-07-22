import type {EnemyKind} from './types';
export const ENEMIES:Record<EnemyKind,{hp:number;r:number;speed:number;value:number}>={drifter:{hp:18,r:11,speed:1.15,value:1},lancer:{hp:32,r:13,speed:.72,value:2},cantor:{hp:28,r:13,speed:.5,value:2},orbiter:{hp:25,r:12,speed:.82,value:2},splitter:{hp:42,r:17,speed:.5,value:2},minekeeper:{hp:48,r:16,speed:.42,value:3},spark:{hp:9,r:7,speed:1.5,value:0},warden:{hp:850,r:48,speed:.15,value:50}};
export const UPGRADES=[
 {id:'twin',name:'Twin Needle',text:'Needle Array fires an additional bolt.',tag:'Needle'},
 {id:'pierce',name:'Piercing Script',text:'Bolts pass through another foe.',tag:'Needle'},
 {id:'quick',name:'Quick Etching',text:'Needle cadence increases by 22%.',tag:'Needle'},
 {id:'orbit',name:'Orbit Blades',text:'Add a celestial blade that circles and damages foes.',tag:'Weapon'},
 {id:'mortar',name:'Comet Mortar',text:'Comets strike faster and explode in a larger blast.',tag:'Weapon'},
 {id:'prism',name:'Prism Beam',text:'Lengthen and strengthen a sweeping beam.',tag:'Weapon'},
 {id:'magnet',name:'Magnet Core',text:'Extend shard attraction; higher ranks repair hull.',tag:'Support'},
 {id:'cryo',name:'Cryo Wake',text:'Leave larger, longer slowing fields; chilled foes burst.',tag:'Support'},
 {id:'aegis',name:'Aegis',text:'Absorb one hit; ranks recharge faster and repel foes.',tag:'Defense'},
 {id:'overclock',name:'Overclock',text:'+30% damage and fire rate; -15 max hull.',tag:'Risk'}
] as const;
export const upgradeName=(id:string)=>UPGRADES.find(u=>u.id===id)?.name||id;
