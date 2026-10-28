export function waterMethodTransform(source,id){
 if(id.endsWith('/src/components/island/growing/placeSpringGeometry.ts')){
  const marker='    // A composed water group is already represented by its evaluated bed,';
  if(source.split(marker).length!==2)throw Error('Water method integration changed');
  return "import { buildWaterModules } from '../../../../docs/design/2026-10-23-place-brush-trial/water-modules';\n"+source.replace(marker,'    if(buildWaterModules(g,state,layout,place))return;\n'+marker);
 }
 return source;
}
