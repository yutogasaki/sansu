import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Problem } from '../domain/types';

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

/**
 * Parse a math expression and extract fractions
 * e.g., "1/2 + 3/4 =" -> [fraction(1,2), text(" + "), fraction(3,4), text(" =")]
 */
const parseExpression = (text: string): ExpressionPart[] => {
    const parts: ExpressionPart[] = [];

    // Regex to match fractions like "1/2", "12/34", etc.
    const fractionRegex = /(\d+)\/(\d+)/g;

    let lastIndex = 0;
    let match;

    while ((match = fractionRegex.exec(text)) !== null) {
        // Add text before the fraction
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            if (beforeText.trim()) {
                parts.push({ type: 'text', text: beforeText });
            }
        }

        // Add the fraction
        parts.push({
            type: 'fraction',
            numerator: match[1],
            denominator: match[2]
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        const remainingText = text.slice(lastIndex);
        if (remainingText.trim()) {
            parts.push({ type: 'text', text: remainingText });
        }
    }

    // If no fractions found, return as single text
    if (parts.length === 0) {
        return [{ type: 'text', text }];
    }

    return parts;
};

/**
 * Check if a problem involves fractions
 */
const isFractionProblem = (categoryId: string): boolean => {
    return categoryId.startsWith('frac_');
};

// ============================================================
// Drawing Helpers
// ============================================================

/**
 * Draw a proper fraction with horizontal line
 */
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

    // Measure text widths
    const numWidth = font.widthOfTextAtSize(numerator, smallFontSize);
    const denWidth = font.widthOfTextAtSize(denominator, smallFontSize);
    const maxWidth = Math.max(numWidth, denWidth);

    // Calculate positions
    const lineWidth = maxWidth + 8;
    const centerX = x + lineWidth / 2;

    // Draw numerator (centered above line)
    page.drawText(numerator, {
        x: centerX - numWidth / 2,
        y: y + lineHeight / 2 + 4,
        size: smallFontSize,
        font: font,
        color: rgb(0, 0, 0),
    });

    // Draw fraction line
    page.drawLine({
        start: { x: x, y: y },
        end: { x: x + lineWidth, y: y },
        thickness: 1.5,
        color: rgb(0, 0, 0),
    });

    // Draw denominator (centered below line)
    page.drawText(denominator, {
        x: centerX - denWidth / 2,
        y: y - lineHeight / 2 - smallFontSize + 2,
        size: smallFontSize,
        font: font,
        color: rgb(0, 0, 0),
    });

    // Return total width used
    return lineWidth + 4;
};

/**
 * Draw a complete math expression with proper fraction rendering
 */
