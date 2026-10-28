"""Run a preserved checker with reports redirected; never overwrite evidence."""
import argparse
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('checker',choices=['sansu-frozen-browser-pair-check.py','sansu-edge-browser-pair-check.py','sansu-final-ui-check.py','ordinary-final-restoration-check.py','post-edit-life-check.py','final-continuity-check.py'])
parser.add_argument('--out',required=True)
args=parser.parse_args()
folder=Path(__file__).resolve().parent;evidence=folder.parent;output=Path(args.out).resolve()
if output==evidence or evidence in output.parents:raise SystemExit('Choose an output folder outside the evidence tree')
output.mkdir(parents=True,exist_ok=True)
checker=folder/args.checker
# Byte-identical source copies retain the original machine path. Relocate only
# that evidence root in memory; preserve the stored script and its recorded hash.
source=checker.read_text().replace('/Users/yutogasaki/Projects/sansu/docs/design/2026-10-23-place-method-comparison/evidence',str(evidence))
write=Path.write_text
written=[]
def redirected(self,data,*a,**kw):
 if self.resolve().parent!=evidence:raise RuntimeError(f'Unexpected checker output: {self}')
 target=output/self.name;written.append(str(target));return write(target,data,*a,**kw)
Path.write_text=redirected
try:exec(compile(source,str(checker),'exec'),{'__file__':str(checker),'__name__':'__main__'})
finally:Path.write_text=write
print('Reports redirected to: '+', '.join(written))
