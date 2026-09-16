import { Home, Warehouse, Sprout, Trees, Flower2, Armchair } from 'lucide-react';
import type { Prop } from '../../domain/natureTown/types';
export const names: Record<Prop['kind'],string>={home:'家',hub:'食たく',farm:'畑',tree:'木',flowers:'花',bench:'ベンチ'};
export const icons={home:Home,hub:Warehouse,farm:Sprout,tree:Trees,flowers:Flower2,bench:Armchair};
