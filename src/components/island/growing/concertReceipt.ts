/** A rendered frame belongs to the island where the concert was started. */
export function ownConcertReceipt(profileId: string, visiting: boolean, receipt: number,
    concert?: { ownerId: string; n: number; targetId: string }) {
    return !visiting && concert?.ownerId === profileId && concert.n === receipt ? concert.targetId : undefined;
}
