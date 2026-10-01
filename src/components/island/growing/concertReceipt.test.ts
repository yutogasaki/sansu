import { expect, it } from 'vitest';
import { ownConcertReceipt } from './concertReceipt';

it('keeps a delayed visiting-island frame out of the owner record even after returning home', () => {
    const visitingConcert = { ownerId: 'sibling', n: 10, targetId: 'l1' };
    expect(ownConcertReceipt('own', true, 10, visitingConcert)).toBeUndefined();
    expect(ownConcertReceipt('own', false, 10, visitingConcert)).toBeUndefined();
});

it('accepts only the current owner concert frame while the owner island is visible', () => {
    const concert = { ownerId: 'own', n: 10, targetId: 'l1' };
    expect(ownConcertReceipt('own', false, 10, concert)).toBe('l1');
    expect(ownConcertReceipt('own', true, 10, concert)).toBeUndefined();
    expect(ownConcertReceipt('own', false, 9, concert)).toBeUndefined();
    expect(ownConcertReceipt('other', false, 10, concert)).toBeUndefined();
    expect(ownConcertReceipt('own', false, 10)).toBeUndefined();
});
