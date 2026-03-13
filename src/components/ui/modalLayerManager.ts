type BodyStyleTarget = {
    overflow: string;
};

let modalLayerDepth = 0;
let previousBodyOverflow = "";
let modalLayerStack: symbol[] = [];

export const pushModalLayer = (bodyStyle: BodyStyleTarget): symbol => {
    const token = Symbol("modal-layer");

    if (modalLayerDepth === 0) {
        previousBodyOverflow = bodyStyle.overflow;
        bodyStyle.overflow = "hidden";
    }

    modalLayerDepth += 1;
    modalLayerStack.push(token);
    return token;
};

export const popModalLayer = (token: symbol, bodyStyle: BodyStyleTarget): void => {
    const stackIndex = modalLayerStack.lastIndexOf(token);
    if (stackIndex !== -1) {
        modalLayerStack.splice(stackIndex, 1);
    }

    if (modalLayerDepth === 0) {
        return;
    }

    modalLayerDepth -= 1;

    if (modalLayerDepth === 0) {
        bodyStyle.overflow = previousBodyOverflow;
        previousBodyOverflow = "";
    }
};

export const isTopModalLayer = (token: symbol): boolean =>
    modalLayerStack[modalLayerStack.length - 1] === token;

export const resetModalLayerManagerForTests = (): void => {
    modalLayerDepth = 0;
    previousBodyOverflow = "";
    modalLayerStack = [];
};
