/** Compose an explicitly requested local keepsake from the actual WebGL frame.
 * No profile, learning record, upload or persistent growth snapshot is involved. */
export async function downloadIslandPhoto(frame: string, name: string, isCurrent: () => boolean = () => true) {
    if (!frame.startsWith('data:image/png;base64,')) throw new Error('Island photo unavailable');
    const image = new Image();
    image.src = frame;
    await image.decode();
    if (!image.width || !image.height) throw new Error('Empty island frame');
    const canvas = document.createElement('canvas');
    const margin = Math.max(24, Math.round(image.width * .04));
    const footer = Math.max(76, Math.round(image.width * .14));
    canvas.width = image.width + margin * 2; canvas.height = image.height + margin * 2 + footer;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Island photo unavailable');
    context.fillStyle = '#fff5dc'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, margin, margin);
    context.fillStyle = '#263145'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = `700 ${Math.max(22, image.width * .05)}px "Noto Sans JP", sans-serif`;
    context.fillText(name, canvas.width / 2, margin + image.height + footer / 2, image.width);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Island photo unavailable');
    if (!isCurrent()) return;
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'わたしのしま.png'; document.body.append(link); link.click(); link.remove();
    // Keep the URL alive through browser download dispatch, then release it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
