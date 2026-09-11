export interface EnglishExampleSentence {
    wordId: string;
    english: string;
}

/**
 * Fixed starter examples for the vocabulary cards.
 *
 * This catalog is intentionally separate from the optional listening catalog:
 * a card can show a sentence without making that sentence eligible for the
 * listening offer or changing any learning progression.
 */
const examples: readonly EnglishExampleSentence[] = [
    // Level 1 · food
    { wordId: 'apple', english: 'This is an apple.' },
    { wordId: 'orange', english: 'This is an orange.' },
    { wordId: 'banana', english: 'This is a banana.' },
    { wordId: 'egg', english: 'This is an egg.' },
    { wordId: 'milk', english: 'I drink milk.' },
    { wordId: 'bread', english: 'I eat bread.' },
    { wordId: 'rice', english: 'I eat rice.' },
    { wordId: 'meat', english: 'I like meat.' },
    { wordId: 'water', english: 'I drink water.' },
    { wordId: 'juice', english: 'I drink juice.' },
    { wordId: 'cake', english: 'I like cake.' },
    { wordId: 'pizza', english: 'I like pizza.' },
    { wordId: 'candy', english: 'This candy is sweet.' },
    { wordId: 'vegetable', english: 'I eat a vegetable.' },
    { wordId: 'fruit', english: 'I like fruit.' },

    // Level 1 · animals
    { wordId: 'dog', english: 'This is a dog.' },
    { wordId: 'cat', english: 'Look at the cat.' },
    { wordId: 'bird', english: 'The bird can fly.' },
    { wordId: 'fish', english: 'The fish can swim.' },
    { wordId: 'rabbit', english: 'The rabbit is fast.' },
    { wordId: 'elephant', english: 'The elephant is big.' },
    { wordId: 'lion', english: 'The lion is strong.' },
    { wordId: 'tiger', english: 'The tiger can run.' },
    { wordId: 'monkey', english: 'The monkey can jump.' },
    { wordId: 'bear', english: 'The bear is big.' },
    { wordId: 'horse', english: 'The horse can run.' },
    { wordId: 'cow', english: 'The cow eats grass.' },
    { wordId: 'pig', english: 'The pig is pink.' },
    { wordId: 'mouse', english: 'The mouse is small.' },
    { wordId: 'sheep', english: 'The sheep has wool.' },

    // Level 1 · numbers
    { wordId: 'one', english: 'I have one apple.' },
    { wordId: 'two', english: 'I have two apples.' },
    { wordId: 'three', english: 'I have three apples.' },
    { wordId: 'four', english: 'I see four birds.' },
    { wordId: 'five', english: 'I see five stars.' },
    { wordId: 'six', english: 'I see six fish.' },
    { wordId: 'seven', english: 'I see seven flowers.' },
    { wordId: 'eight', english: 'I see eight balls.' },
    { wordId: 'nine', english: 'I see nine books.' },
    { wordId: 'ten', english: 'I can count to ten.' },
    { wordId: 'hundred', english: 'One hundred is a big number.' },
    { wordId: 'thousand', english: 'One thousand is a big number.' },

    // Level 1 · everyday words
    { wordId: 'yes', english: 'Yes, I can.' },
    { wordId: 'no', english: 'No, thank you.' },
    { wordId: 'hello', english: 'Hello, my friend.' },
    { wordId: 'goodbye', english: 'Goodbye, see you.' },
    { wordId: 'please', english: 'Please help me.' },
    { wordId: 'thank', english: 'Thank you very much.' },

    // Level 1 · adjectives
    { wordId: 'good', english: 'This apple is good.' },
    { wordId: 'bad', english: 'This candy is bad.' },
    { wordId: 'big', english: 'The elephant is big.' },
    { wordId: 'small', english: 'The mouse is small.' },
    { wordId: 'new', english: 'This is a new book.' },
    { wordId: 'old', english: 'This is an old tree.' },
    { wordId: 'hot', english: 'The soup is hot.' },
    { wordId: 'cold', english: 'The water is cold.' },
    { wordId: 'happy', english: 'I am happy today.' },
    { wordId: 'sad', english: 'The song is sad.' },

    // Level 1 · verbs
    { wordId: 'like', english: 'I like apples.' },
    { wordId: 'want', english: 'I want some juice.' },
];

export const ENGLISH_EXAMPLE_SENTENCES: readonly EnglishExampleSentence[] = examples;

/**
 * Returns the fixed example for a vocabulary learning item.
 *
 * The lookup stays ID-based so saved problems keep the same behavior even if
 * the visible word is customized or legacy data is used.
 */
export function getEnglishExampleSentence(wordId: string): string | undefined {
    return ENGLISH_EXAMPLE_SENTENCES.find(sentence => sentence.wordId === wordId)?.english;
}
