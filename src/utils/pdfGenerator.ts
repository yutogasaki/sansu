import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Problem } from '../domain/types';

export const generateMathPDF = async (problems: Problem[], title: string, _userName: string = "") => {
    // 1. Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // 2. Register fontkit
    pdfDoc.registerFontkit(fontkit);

    // 3. Fetch Japanese Font (Noto Sans JP)
    // Using a CDN to avoid bundling a large font file.
    // Ensure the user has internet access for the first time or cache it.
    const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8_1v47P06X.woff2';
    const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());
    const customFont = await pdfDoc.embedFont(fontBytes);

    // 4. Add a page
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // 5. Draw Header
    const fontSizeTitle = 24;

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

    // 6. Draw Problems (2 Columns)
    const startY = height - 120;
    const col1X = 50;
    const col2X = width / 2 + 30;
    const rowHeight = 60; // Space per problem

    problems.forEach((prob, idx) => {
        const isLeftCol = idx % 2 === 0;
        const row = Math.floor(idx / 2);

        const x = isLeftCol ? col1X : col2X;
        const y = startY - (row * rowHeight);

        // Problem Number
        page.drawText(`(${idx + 1})`, {
            x: x,
            y: y,
            size: 14,
            font: customFont,
            color: rgb(0.3, 0.3, 0.3),
        });

        // Question Text
        // Convert "10 / 3" to "10 ÷ 3" etc if needed, but MathRenderer logic is complex.
        // For PDF, we use the simple text representation or transform basic symbols.
        let qText = prob.questionText || "";
        qText = qText.replace(/\//g, '÷').replace(/\*/g, '×');

        // Handle Fractions (Simple visual fallback for text)
        // Ideally we would draw lines for fractions, but for v1 we use "1/2" style or text

        page.drawText(qText + " =", {
            x: x + 40,
            y: y,
            size: 20,
            font: customFont,
            color: rgb(0, 0, 0),
        });
    });

    // 7. Serialize and Download
    const pdfBytes = await pdfDoc.save();

    // Trigger download
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.pdf`;
    link.click();
};
