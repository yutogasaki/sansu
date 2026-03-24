import { PDFDocument, rgb, PDFPage, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { Problem } from '../domain/types';
import { EnglishWord } from '../domain/english/words';
import { buildPrintableMathAnswer, buildPrintableMathPrompt, toPrintablePaperText } from '../domain/test/printability';
import { resolveAppAssetPath } from './assets';
import { errorInDev } from './debug';

// ============================================================
// Types
// ============================================================

interface FractionPart {
    type: 'fraction';
    numerator: string;
    denominator: string;
}

interface TextPart {
    type: 'text';
    text: string;
}

type ExpressionPart = FractionPart | TextPart;
type TextMeasurer = Pick<PDFFont, "widthOfTextAtSize">;
interface MathPageLayout {
    startIndex: number;
    problems: Problem[];
    rowHeights: number[];
}
const LOCAL_JP_FONT_URL = resolveAppAssetPath('/fonts/NotoSansJP-Regular.otf');

// ============================================================
// Fraction Parsing
// ============================================================

const parseExpression = (text: string): ExpressionPart[] => {
    const parts: ExpressionPart[] = [];
    const fractionRegex = /(\d+)\/(\d+)/g;
    let lastIndex = 0;
    let match;

    while ((match = fractionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            if (beforeText.trim()) parts.push({ type: 'text', text: beforeText });
        }
        parts.push({
            type: 'fraction',
            numerator: match[1],
            denominator: match[2]
        });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        const remainingText = text.slice(lastIndex);
        if (remainingText.trim()) parts.push({ type: 'text', text: remainingText });
    }

    if (parts.length === 0) return [{ type: 'text', text }];
    return parts;
};

const isFractionProblem = (categoryId: string): boolean => {
    return categoryId.startsWith('frac_');
};

// ============================================================
// Drawing Helpers
// ============================================================

const drawFraction = (
    page: PDFPage,
    font: PDFFont,
    numerator: string,
    denominator: string,
    x: number,
    y: number,
    fontSize: number
): number => {
    const smallFontSize = fontSize * 0.7;
    const lineHeight = fontSize * 0.6;
    const numWidth = font.widthOfTextAtSize(numerator, smallFontSize);
    const denWidth = font.widthOfTextAtSize(denominator, smallFontSize);
    const maxWidth = Math.max(numWidth, denWidth);
    const lineWidth = maxWidth + 8;
    const centerX = x + lineWidth / 2;

    page.drawText(numerator, {
        x: centerX - numWidth / 2, y: y + lineHeight / 2 + 4,
        size: smallFontSize, font, color: rgb(0, 0, 0),
    });
    page.drawLine({
        start: { x, y }, end: { x: x + lineWidth, y },
        thickness: 1.5, color: rgb(0, 0, 0),
    });
    page.drawText(denominator, {
        x: centerX - denWidth / 2, y: y - lineHeight / 2 - smallFontSize + 2,
        size: smallFontSize, font, color: rgb(0, 0, 0),
    });

    return lineWidth + 4;
};

const sanitizeForPdf = (text: string): string => {
    return toPrintablePaperText(text).trimEnd();
};

const getChoiceCount = (problem: Pick<Problem, "inputType" | "inputConfig">): number =>
    problem.inputType === "choice" ? problem.inputConfig?.choices?.length ?? 0 : 0;

export const getChoiceAnswerLayout = (choiceCount: number, answerWidth = 60) => {
    const gap = choiceCount >= 4 ? 4 : 6;
    const computedBoxSize = Math.floor((answerWidth - gap * Math.max(0, choiceCount - 1)) / Math.max(choiceCount, 1));
    const boxSize = Math.max(10, Math.min(16, computedBoxSize));
    const totalWidth = choiceCount * boxSize + Math.max(0, choiceCount - 1) * gap;
    const startOffset = Math.max(0, (answerWidth - totalWidth) / 2);
    const labelSize = Math.max(8, Math.min(11, boxSize - 2));

    return {
        boxSize,
        gap,
        totalWidth,
        startOffset,
        labelSize,
    };
};

const getMathQuestionFontSize = (problem: Pick<Problem, "questionVisual">): number =>
    problem.questionVisual ? 12 : 14;

export const wrapPdfLines = (
    text: string,
    measurer: TextMeasurer,
    fontSize: number,
    maxWidth: number
): string[] => {
    const wrapped: string[] = [];
    const paragraphs = sanitizeForPdf(text).split("\n");

    paragraphs.forEach(paragraph => {
        if (!paragraph) {
            wrapped.push("");
            return;
        }

        let currentLine = "";
        for (const char of paragraph) {
            const next = `${currentLine}${char}`;
            const nextWidth = measurer.widthOfTextAtSize(next, fontSize);

            if (currentLine && nextWidth > maxWidth) {
                wrapped.push(currentLine);
                currentLine = char;
                continue;
            }

            currentLine = next;
        }

        if (currentLine) {
            wrapped.push(currentLine);
        }
    });

    return wrapped.length > 0 ? wrapped : [""];
};

const getWrappedMathQuestionLines = (
    problem: Pick<Problem, "categoryId" | "questionText" | "questionVisual" | "inputType" | "inputConfig">,
    measurer: TextMeasurer,
    questionWidth: number
): string[] => {
    const qText = buildPrintableMathPrompt(problem);
    const questionFontSize = getMathQuestionFontSize(problem);

    if (isFractionProblem(problem.categoryId)) {
        return [sanitizeForPdf(qText)];
    }

    return wrapPdfLines(qText, measurer, questionFontSize, questionWidth);
};

export const estimateMathProblemHeight = (
    problem: Pick<Problem, "categoryId" | "questionText" | "questionVisual" | "inputType" | "inputConfig">,
    measurer: TextMeasurer,
    questionWidth: number
): number => {
    const questionFontSize = getMathQuestionFontSize(problem);
    const lineCount = getWrappedMathQuestionLines(problem, measurer, questionWidth).length;
    const questionHeight = lineCount * (questionFontSize + 2);
    const choiceCount = getChoiceCount(problem);
    const answerHeight = choiceCount >= 2 && choiceCount <= 4
        ? getChoiceAnswerLayout(choiceCount).boxSize + 6
        : 18;

    return Math.max(questionHeight, answerHeight) + 16;
};

export const paginateMathProblems = (
    problems: Problem[],
    measurer: TextMeasurer,
    pageHeight: number
): MathPageLayout[] => {
    const col1X = 50;
    const answerX = col1X + 180;
    const questionWidth = answerX - (col1X + 30) - 10;
    const firstPageStartY = pageHeight - 120;
    const laterPageStartY = pageHeight - 80;
    const bottomMargin = 60;

    const layouts: MathPageLayout[] = [];
    let pageIndex = 0;
    let problemIndex = 0;

    while (problemIndex < problems.length) {
        const startIndex = problemIndex;
        const availableHeight = (pageIndex === 0 ? firstPageStartY : laterPageStartY) - bottomMargin;
        const pageProblems: Problem[] = [];
        const rowHeights: number[] = [];
        let usedHeight = 0;

        while (problemIndex < problems.length) {
            const rowProblems = problems.slice(problemIndex, Math.min(problemIndex + 2, problems.length));
            const rowHeight = Math.max(...rowProblems.map(problem =>
                estimateMathProblemHeight(problem, measurer, questionWidth)
            ));

            if (rowHeights.length > 0 && usedHeight + rowHeight > availableHeight) {
                break;
            }

            rowHeights.push(rowHeight);
            pageProblems.push(...rowProblems);
            usedHeight += rowHeight;
            problemIndex += rowProblems.length;
        }

        layouts.push({ startIndex, problems: pageProblems, rowHeights });
        pageIndex += 1;
    }

    return layouts;
};

const drawMathExpression = (
    page: PDFPage,
    font: PDFFont,
    text: string,
    categoryId: string,
    startX: number,
    y: number,
    fontSize: number,
    maxWidth?: number
): number => {
    if (!isFractionProblem(categoryId)) {
        const lines = wrapPdfLines(text, font, fontSize, maxWidth ?? 9999);
        lines.forEach((line, index) => {
            page.drawText(line, {
                x: startX,
                y: y - index * (fontSize + 2),
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });
        });
        return lines.length;
    }

    const parts = parseExpression(text);
    let currentX = startX;

    for (const part of parts) {
        if (part.type === 'fraction') {
            const width = drawFraction(page, font, part.numerator, part.denominator, currentX, y, fontSize);
            currentX += width;
        } else {
            let displayText = sanitizeForPdf(part.text)
                .replace(/\*/g, '×').replace(/\+/g, ' + ').replace(/-/g, ' − ').replace(/=/g, ' = ').trim();
            displayText = ' ' + displayText + ' ';
            page.drawText(displayText, { x: currentX, y, size: fontSize, font, color: rgb(0, 0, 0) });
            currentX += font.widthOfTextAtSize(displayText, fontSize);
        }
    }

    return 1;
};

const drawChoiceAnswerArea = (
    page: PDFPage,
    font: PDFFont,
    choiceCount: number,
    x: number,
    y: number,
    isAnswerKey: boolean,
    correctAnswer: string
) => {
    const { boxSize, gap, startOffset, labelSize } = getChoiceAnswerLayout(choiceCount);
    const startX = x + startOffset;

    Array.from({ length: choiceCount }, (_, index) => index + 1).forEach(choiceNumber => {
        const boxX = startX + (choiceNumber - 1) * (boxSize + gap);
        const isCorrect = isAnswerKey && String(choiceNumber) === correctAnswer;
        page.drawRectangle({
            x: boxX,
            y: y - boxSize + 2,
            width: boxSize,
            height: boxSize,
            borderWidth: 1,
            borderColor: isCorrect ? rgb(1, 0, 0) : rgb(0.5, 0.5, 0.5),
            color: rgb(1, 1, 1),
        });

        const label = String(choiceNumber);
        const textWidth = font.widthOfTextAtSize(label, labelSize);
        page.drawText(label, {
            x: boxX + (boxSize - textWidth) / 2,
            y: y - boxSize / 2 - 2,
            size: labelSize,
            font,
            color: isCorrect ? rgb(1, 0, 0) : rgb(0.35, 0.35, 0.35),
        });
    });
};

const downloadPdf = async (pdfDoc: PDFDocument, filename: string) => {
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    try {
        type SaveFilePickerWindow = Window & {
            showSaveFilePicker?: (options: {
                suggestedName: string;
                types: Array<{ description: string; accept: Record<string, string[]> }>;
            }) => Promise<{
                createWritable: () => Promise<{
                    write: (data: Blob) => Promise<void>;
                    close: () => Promise<void>;
                }>;
            }>;
        };
        const pickerWindow = window as SaveFilePickerWindow;
        if ('showSaveFilePicker' in window) {
            const handle = await pickerWindow.showSaveFilePicker?.({
                suggestedName: filename,
                types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
            });
            if (!handle) return;
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }
    } catch {
        // Fallback to blob URL download when file picker is unavailable or denied.
    }
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

const loadPdfFont = async (pdfDoc: PDFDocument): Promise<PDFFont> => {
    try {
        const fontResponse = await fetch(LOCAL_JP_FONT_URL);
        if (!fontResponse.ok) throw new Error(`Font fetch failed: ${fontResponse.status}`);
        const fontBytes = await fontResponse.arrayBuffer();
        return await pdfDoc.embedFont(fontBytes);
    } catch (e) {
        errorInDev("Font load error:", e);
        return await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
};

// ============================================================
// Main Generators
// ============================================================

export const generateMathPDF = async (
    problems: Problem[],
    title: string,
    userName: string = ""
) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`${title}.pdf`);
    pdfDoc.setAuthor('Sansu App');
    pdfDoc.setCreator('Sansu App');
    if (userName) {
        pdfDoc.setSubject(`User: ${userName}`);
    }
    pdfDoc.registerFontkit(fontkit);

    const customFont = await loadPdfFont(pdfDoc);

    const probePage = pdfDoc.addPage();
    const { height } = probePage.getSize();
    pdfDoc.removePage(pdfDoc.getPageCount() - 1);
    const pageLayouts = paginateMathProblems(problems, customFont, height);
    const totalPages = pageLayouts.length;

    // Phase 1: Test Pages
    pageLayouts.forEach((layout, pageNum) => {
        drawMathPage(pdfDoc, customFont, layout, pageNum, totalPages, title, false);
    });
    // Phase 2: Answer Keys
    pageLayouts.forEach((layout, pageNum) => {
        drawMathPage(pdfDoc, customFont, layout, pageNum, totalPages, title, true);
    });

    await downloadPdf(pdfDoc, `${title}.pdf`);
};

const drawMathPage = (
    pdfDoc: PDFDocument,
    font: PDFFont,
    layout: MathPageLayout,
    pageNum: number,
    totalPages: number,
    title: string,
    isAnswerKey: boolean
) => {
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const pageSizeCategory = isAnswerKey ? "（こたえ）" : "";

    const displayTitle = pageNum === 0 ? `${title} ${pageSizeCategory}` : `${title} ${pageSizeCategory} (${pageNum + 1}/${totalPages})`;
    page.drawText(displayTitle, {
        x: 50, y: height - 60, size: pageNum === 0 ? 24 : 16, font: font, color: rgb(0, 0, 0),
    });

    if (!isAnswerKey && pageNum === 0) {
        page.drawText('なまえ：', { x: width - 250, y: height - 60, size: 14, font: font });
        page.drawLine({ start: { x: width - 200, y: height - 62 }, end: { x: width - 50, y: height - 62 }, thickness: 1, color: rgb(0, 0, 0) });
    }

    const startY = pageNum === 0 ? height - 120 : height - 80;
    const col1X = 50;
    const col2X = width / 2 + 30;
    let currentY = startY;

    layout.rowHeights.forEach((rowHeight, rowIndex) => {
        const rowProblems = layout.problems.slice(rowIndex * 2, rowIndex * 2 + 2);

        rowProblems.forEach((prob, idx) => {
            const isLeftCol = idx === 0;
            const x = isLeftCol ? col1X : col2X;
            const y = currentY;

            // Problem Number
            page.drawText(`(${layout.startIndex + rowIndex * 2 + idx + 1})`, { x, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });

            // Question (Left Area)
            const qText = buildPrintableMathPrompt(prob);
            const questionFontSize = getMathQuestionFontSize(prob);
            const answerX = x + 180;
            const answerWidth = 60;
            const questionWidth = answerX - (x + 30) - 10;
            drawMathExpression(page, font, qText, prob.categoryId, x + 30, y, questionFontSize, questionWidth);

            const choiceCount = getChoiceCount(prob);
            const paperAnswerText = buildPrintableMathAnswer(prob);

            if (choiceCount >= 2 && choiceCount <= 4) {
                drawChoiceAnswerArea(page, font, choiceCount, answerX, y, isAnswerKey, paperAnswerText);
            } else {
                // Answer Line (Right Area) - Fixed position to avoid overlap
                page.drawLine({
                    start: { x: answerX, y: y - 2 },
                    end: { x: answerX + answerWidth, y: y - 2 },
                    thickness: 1, color: rgb(0.5, 0.5, 0.5),
                });
            }

            // Answer (Red)
            if (isAnswerKey && (choiceCount < 2 || choiceCount > 4)) {
                const answerText = sanitizeForPdf(paperAnswerText);
                // Draw centered
                const textWidth = font.widthOfTextAtSize(answerText, 14);
                const offset = (answerWidth - textWidth) / 2;
                page.drawText(answerText, {
                    x: answerX + offset, y: y, size: 14, font, color: rgb(1, 0, 0),
                });
            }
        });

        currentY -= rowHeight;
    });
};

export const generateVocabPDF = async (
    words: EnglishWord[],
    title: string
) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`${title}.pdf`);
    pdfDoc.setAuthor('Sansu App');
    pdfDoc.setCreator('Sansu App');
    pdfDoc.registerFontkit(fontkit);

    const customFont = await loadPdfFont(pdfDoc);

    // 20 items per page (2 columns x 10 rows)
    const itemsPerPage = 20;
    const totalPages = Math.ceil(words.length / itemsPerPage);

    // Phase 1: Tests
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        drawVocabPage(pdfDoc, customFont, words, pageNum, itemsPerPage, totalPages, title, false);
    }
    // Phase 2: Keys
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        drawVocabPage(pdfDoc, customFont, words, pageNum, itemsPerPage, totalPages, title, true);
    }

    await downloadPdf(pdfDoc, `${title}.pdf`);
};

