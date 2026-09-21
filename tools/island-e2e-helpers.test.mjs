import { expect, it } from 'vitest';
import { appRootMetadata, completeIncorrectValues } from './island-e2e-helpers.mjs';

const appRootPage = dataset => ({
    locator: selector => {
        expect(selector).toBe('.app-container');
        return { evaluate: callback => callback({ dataset }) };
    },
});

it('records current app-root identity independently of route identity', async () => {
    await expect(appRootMetadata(appRootPage({
        buildRevision: 'e115e896',
        buildVersion: 'e115e896:runtime-id',
        configuredDeliveryId: 'snap-root-v1',
        visualLineageId: 'pokko-field-v1',
        islandFeatureEnabled: 'true',
        natureTownFeatureEnabled: 'false',
    }))).resolves.toEqual({
        revision: 'e115e896',
        version: 'e115e896:runtime-id',
        configuredDelivery: 'snap-root-v1',
        visualLineage: 'pokko-field-v1',
        islandFeatureEnabled: true,
        natureTownFeatureEnabled: false,
    });
});

it('keeps missing app-root flag markers unknown instead of treating them as disabled', async () => {
    await expect(appRootMetadata(appRootPage({}))).resolves.toEqual({
        revision: null,
        version: null,
        configuredDelivery: null,
        visualLineage: null,
        islandFeatureEnabled: null,
        natureTownFeatureEnabled: null,
    });
});

it('submits a complete wrong numerator while preserving the two-digit denominator', () => {
    expect(completeIncorrectValues([9, 11])).toEqual(['8', 11]);
    expect(completeIncorrectValues([10, 13])).toEqual(['11', 13]);
});

it('preserves the decimal places and every remaining written input field', () => {
    expect(completeIncorrectValues(['0.05'])).toEqual(['0.06']);
    expect(completeIncorrectValues([1, 0, 9])).toEqual(['2', 0, 9]);
});

it('retains the answer width when an automatic numeric field is changed', () => {
    expect(completeIncorrectValues([100])).toEqual(['101']);
    expect(completeIncorrectValues([99])).toEqual(['98']);
    expect(completeIncorrectValues([0])).toEqual(['1']);
});
