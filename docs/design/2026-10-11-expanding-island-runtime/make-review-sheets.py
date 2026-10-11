from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 17)
SMALL = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)


def sheet(name, title, entries, cols, width, height):
    margin, header, label = 20, 64, 44
    rows = (len(entries) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * (width + margin) + margin,
                              header + rows * (height + label + margin) + margin), '#f5f7fa')
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 20), title, fill='#263442', font=FONT)
    for i, (caption, path) in enumerate(entries):
        x = margin + (i % cols) * (width + margin)
        y = header + (i // cols) * (height + label + margin)
        draw.text((x, y), caption, fill='#263442', font=SMALL)
        image = Image.open(ROOT / path).convert('RGB')
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        canvas.paste(image, (x + (width - image.width) // 2, y + label))
    canvas.save(ROOT / name, quality=92)


acquired = ['welcome', 'first-home', 'twenty-real-answers', 'young-connected-garden',
            'split-same-owner', 'reconnected-same-tree', 'same-plan-return', 'optional-six-goals']
entries = [(f'Real acquisition / {step}', f'production/acquired-390-{step}.png') for step in acquired]
entries[0] = ('Initial loading capture / before 3D ready', 'production/acquired-390-welcome.png')
entries.extend([
    ('DIAGNOSTIC mature 8 / actual app', 'production/qa-place-whole-island-v1-390-grown-real-3d.png'),
    ('DIAGNOSTIC bay 16 / actual app', 'wide/390-bay-16-whole.png'),
    ('DIAGNOSTIC bay 32 / actual app', 'wide/390-bay-32-whole.png'),
    ('DIAGNOSTIC forest 32 / actual app', 'wide/390-forest-32-whole.png'),
])
sheet('critical-path.jpg', 'Actual app / native05-expanding-a3 / true flags / real acquisition and separate diagnostics',
      entries, 4, 280, 606)

sheet('benchmark-comparison.jpg', 'Approved native05 source and actual app A3 / whole frames retained; cameras differ / art HOLD', [
    ('Approved source render / whole-island-native-3d-05', '../2026-10-10-island-final-3d/whole-island-render.png'),
    ('Actual app A3 / DIAGNOSTIC mature 8', 'production/qa-place-whole-island-v1-768-grown-real-3d.png'),
    ('Actual app A3 / DIAGNOSTIC bay 16', 'wide/768-bay-16-whole.png'),
    ('Actual app A3 / DIAGNOSTIC bay 32', 'wide/768-bay-32-whole.png'),
], 2, 680, 720)
print('Created actual critical path and benchmark comparison sheets.')
