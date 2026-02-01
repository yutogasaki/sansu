const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../docs/05_english_words.md');
const outputFile = path.join(__dirname, '../src/domain/english/words.ts');

try {
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split('\n');

    let currentLevel = 0;
    const words = [];

    for (const line of lines) {
        // Detect Level Header: "### Lv.1（..." or "### Lv.10（..."
        const levelMatch = line.match(/^### Lv\.(\d+)/);
        if (levelMatch) {
            currentLevel = parseInt(levelMatch[1], 10);
            console.log(`Found Level ${currentLevel}`);
            continue;
        }

        // Detect Table Row: "| apple | りんご | 食べ物 |"
        // Ignore header separator "|---|---|---|"
        if (line.trim().startsWith('|') && !line.includes('---|')) {
            const parts = line.split('|').map(s => s.trim()).filter(s => s !== '');
            // Expected parts: [English, Japanese, Category]
            // Sometimes index 0 is empty string due to split

            if (parts.length >= 3) {
                // Check if it's the header row "English | Japanese..."
                if (parts[0].toLowerCase() === 'english') continue;

                // Basic validation
                const id = parts[0];
                const japanese = parts[1];
                const category = parts[2] || 'その他';

                if (currentLevel > 0) {
                    words.push({
                        id,
                        level: currentLevel,
                        japanese,
                        category
                    });
                }
            }
        }
    }

    const tsContent = `export interface EnglishWord {
    id: string;
    level: number;
    japanese: string;
    category: string;
}

export const ENGLISH_WORDS: EnglishWord[] = ${JSON.stringify(words, null, 4)};
`;

    fs.writeFileSync(outputFile, tsContent, 'utf8');
    console.log(`Successfully wrote ${words.length} words to ${outputFile}`);

} catch (e) {
    console.error("Error:", e);
}