const drawVocabPage = (
    pdfDoc: PDFDocument,
    font: PDFFont,
    allWords: EnglishWord[],
    pageNum: number,
    perPage: number,
    totalPages: number,
    title: string,
    isAnswerKey: boolean
) => {
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const pageSizeCategory = isAnswerKey ? "（こたえ）" : "";

    const displayTitle = pageNum === 0 ? `${title} ${pageSizeCategory}` : `${title} ${pageSizeCategory} (${pageNum + 1}/${totalPages})`;
    page.drawText(displayTitle, {
        x: 50, y: height - 60, size: pageNum === 0 ? 24 : 16, font, color: rgb(0, 0, 0),
    });

    if (!isAnswerKey && pageNum === 0) {
        page.drawText('なまえ：', { x: width - 250, y: height - 60, size: 14, font });
        page.drawLine({ start: { x: width - 200, y: height - 62 }, end: { x: width - 50, y: height - 62 }, thickness: 1, color: rgb(0, 0, 0) });
    }

    const startY = pageNum === 0 ? height - 120 : height - 80;
    const col1X = 50;
    const col2X = width / 2 + 30;
    const rowHeight = 60;

    const startIdx = pageNum * perPage;
    const endIdx = Math.min(startIdx + perPage, allWords.length);
    const pageWords = allWords.slice(startIdx, endIdx);

    pageWords.forEach((word, idx) => {
        const isLeftCol = idx % 2 === 0;
        const colX = isLeftCol ? col1X : col2X;
        const row = Math.floor(idx / 2);
        const y = startY - (row * rowHeight);

        // Number
        page.drawText(`(${startIdx + idx + 1})`, { x: colX, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });

        // Question: English (Large) - Layout Adjusted: Space
        const qText = word.id;
        page.drawText(qText, { x: colX + 35, y, size: 18, font, color: rgb(0, 0, 0) });

        // Answer Line (Right aligned) - Adjusted 170 -> 130 to be closer
        const lineStartX = colX + 130;
        const lineY = y - 5;
        const lineWidth = 130; // 110 -> 130 wider
        page.drawLine({
            start: { x: lineStartX, y: lineY },
            end: { x: lineStartX + lineWidth, y: lineY },
            thickness: 1, color: rgb(0.7, 0.7, 0.7),
        });

        // Answer Key: Japanese
        if (isAnswerKey) {
            // Draw Japanese above line (Reduced size 14 -> 12 to prevent overflow)
            page.drawText(word.japanese, {
                x: lineStartX + 5,
                y: lineY + 5,
                size: 12,
                font,
                color: rgb(1, 0, 0),
            });
        }
    });
};
