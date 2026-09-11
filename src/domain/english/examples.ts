import { LISTENING_SENTENCES } from './listening';

/**
 * Returns the authored example sentence for a vocabulary learning item.
 *
 * The lookup deliberately stays fixed and ID-based so saved problems keep the
 * same behavior even if the visible word is customized or legacy data is used.
 */
export function getEnglishExampleSentence(wordId: string): string | undefined {
    return LISTENING_SENTENCES.find(sentence => sentence.wordId === wordId)?.english;
}
