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

    // Level 2 · body
    { wordId: 'head', english: 'This is my head.' },
    { wordId: 'face', english: 'Wash your face.' },
    { wordId: 'eye', english: 'I see with one eye.' },
    { wordId: 'ear', english: 'My ear can hear.' },
    { wordId: 'nose', english: 'Touch your nose.' },
    { wordId: 'mouth', english: 'Open your mouth.' },
    { wordId: 'hand', english: 'Hold my hand.' },
    { wordId: 'arm', english: 'Raise your arm.' },
    { wordId: 'leg', english: 'My leg is strong.' },
    { wordId: 'foot', english: 'My foot is small.' },
    { wordId: 'hair', english: 'Her hair is long.' },
    { wordId: 'finger', english: 'Point with one finger.' },
    { wordId: 'tooth', english: 'Brush one tooth.' },
    { wordId: 'neck', english: 'My neck is warm.' },
    { wordId: 'shoulder', english: 'Touch your shoulder.' },

    // Level 2 · family
    { wordId: 'father', english: 'My father is kind.' },
    { wordId: 'mother', english: 'My mother is kind.' },
    { wordId: 'brother', english: 'My brother can run.' },
    { wordId: 'sister', english: 'My sister can read.' },
    { wordId: 'family', english: 'I love my family.' },
    { wordId: 'baby', english: 'The baby is small.' },
    { wordId: 'parent', english: 'Ask your parent.' },
    { wordId: 'son', english: 'Their son can run.' },
    { wordId: 'daughter', english: 'Her daughter is happy.' },
    { wordId: 'grandfather', english: 'My grandfather tells stories.' },
    { wordId: 'grandmother', english: 'My grandmother is kind.' },

    // Level 2 · colors
    { wordId: 'red', english: 'The apple is red.' },
    { wordId: 'blue', english: 'The sky is blue.' },
    { wordId: 'green', english: 'The tree is green.' },
    { wordId: 'yellow', english: 'The flower is yellow.' },
    { wordId: 'white', english: 'The snow is white.' },
    { wordId: 'black', english: 'The cat is black.' },
    { wordId: 'pink', english: 'The pig is pink.' },
    { wordId: 'brown', english: 'The bear is brown.' },
    { wordId: 'purple', english: 'This flower is purple.' },
    { wordId: 'gray', english: 'The mouse is gray.' },
    { wordId: 'orange_lv2', english: 'The ball is orange.' },

    // Level 2 · people
    { wordId: 'boy', english: 'The boy can run.' },
    { wordId: 'girl', english: 'The girl can read.' },
    { wordId: 'man', english: 'The man is tall.' },
    { wordId: 'woman', english: 'The woman is kind.' },
    { wordId: 'child', english: 'The child can play.' },
    { wordId: 'friend', english: 'My friend is happy.' },
    { wordId: 'teacher', english: 'My teacher can help.' },
    { wordId: 'student', english: 'The student can read.' },

    // Level 2 · adjectives
    { wordId: 'long', english: 'The rope is long.' },
    { wordId: 'short', english: 'The pencil is short.' },
    { wordId: 'tall', english: 'The man is tall.' },
    { wordId: 'young', english: 'The child is young.' },
    { wordId: 'large', english: 'The elephant is large.' },
    { wordId: 'little', english: 'The baby is little.' },

    // Level 2 · verbs
    { wordId: 'eat', english: 'I eat an apple.' },
    { wordId: 'drink', english: 'I drink water.' },
    { wordId: 'have', english: 'I have a book.' },
    { wordId: 'see', english: 'I see a bird.' },
    { wordId: 'look', english: 'Look at the flower.' },
    { wordId: 'love', english: 'I love my family.' },
    { wordId: 'know', english: 'I know the answer.' },
    { wordId: 'think', english: 'I think of home.' },

    // Level 3 · places
    { wordId: 'house', english: 'This is my house.' },
    { wordId: 'home', english: 'I am at home.' },
    { wordId: 'room', english: 'This is my room.' },
    { wordId: 'school', english: 'I go to school.' },
    { wordId: 'park', english: 'We play in the park.' },
    { wordId: 'station', english: 'The train is at the station.' },
    { wordId: 'hospital', english: 'The doctor is at the hospital.' },
    { wordId: 'restaurant', english: 'We eat at the restaurant.' },
    { wordId: 'store', english: 'I go to the store.' },
    { wordId: 'library', english: 'I read at the library.' },

    // Level 3 · school
    { wordId: 'class', english: 'This is our class.' },
    { wordId: 'desk', english: 'My book is on the desk.' },
    { wordId: 'chair', english: 'Sit on the chair.' },
    { wordId: 'book', english: 'I read a book.' },
    { wordId: 'pen', english: 'I write with a pen.' },
    { wordId: 'pencil', english: 'I write with a pencil.' },
    { wordId: 'notebook', english: 'This is my notebook.' },
    { wordId: 'homework', english: 'I do my homework.' },
    { wordId: 'test', english: 'I take a test.' },
    { wordId: 'question', english: 'I have a question.' },

    // Level 3 · objects and transport
    { wordId: 'bag', english: 'My book is in the bag.' },
    { wordId: 'box', english: 'The ball is in the box.' },
    { wordId: 'door', english: 'Open the door, please.' },
    { wordId: 'window', english: 'Look out the window.' },
    { wordId: 'clock', english: 'The clock is on the wall.' },
    { wordId: 'phone', english: 'I use my phone.' },
    { wordId: 'car', english: 'I ride in a car.' },
    { wordId: 'bus', english: 'I ride the bus.' },
    { wordId: 'train', english: 'I see a train.' },
    { wordId: 'bike', english: 'I ride my bike.' },

    // Level 3 · verbs
    { wordId: 'go', english: 'I go to school.' },
    { wordId: 'come', english: 'Come to my home.' },
    { wordId: 'run', english: 'I can run fast.' },
    { wordId: 'walk', english: 'I walk to school.' },
    { wordId: 'stop', english: 'Please stop at the door.' },
    { wordId: 'sit', english: 'I sit on a chair.' },
    { wordId: 'stand', english: 'I stand by the door.' },
    { wordId: 'sleep', english: 'I sleep at home.' },
    { wordId: 'wake', english: 'I wake up early.' },
    { wordId: 'get', english: 'I get a new book.' },
    { wordId: 'put', english: 'Put the pen in the bag.' },
    { wordId: 'take', english: 'I take a bus.' },
    { wordId: 'give', english: 'I give my friend a book.' },
    { wordId: 'make', english: 'I make a paper plane.' },
    { wordId: 'do', english: 'I do my homework.' },
    { wordId: 'use', english: 'I use a pencil.' },
    { wordId: 'play', english: 'I play in the park.' },
    { wordId: 'work', english: 'I work at school.' },
    { wordId: 'study', english: 'I study at home.' },
    { wordId: 'read', english: 'I read a book.' },
    { wordId: 'write', english: 'I write in my notebook.' },
    { wordId: 'speak', english: 'I speak to my teacher.' },
    { wordId: 'say', english: 'I say hello.' },
    { wordId: 'tell', english: 'I tell my friend.' },
    { wordId: 'ask', english: 'I ask a question.' },
    { wordId: 'answer', english: 'I answer the question.' },
    { wordId: 'listen', english: 'I listen to my teacher.' },
    { wordId: 'watch', english: 'I watch the bird.' },
    { wordId: 'help', english: 'I help my family.' },
    { wordId: 'learn', english: 'I learn at school.' },
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