const drawMathExpression = (
    page: PDFPage,
    font: PDFFont,
    text: string,
    categoryId: string,
    startX: number,
    y: number,
    fontSize: number
): void => {
    // Check if this is a fraction problem
    if (!isFractionProblem(categoryId)) {
        // Regular text - just replace symbols
        let displayText = text.replace(/\//g, '÷').replace(/\*/g, '×');
        page.drawText(displayText, {
            x: startX,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
        return;
    }

    // Parse and draw expression with fractions
    const parts = parseExpression(text);
    let currentX = startX;

    for (const part of parts) {
        if (part.type === 'fraction') {
            const width = drawFraction(
                page,
                font,
                part.numerator,
                part.denominator,
                currentX,
                y,
                fontSize
            );
            currentX += width;
        } else {
            // Draw regular text, replacing operators
            let displayText = part.text
                .replace(/\*/g, '×')
                .replace(/\+/g, ' + ')
                .replace(/-/g, ' − ')
                .replace(/=/g, ' = ')
                .trim();

            // Add spacing around operators
            displayText = ' ' + displayText + ' ';

            page.drawText(displayText, {
                x: currentX,
                y: y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });

            currentX += font.widthOfTextAtSize(displayText, fontSize);
        }
    }
};

// ============================================================
// Main PDF Generator
// ============================================================

export const generateMathPDF = async (
    problems: Problem[],
    title: string,
    _userName: string = ""
) => {
    // 1. Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // 2. Register fontkit
    pdfDoc.registerFontkit(fontkit);

    // 3. Fetch Japanese Font (Noto Sans JP)
    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8_1v47P06X.woff2';
    const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());
    const customFont = await pdfDoc.embedFont(fontBytes);

    // 4. Add pages as needed
    const problemsPerPage = 12;
    const totalPages = Math.ceil(problems.length / problemsPerPage);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();

        // 5. Draw Header (first page only has title)
        const fontSizeTitle = 24;

        if (pageNum === 0) {
            page.drawText(title, {
                x: 50,
                y: height - 60,
                size: fontSizeTitle,
                font: customFont,
                color: rgb(0, 0, 0),
            });

            // Name Box
            page.drawText('なまえ：', {
                x: width - 250,
                y: height - 60,
                size: 14,
                font: customFont,
            });

            // Draw underline for name
            page.drawLine({
                start: { x: width - 200, y: height - 62 },
                end: { x: width - 50, y: height - 62 },
                thickness: 1,
                color: rgb(0, 0, 0),
            });
        } else {
            // Page number for subsequent pages
            page.drawText(`${title} (${pageNum + 1}/${totalPages})`, {
                x: 50,
                y: height - 50,
                size: 16,
                font: customFont,
                color: rgb(0.3, 0.3, 0.3),
            });
        }

        // 6. Draw Problems (2 Columns)
        const startY = pageNum === 0 ? height - 120 : height - 80;
        const col1X = 50;
        const col2X = width / 2 + 30;
        const rowHeight = 70; // Increased for fractions

        const startIdx = pageNum * problemsPerPage;
        const endIdx = Math.min(startIdx + problemsPerPage, problems.length);
        const pageProblems = problems.slice(startIdx, endIdx);

        pageProblems.forEach((prob, idx) => {
            const isLeftCol = idx % 2 === 0;
            const row = Math.floor(idx / 2);

            const x = isLeftCol ? col1X : col2X;
            const y = startY - (row * rowHeight);

            // Problem Number
            const problemNumber = startIdx + idx + 1;
            page.drawText(`(${problemNumber})`, {
                x: x,
                y: y,
                size: 14,
                font: customFont,
                color: rgb(0.3, 0.3, 0.3),
            });

            // Question Text with proper fraction rendering
            const qText = prob.questionText || "";

            drawMathExpression(
                page,
                customFont,
                qText,
                prob.categoryId,
                x + 40,
                y,
                20
            );

            // Draw answer box for fractions
            if (isFractionProblem(prob.categoryId)) {
                const answerBoxX = x + 180;

                // Draw empty fraction answer box
                // Numerator box
                page.drawRectangle({
                    x: answerBoxX,
                    y: y + 8,
                    width: 30,
                    height: 20,
                    borderColor: rgb(0.7, 0.7, 0.7),
                    borderWidth: 1,
                });

                // Fraction line
                page.drawLine({
                    start: { x: answerBoxX - 2, y: y },
                    end: { x: answerBoxX + 34, y: y },
                    thickness: 1.5,
                    color: rgb(0, 0, 0),
                });

                // Denominator box
                page.drawRectangle({
                    x: answerBoxX,
                    y: y - 28,
                    width: 30,
                    height: 20,
                    borderColor: rgb(0.7, 0.7, 0.7),
                    borderWidth: 1,
                });
            } else {
                // Regular answer underline
                const answerStartX = x + 160;
                page.drawLine({
                    start: { x: answerStartX, y: y - 2 },
                    end: { x: answerStartX + 60, y: y - 2 },
                    thickness: 1,
                    color: rgb(0.5, 0.5, 0.5),
                });
            }
        });
    }

    // 7. Serialize and Download
    const pdfBytes = await pdfDoc.save();

    // Trigger download
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.pdf`;
    link.click();
};

/**
 * Generate a PDF with answer key
 */
export const generateMathPDFWithAnswers = async (
    problems: Problem[],
    title: string
) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8_1v47P06X.woff2';
    const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());
    const customFont = await pdfDoc.embedFont(fontBytes);

    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // Title
    page.drawText(`${title} - こたえ`, {
        x: 50,
        y: height - 60,
        size: 24,
        font: customFont,
        color: rgb(0, 0, 0),
    });

    // Answers in columns
    const startY = height - 120;
    const col1X = 50;
    const col2X = width / 2 + 30;
    const rowHeight = 30;

    problems.forEach((prob, idx) => {
        const isLeftCol = idx % 2 === 0;
        const row = Math.floor(idx / 2);

        const x = isLeftCol ? col1X : col2X;
        const y = startY - (row * rowHeight);

        // Format answer
        let answerText: string;
        if (Array.isArray(prob.correctAnswer)) {
            // Fraction answer
            answerText = `${prob.correctAnswer[0]}/${prob.correctAnswer[1]}`;
        } else {
            answerText = prob.correctAnswer;
        }

        page.drawText(`(${idx + 1}) ${answerText}`, {
            x: x,
            y: y,
            size: 14,
            font: customFont,
            color: rgb(0, 0, 0),
        });
    });

    const pdfBytes = await pdfDoc.save();

    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}_こたえ.pdf`;
    link.click();
};
