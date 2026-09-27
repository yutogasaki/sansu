# Generation prompts

Built-in image_gen, 2026-09-27. Character identity reference: `src/assets/pokomoko-learning-poses.webp`. Concept storyboards, not runtime screenshots. Each image shows ready / third correct / fifth correct. Image labels A/B/C identify states, not the three separate directions.

## Shared prompt

Use case: ui-mockup. Create a meticulously art-directed storyboard of a Japanese mobile arithmetic game, THREE portrait phone-screen views side by side in a single landscape image. Each screen is the actual UI crop 390:844, no device mockup, no desktop chrome, no explanatory paragraphs. States left READY, middle THIRD CORRECT, right FIFTH CORRECT / earned peak. Place small A/B/C-style state labels OUTSIDE phone screens only. This is a serious crafted game UI, not a dashboard or an illustration above a worksheet.
REFERENCE IMAGE: exact identity of Pokomoko, a plush patchwork bear. Preserve its exact cream/blue split head with vertical stitch, black patterned left ear, pink polka-dot right ear, black bead eyes, pink scarf, turquoise/pink arms, striped/patchwork body, two visible feet. Do not invent a new mascot or giant head. Use the same character identity, camera and UI anchors in all three states. Character should feel physically present, have deliberate line-of-action poses and readable hand/foot contact.
Constraints in all 3 screens: compact 44px top navigation with 'さんすう', six progress dots and close X. Main question '2 + 3 =' in very large deep ink type, a clearly empty answer box in READY; correct state may show '5'. The arithmetic area and bottom keypad remain unobscured. Bottom keypad starts around y=520 on a 844px screen, all keys 7 8 9 / 4 5 6 / 1 2 3 / 0 plus C, backspace, enter. All targets comfortably large. Header plus main board, no separate reward dashboard, no bottom progress meter, no tiny copy or fineprint. Child-facing celebratory text only large '3 れんぞく!' and '5 れんぞく!' at their moments. Quiet tactile cream at rest, vivid coral/cobalt/honey/teal at earned peak. Carefully designed silhouette, spacing, edge highlights, real material differences. Neither stock generic pastel UI nor random confetti or glow clouds. Make motion readable from character acting and causal paths. No extra mascots, coins, ads, rankings, clocks, cluttered icon bars.

## Direction briefs

1. **Star pinball:** ivory toy board, cobalt curved rim, coral rubber bumpers. Star from answer box bounces into Pokomoko's paw; five recessed sockets fill; the fifth turns the rim into a rainbow rail and carries the same bear on a star sled. Same camera and clear math/keys. Materials: stitched plush, painted wood, smooth keycaps.
2. **Paper play:** bold printed ink, folded cream card, curled corner supporting the bear. Answer tile folds into a star, three stars form a garland, fifth becomes a rainbow paper airplane. Same camera and anchors, distinct paper creases/fibers versus plush and smooth keycaps.
3. **Wind-up parade:** ivory enamel music-box board, indigo line, brass track, coral/mint keycaps. Bear holds a crank on a rolling star toy; windows fill; five windows launch a toy train and pennants around the question board. Preserve math/key clarity and exact character.

## First review

All three improve material, scale contrast and physical acting over rejected v3. None is a final implementation target yet: the dedicated hero area still occupies too much vertical space; math is only a one-line example and does not prove written-arithmetic fit; generated typography, key legends and star counts require deterministic DOM correction. Direction 1 is the author's leading candidate because catch → fill → ride gives a direct causal action without explaining a train mechanism. The user preference is pending.


## Production asset lineage

The following are generation briefs, not a claim to reproduce the exact tool prompt verbatim. All were produced with the built-in image_gen on 2026-09-27, retaining direction 1 and the existing Pokomoko identity reference.

| File | Brief / use |
| --- | --- |
| `04-star-arcade-refined.png` | Tighten the chosen toy-board storyboard, retain the same camera and three states. Still has excess top space; use material direction, not literal generated layout. |
| `05-pokomoko-poses.png` | Transparent 1536×1024, six equal cells: ready, crouch, catch, jump, star ride, land. Same cream/blue stitched head, patterned ears, scarf, patchwork body and complete feet. |
| `06-arcade-rim.png` | Transparent wide curved cobalt molded rail, coral rounded ends, upper light, tactile depth, no lettering. Superseded as runtime asset by 07. |
| `07-arcade-sockets.png` | Edit the same rail with five recessed star sockets across the left two thirds; preserve the bear platform on the right. |

Runtime assets are format conversions of 05 and 07 at WebP quality 92/method 6, with alpha retained. No generated lettering is used. Concepts and superseded assets remain in this design folder, outside production public assets.
