import { build } from 'esbuild';
import { createHash } from 'node:crypto';

// Pure domain functions execute in the Node test process. The app and the browser
// receive no answer hooks, DEV imports, generated question overrides or fake progress.
const compiled = await build({ stdin: { contents: `
    export { createInitialProfile } from './src/domain/user/profile.ts';
    export { MATH_CURRICULUM, getLevelForSkill } from './src/domain/math/curriculum.ts';
    export { ENGLISH_WORDS } from './src/domain/english/words.ts';
    export { generateHissanGrid } from './src/domain/math/hissanEngine.ts';
    export { generateWrittenArithmeticGrid } from './src/domain/math/writtenArithmetic.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const compiledSource = compiled.outputFiles[0].text;
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiledSource).toString('base64')}`);
export const fixtureModuleHash = createHash('sha256').update(compiledSource).digest('hex');

export async function seedLearningProfile(page, scenario) {
    const skill = scenario.skill ?? 'add_1d_1';
    const profile = domain.createInitialProfile('つむぎ', 2, Math.max(0, (domain.getLevelForSkill(skill) || 1) - 1), 1, scenario.subject ?? 'math');
    profile.soundEnabled = false;
    // The actual setting selects mental decimal input or the existing Hissan form.
    profile.hissanModeEnabled = scenario.type === 'hissan';
    const memory = id => ({ profileId: profile.id, id, strength: 2, nextReview: id === skill ? '2000-01-01' : '2099-01-01',
        updatedAt: '2000-01-01', totalAnswers: scenario.mathAnswerCount ?? 20, correctAnswers: (scenario.mathAnswerCount ?? 20) - 2, incorrectAnswers: 2, skippedAnswers: 0 });
    const math = [...new Set(Object.values(domain.MATH_CURRICULUM).flat())]
        .filter(id => domain.getLevelForSkill(id) <= profile.mathMaxUnlocked)
        .map(id => ({ ...memory(id), status: domain.getLevelForSkill(id) < profile.mathMainLevel ? 'retired' : 'active' }));
    const vocab = domain.ENGLISH_WORDS.filter(word => word.level <= profile.vocabMaxUnlocked).map(word => memory(word.id));
    await page.evaluate(async ({ profile, math, vocab }) => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = database.transaction(['profiles', 'appData', 'memoryMath', 'memoryVocab'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        for (const row of math) transaction.objectStore('memoryMath').put(row);
        for (const row of vocab) transaction.objectStore('memoryVocab').put(row);
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        database.close();
    }, { profile, math, vocab });
    return profile.id;
}

export function expectedLearningModel(slot) {
    const problem = slot.problem;
    return problem.hissanVersion === 2 || problem.hissanVersion === 3
        ? domain.generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer,
            problem.hissanVersion === 3 ? { divisionInput: 'compact' } : undefined)
        : domain.generateHissanGrid(problem.categoryId, problem.questionText,
            Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join('') : problem.correctAnswer);
}

export function expectedLearningAnswer(slot, inputType) {
    const problem = slot.problem;
    if (inputType === 'hissan') {
        const grid = expectedLearningModel(slot);
        if (!grid) throw new Error('The real Hissan form must have a matching pure domain grid');
        const step = grid.steps[slot.hissanStep ?? 0];
        return { values: step.correctValues, final: (slot.hissanStep ?? 0) === grid.steps.length - 1,
            step: { row: step.rowIndex, columns: step.inputCellIndices }, totalSteps: grid.steps.length };
    }
    return { values: problem.correctAnswer, final: true };
}
