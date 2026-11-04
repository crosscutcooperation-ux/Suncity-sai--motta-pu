import {BUILDINGS} from './site-data.js';
export {BUILDINGS};
export const SOURCE_URL='https://drive.google.com/file/d/1nE4XFflBSq28CFBcqy5xB1_D44X_vBQn/view';
export function resolvePlan(id,floor){
 const building=BUILDINGS.find(b=>b.id===id);
 if(!building||!Number.isInteger(floor)||floor<0||floor>building.floors)return {available:false,reason:'Choose a valid building and floor.'};
 if(floor===0)return {available:false,reason:'The supplied ground-level commercial drawings do not specify a residential ground-floor layout. Open Reference renders to inspect the commercial plans.'};
 if(!building.page)return {available:false,reason:'This tower is shown in the brochure master layout, but no apartment drawing for it appears in the supplied five-page plan set. Its 3D massing is illustrative. Tower numbers are retained where the master-layout names are not legible.'};
 return {available:true,key:building.layout,kind:'typical',page:building.page,verified:false,note:'Original typical layout for '+building.name+' from the supplied PDF, page '+building.page+'. The source does not assign this layout to individual floors or provide a refuge-floor schedule. Confirm the selected level with the developer.'};
}
