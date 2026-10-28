export const SIZE = 17;
export const SPACING = 0.7;
export const WATER = 0.08;
const key = (x, z) => z * SIZE + x;
export const world = n => (n - (SIZE - 1) / 2) * SPACING;
export const protectedCell = (x, z) => x >= 5 && x <= 7 && z >= 6 && z <= 9;
export const TREE_SPECS = [
  { id:'tree-1', part:'willow', x:5,z:5,yaw:Math.PI },
  { id:'tree-2', part:'birch', x:7,z:5,yaw:0 },
  { id:'tree-3', part:'spire', x:9,z:5,yaw:0 },
  { id:'tree-4', part:'willow', x:12,z:6,yaw:Math.PI },
  { id:'tree-5', part:'birch', x:4,z:10,yaw:0 },
  { id:'tree-6', part:'spire', x:12,z:10,yaw:0 },
];
export const EDITS = [
  {id:'E1', x:9,z:7,tool:'lower',name:'湾を奥へ掘る'},
  {id:'E2', x:9,z:10,tool:'raise',name:'小さな岬を作る'},
  {id:'E3', x:8,z:11,tool:'lower',name:'手前の岸を削る'},
];
export function initialState() {
  const heights = Array.from({length:SIZE*SIZE},(_,i)=>{
    const x=world(i%SIZE), z=world(Math.floor(i/SIZE));
    const land=(x/3.95)**2+(z/3.4)**2<1;
    const bay=x>=.35&&x<=1.8&&z>=0;
    return land&&!bay?1:0;
  });
  for(let z=6;z<=9;z++)for(let x=5;x<=7;x++)heights[key(x,z)]=1;
  return {heights,plants:TREE_SPECS.map(t=>key(t.x,t.z))};
}
const clone = state => ({ heights: [...state.heights], plants: [...state.plants] });
export const elevation = level => level <= 1 ? -0.48 + level * .9 : 0.42 + (level - 1) * 0.57;
export function sampleHeight(state, wx, wz) {
  const px = Math.max(0, Math.min(SIZE - 1.0001, wx / SPACING + (SIZE - 1) / 2));
  const pz = Math.max(0, Math.min(SIZE - 1.0001, wz / SPACING + (SIZE - 1) / 2));
  const x = Math.floor(px), z = Math.floor(pz);
  const smooth = t => t * t * (3 - 2 * t);
  const u = smooth(px - x), v = smooth(pz - z);
  return elevation(state.heights[key(x, z)]) * (1-u) * (1-v)
    + elevation(state.heights[key(x+1, z)]) * u * (1-v)
    + elevation(state.heights[key(x, z+1)]) * (1-u) * v
    + elevation(state.heights[key(x+1, z+1)]) * u * v;
}
export function ownerSupports(state) {
  for (const t of [{id:'home',x:6,z:7.3},...TREE_SPECS]) {
    const x=world(t.x),z=world(t.z),y=sampleHeight(state,x,z),r=t.id==='home'?.47:.25;
    for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]]) {
      const h=sampleHeight(state,x+dx,z+dz);if(h<=WATER+.12||Math.abs(h-y)>.13)return false;
    }
  }
  return true;
}
export class TerrainHistory {
  constructor() { this.state = initialState(); this.past = []; this.future = []; this.guard = ownerSupports; }
  edit(x, z, tool) {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 1 || z < 1 || x >= SIZE-1 || z >= SIZE-1) return { changed:false, message:'島のまわりは、海を残しておこう。' };
    if (!['raise','lower'].includes(tool)) return { changed:false, message:'ながめる道具で、島を回せるよ。' };
    if (protectedCell(x,z)) return { changed:false, message:'ここは家と入口の足場。となりの土地を変えてみよう。' };
    const index = key(x,z), next = clone(this.state);
    const level = Math.max(0,Math.min(4,next.heights[index] + (tool === 'raise' ? 1 : -1)));
    if (level === next.heights[index]) return {changed:false,message: level === 0 ? 'ここはもう海。となりの陸を掘ってみよう。' : 'この高さまで盛れたよ。となりも変えてみよう。'};
    if (level === 0 && next.plants.includes(index)) return {changed:false,message:'ここには木が根をおろしているよ。となりの岸を掘ってみよう。'};
    next.heights[index] = level;
    if (this.guard && !this.guard(next)) return {changed:false,message:'家・木・ぽこもこの足場を残して、となりを変えてみよう。'};
    this.past.push(clone(this.state)); this.future = []; this.state = next;
    return { changed:true, message: tool === 'raise' ? '土がふくらんで、小さな丘になった。' : '地面がひとつ低くなった。' };
  }
  undo() { if (!this.past.length || (this.guard && !this.guard(this.past.at(-1)))) return false; this.future.push(clone(this.state)); this.state = this.past.pop(); return true; }
  redo() { if (!this.future.length || (this.guard && !this.guard(this.future.at(-1)))) return false; this.past.push(clone(this.state)); this.state = this.future.pop(); return true; }
}
