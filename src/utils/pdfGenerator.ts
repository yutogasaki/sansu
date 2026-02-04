import { PDFDocument, rgb, PDFPage, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { Problem } from '../domain/types';
import { EnglishWord } from '../domain/english/words';

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
    return text.replace(/🍎/g, '●').replace(/□/g, '[   ]');
};

const drawMathExpression = (
    page: PDFPage,
    font: PDFFont,
    text: string,
    categoryId: string,
    startX: number,
    y: number,
    fontSize: number
): void => {
    if (!isFractionProblem(categoryId)) {
        let displayText = sanitizeForPdf(text).replace(/\//g, '÷').replace(/\*/g, '×');
        page.drawText(displayText, { x: startX, y, size: fontSize, font, color: rgb(0, 0, 0) });
        return;
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
};

const downloadPdf = async (pdfDoc: PDFDocument, filename: string) => {
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    try {
        if ('showSaveFilePicker' in window) {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }
    } catch { }
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

// ============================================================
// Main Generators
// ============================================================

export const generateMathPDF = async (
    problems: Problem[],
    title: string,
    _userName: string = ""
) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`${title}.pdf`);
    pdfDoc.setAuthor('Sansu App');
    pdfDoc.setCreator('Sansu App');
    pdfDoc.registerFontkit(fontkit);

    let customFont;
    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf';
    try {
        const fontResponse = await fetch(fontUrl);
        if (!fontResponse.ok) throw new Error(`Font fetch failed`);
        const fontBytes = await fontResponse.arrayBuffer();
        customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
        console.error("Font load error:", e);
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        alert("日本語フォントの読み込みに失敗しました。");
    }

    // 20 problems per page (2 columns x 10 rows)
    const problemsPerPage = 20;
    const totalPages = Math.ceil(problems.length / problemsPerPage);

    // Phase 1: Test Pages
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        drawMathPage(pdfDoc, customFont, problems, pageNum, problemsPerPage, totalPages, title, false);
    }
    // Phase 2: Answer Keys
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        drawMathPage(pdfDoc, customFont, problems, pageNum, problemsPerPage, totalPages, title, true);
    }

    await downloadPdf(pdfDoc, `${title}.pdf`);
};

const drawMathPage = (
    pdfDoc: PDFDocument,
    font: PDFFont,
    allProblems: Problem[],
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
        x: 50, y: height - 60, size: pageNum === 0 ? 24 : 16, font: font, color: rgb(0, 0, 0),
    });

    if (!isAnswerKey && pageNum === 0) {
        page.drawText('なまえ：', { x: width - 250, y: height - 60, size: 14, font: font });
        page.drawLine({ start: { x: width - 200, y: height - 62 }, end: { x: width - 50, y: height - 62 }, thickness: 1, color: rgb(0, 0, 0) });
    }

    const startY = pageNum === 0 ? height - 120 : height - 80;
    const col1X = 50;
    const col2X = width / 2 + 30;
    const rowHeight = 70;

    // Horizontal Layout
    const startIdx = pageNum * perPage;
    const endIdx = Math.min(startIdx + perPage, allProblems.length);
    const pageProblems = allProblems.slice(startIdx, endIdx);

    pageProblems.forEach((prob, idx) => {
        const isLeftCol = idx % 2 === 0;
        const row = Math.floor(idx / 2);
        const x = isLeftCol ? col1X : col2X;
        const y = startY - (row * rowHeight);

        // Problem Number
        page.drawText(`(${startIdx + idx + 1})`, { x, y, size: 12, font, color: rgb(0.3, 0.3, 0.3) });

        // Question (Left Area) - Reduced font size for Horizontal Mode
        const qText = prob.questionText || "";
        drawMathExpression(page, font, qText, prob.categoryId, x + 30, y, 18);

        // Answer Line (Right Area) - Fixed position to avoid overlap
        // Question area is x+30 to x+180 (150px)
        const answerX = x + 180;
        const answerWidth = 60;

        page.drawLine({
            start: { x: answerX, y: y - 2 },
            end: { x: answerX + answerWidth, y: y - 2 },
            thickness: 1, color: rgb(0.5, 0.5, 0.5),
        });

        // Answer (Red)
        if (isAnswerKey) {
            let answerText = Array.isArray(prob.correctAnswer) ? `${prob.correctAnswer[0]}/${prob.correctAnswer[1]}` : prob.correctAnswer;
            // Draw centered
            const textWidth = font.widthOfTextAtSize(answerText, 14);
            const offset = (answerWidth - textWidth) / 2;
            page.drawText(answerText, {
                x: answerX + offset, y: y, size: 14, font, color: rgb(1, 0, 0),
            });
        }
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

    let customFont;
    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf';
    try {
        const fontResponse = await fetch(fontUrl);
        if (!fontResponse.ok) throw new Error(`Font fetch failed`);
        const fontBytes = await fontResponse.arrayBuffer();
        customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
        console.error("Font load error:", e);
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        alert("日本語フォントの読み込みに失敗しました。");
    }

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
