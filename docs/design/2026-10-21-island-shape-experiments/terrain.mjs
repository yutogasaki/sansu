export const SIZE = 17;
export const SPACING = 0.7;
export const WATER = 0.08;
const key = (x, z) => z * SIZE + x;
export const world = n => (n - (SIZE - 1) / 2) * SPACING;
export const protectedCell = (x, z) => x >= 5 && x <= 7 && z >= 6 && z <= 9;
export function initialState() {
  const heights = Array.from({ length: SIZE * SIZE }, (_, i) => {
    const x = world(i % SIZE) + 0.65, z = world(Math.floor(i / SIZE));
    const r = (x / 3.2) ** 2 + (z / 2.6) ** 2;
    return r < 0.8 ? 1 : 0;
  });
  for (let z = 6; z <= 9; z++) for (let x = 5; x <= 7; x++) heights[key(x, z)] = 1;
  return { heights, plants: [key(6, 5), key(8, 5), key(9, 6), key(5, 10), key(9, 10), key(10, 8)], bird: null };
}
const clone = state => ({ heights: [...state.heights], plants: [...state.plants], bird: state.bird && { ...state.bird } });
export const elevation = level => level === 0 ? -0.48 : 0.42 + (level - 1) * 0.57;
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
function nearbyShore(state, x, z) {
  const candidates = [];
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const a = x + dx, b = z + dz;
    if (a < 1 || b < 1 || a >= SIZE-1 || b >= SIZE-1 || state.heights[key(a,b)] !== 0) continue;
    if ([[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oz]) => state.heights[key(a+ox,b+oz)] > 0)) candidates.push({x:a,z:b,d:dx*dx+dz*dz});
  }
  candidates.sort((a,b) => a.d-b.d || a.z-b.z || a.x-b.x);
  return candidates.length ? {x:candidates[0].x,z:candidates[0].z} : null;
}
export class TerrainHistory {
  constructor() { this.state = initialState(); this.past = []; this.future = []; }
  edit(x, z, tool) {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 1 || z < 1 || x >= SIZE-1 || z >= SIZE-1) return { changed:false, message:'島のまわりは、海を残しておこう。' };
    if (!['raise','lower','plant'].includes(tool)) return { changed:false, message:'ながめる道具で、島を回せるよ。' };
    if (protectedCell(x,z)) return { changed:false, message:'ここは家と入口の足場。となりの土地を変えてみよう。' };
    const index = key(x,z), next = clone(this.state);
    if (tool === 'plant') {
      if (next.heights[index] === 0) return {changed:false,message:'木は陸に植えてみよう。'};
      if (next.plants.includes(index)) return {changed:false,message:'ここには、もう木が育っているよ。'};
      next.plants.push(index);
    } else {
      const level = Math.max(0,Math.min(4,next.heights[index] + (tool === 'raise' ? 1 : -1)));
      if (level === next.heights[index]) return {changed:false,message: level === 0 ? 'ここはもう海。となりの陸を掘ってみよう。' : 'この高さまで盛れたよ。となりも変えてみよう。'};
      next.heights[index] = level;
    }
    const changedShore = (this.state.heights[index] === 0) !== (next.heights[index] === 0);
    if (changedShore) next.bird = nearbyShore(next,x,z);
    this.past.push(clone(this.state)); this.future = []; this.state = next;
    return { changed:true, message: tool === 'plant' ? '同じ地面に、木が根をおろした。' : changedShore && next.bird ? '水際が変わった。水鳥が、見に来たよ。' : tool === 'raise' ? '土がふくらんで、小さな丘になった。' : '地面がひとつ低くなった。' };
  }
  undo() { if (!this.past.length) return false; this.future.push(clone(this.state)); this.state = this.past.pop(); return true; }
  redo() { if (!this.future.length) return false; this.past.push(clone(this.state)); this.state = this.future.pop(); return true; }
  restart() { this.past.push(clone(this.state)); this.future=[]; this.state=initialState(); }
}
export function countIslands(state) {
  const seen=new Set(); let count=0;
  for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) {
    if(state.heights[key(x,z)]===0 || seen.has(key(x,z))) continue;
    count++; const stack=[[x,z]]; seen.add(key(x,z));
    while(stack.length) { const [a,b]=stack.pop(); for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const c=a+dx,d=b+dz,k=key(c,d);
      if(c>=0&&d>=0&&c<SIZE&&d<SIZE&&!seen.has(k)&&state.heights[k]>0) {seen.add(k);stack.push([c,d]);}
    }}
  }
  return count;
}
