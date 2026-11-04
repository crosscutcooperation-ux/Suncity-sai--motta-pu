// Registration to brochure page 12. Dimensions and scale are illustrative.
const located=[
 [1,'Carina',991,621,'carina-vega',Math.PI/2],[2,'Vega',991,515,'carina-vega',Math.PI/2],
 [3,'Coral',1220,548,'coral-group'],[4,'Jade',1220,657,'coral-group'],
 [5,'Opal',1326,548,'opal-group'],[6,'Ruby',1326,657,'opal-group'],
 [7,'Emerald',1435,548,'coral-group'],[8,'Ivory',1435,657,'coral-group'],
 [9,'Altair',1220,780,'coral-group'],[10,'Avior',1326,780,'opal-group'],[11,'Atria',1435,780,'coral-group'],
 [12,'Callisto',1435,888,'coral-group'],[13,'Nova',1326,888,'opal-group'],[14,'Orion',1220,888,'coral-group'],
 [15,'Galaxy',1220,972,'coral-group'],[16,'Polaris',1330,972,'opal-group'],
 [17,'Tower 17',1620,810,'coral-group',-.65],[18,'Tower 18',1620,655,'coral-group',.65],
 [19,'Tower 19',1600,425,'coral-group'],[20,'Tower 20',1705,425,'coral-group'],[21,'Tower 21',1810,425,'coral-group'],
 [22,'Tower 22',1830,350,'coral-group',Math.PI/2],[23,'Tower 23',1830,600,'coral-group',Math.PI/2],
 [24,'Tower 24',1810,535,'coral-group'],[25,'Tower 25',1705,535,'coral-group'],[26,'Tower 26',1600,535,'coral-group'],
];
export const toSite=(x,y)=>({x:(x-1350)*.24,z:(y-630)*.24});
export const BUILDINGS=located.map(([number,name,x,y,layout,rotation=0])=>({id:name.toLowerCase().replaceAll(' ','-'),sceneId:name.toLowerCase().replaceAll(' ','-'),number,name,...toSite(x,y),layout,rotation,floors:32,page:number>16?null:layout==='carina-vega'?3:layout==='coral-group'?4:5,width:25.6,depth:13.3}));
export const LANDMARKS={garden:toSite(1320,605),pool:toSite(2000,370),club:toSite(1300,475),club2:toSite(2010,415),plaza:toSite(1640,720)};
export const SOURCE_FOLDER='https://drive.google.com/drive/folders/1sIcFZ-Leqw6GZM0O4IJqCDM7R38ECwBX';
