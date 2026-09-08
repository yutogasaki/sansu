"""Rebuild Sansu's original, short SE with Python 3 + ffmpeg (no downloaded audio)."""
from array import array
from math import exp, pi, sin
from pathlib import Path
import subprocess
import tempfile
import wave

RATE = 44100
DESTINATION = Path(__file__).resolve().parents[1] / 'public' / 'sounds'


def render(name, duration, notes, peak=0.72):
    samples = [0.0] * round(duration * RATE)
    for start, frequency, length, gain, material in notes:
        for index in range(round(length * RATE)):
            target = round(start * RATE) + index
            if target >= len(samples):
                break
            t = index / RATE
            # Soft attack/release avoids clicks; inharmonic partials give a wooden touch.
            envelope = min(1, t / 0.004) * exp(-t / (length / 4)) * min(1, (length - t) / 0.015)
            fundamental = sin(2 * pi * frequency * t)
            partial = sin(2 * pi * frequency * (2.76 if material == 'wood' else 2) * t)
            samples[target] += gain * envelope * (fundamental + 0.22 * partial)
    scale = peak / max(max(abs(value) for value in samples), 0.001)
    pcm = array('h', (round(value * scale * 32767) for value in samples))
    with tempfile.TemporaryDirectory(prefix='sansu-se-') as temporary:
        source = Path(temporary) / 'sound.wav'
        with wave.open(str(source), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k',
                        str(DESTINATION / f'{name}.mp3')], check=True)


if __name__ == '__main__':
    DESTINATION.mkdir(parents=True, exist_ok=True)
    render('tap', 0.075, [(0, 740, 0.07, 1, 'wood')], peak=0.5)
    render('step', 0.2, [(0, 880, 0.18, 1, 'wood')])
    render('correct', 0.38, [(0, 783.99, 0.24, 1, 'bell'), (0.09, 1046.50, 0.28, 0.9, 'bell')])
    render('incorrect', 0.22, [(0, 392, 0.1, 1, 'wood'), (0.09, 349.23, 0.12, 0.65, 'wood')], peak=0.5)
    render('start', 0.38, [(0, 523.25, 0.18, 0.8, 'wood'), (0.09, 783.99, 0.27, 1, 'bell')])
    render('clear', 0.58, [(0, 523.25, 0.22, 0.8, 'bell'), (0.07, 659.25, 0.24, 0.8, 'bell'),
                           (0.14, 783.99, 0.28, 0.8, 'bell'), (0.22, 1046.50, 0.35, 1, 'bell')])
    render('level_up', 0.7, [(0, 523.25, 0.25, 0.7, 'bell'), (0.09, 659.25, 0.25, 0.7, 'bell'),
                              (0.18, 783.99, 0.25, 0.8, 'bell'), (0.3, 1046.50, 0.38, 1, 'bell')])
