export type LineBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextBlock = {
  lines: LineBox[];
};

function otsu(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let index = 0; index < 256; index += 1) sum += index * histogram[index];
  let backgroundSum = 0;
  let backgroundWeight = 0;
  let best = 0;
  let threshold = 127;
  for (let index = 0; index < 256; index += 1) {
    backgroundWeight += histogram[index];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += index * histogram[index];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const between = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (between > best) {
      best = between;
      threshold = index;
    }
  }
  return threshold;
}

export function scaleCanvas(source: CanvasImageSource, width: number, height: number, maxEdge = 1600): HTMLCanvasElement {
  const largest = Math.max(width, height);
  const scale = largest > maxEdge ? maxEdge / largest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no pudo preparar la imagen.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function rotateCanvas(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4;
  const canvas = document.createElement("canvas");
  canvas.width = turns % 2 === 0 ? source.width : source.height;
  canvas.height = turns % 2 === 0 ? source.height : source.width;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no pudo rotar la imagen.");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

export function enhanceCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no pudo mejorar la imagen.");
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const histogram = new Uint32Array(256);
  const gray = new Uint8Array((data.length / 4) | 0);
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const value = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    gray[pixel] = value;
    histogram[value] += 1;
  }
  const total = gray.length;
  let low = 0;
  let high = 255;
  let accumulated = 0;
  for (let index = 0; index < 256; index += 1) {
    accumulated += histogram[index];
    if (accumulated >= total * 0.02) {
      low = index;
      break;
    }
  }
  accumulated = 0;
  for (let index = 255; index >= 0; index -= 1) {
    accumulated += histogram[index];
    if (accumulated >= total * 0.02) {
      high = index;
      break;
    }
  }
  const span = Math.max(1, high - low);
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    const stretched = Math.min(255, Math.max(0, Math.round(((gray[pixel] - low) * 255) / span)));
    data[index] = stretched;
    data[index + 1] = stretched;
    data[index + 2] = stretched;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function detectBlocks(image: ImageData): TextBlock[] {
  const { width, height, data } = image;
  const histogram = new Uint32Array(256);
  const gray = new Uint8Array(width * height);
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    gray[pixel] = data[index];
    histogram[data[index]] += 1;
  }
  const threshold = otsu(histogram, width * height);
  const ink = new Uint8Array(width * height);
  const rowInk = new Uint32Array(height);
  let inkCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (gray[pixel] < threshold) {
        ink[pixel] = 1;
        rowInk[y] += 1;
        inkCount += 1;
      }
    }
  }
  if (inkCount < width * height * 0.002) return [];

  const minRowInk = Math.max(8, Math.round(width * 0.008));
  const bands: { start: number; end: number }[] = [];
  let start = -1;
  for (let y = 0; y < height; y += 1) {
    if (rowInk[y] >= minRowInk) {
      if (start < 0) start = y;
    } else if (start >= 0) {
      if (y - start >= 8) bands.push({ start, end: y - 1 });
      start = -1;
    }
  }
  if (start >= 0 && height - start >= 8) bands.push({ start, end: height - 1 });

  const merged: { start: number; end: number }[] = [];
  for (const band of bands) {
    const previous = merged[merged.length - 1];
    if (previous && band.start - previous.end <= 6) previous.end = band.end;
    else merged.push({ ...band });
  }

  const lines: LineBox[] = [];
  for (const band of merged) {
    if (band.end - band.start > 140) continue;
    let left = width;
    let right = 0;
    for (let y = band.start; y <= band.end; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (ink[y * width + x]) {
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    if (right - left < 40) continue;
    const pad = 6;
    lines.push({
      x: Math.max(0, left - pad),
      y: Math.max(0, band.start - pad),
      width: Math.min(width, right + pad) - Math.max(0, left - pad),
      height: Math.min(height, band.end + pad) - Math.max(0, band.start - pad),
    });
  }

  if (lines.length > 80) return [];

  const blocks: TextBlock[] = [];
  let group: LineBox[] = [];
  for (const line of lines) {
    const previous = group[group.length - 1];
    const gap = previous ? line.y - (previous.y + previous.height) : 0;
    if (previous && gap > Math.max(28, previous.height)) {
      blocks.push({ lines: group });
      group = [line];
    } else {
      group.push(line);
    }
  }
  if (group.length) blocks.push({ lines: group });
  return blocks;
}

/** Margen blanco y, si la franja es baja, ampliación para que Tesseract distinga las letras. */
export function prepareOcrCanvas(source: HTMLCanvasElement, minHeight = 96): HTMLCanvasElement {
  const scale = minHeight > 0 && source.height < minHeight ? minHeight / source.height : 1;
  const pad = 24;
  const drawnWidth = Math.max(1, Math.round(source.width * scale));
  const drawnHeight = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = drawnWidth + pad * 2;
  canvas.height = drawnHeight + pad * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no pudo preparar el recorte para leerlo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(source, pad, pad, drawnWidth, drawnHeight);
  return canvas;
}

export function cropCanvas(source: HTMLCanvasElement, box: LineBox): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width));
  canvas.height = Math.max(1, Math.round(box.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no pudo recortar la imagen.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
