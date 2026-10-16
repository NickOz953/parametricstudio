(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tone-tools'));
  else root.PhotoRelief = factory(root.ToneTools);
})(globalThis, ToneTools => {
  'use strict';
  function prepare(cv, {image, count = 5, smooth = 2, background, subject}, progress = () => {}) {
    const {width: w, height: h, data} = image || {}, size = w * h;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 720 || h > 720 || data?.length !== size * 4) throw Error('Invalid photo size.');
    if (!Number.isInteger(count) || count < 2 || count > 12) throw Error('Choose 2 to 12 levels.');
    if (background && (background.length !== size || background.some(v => v !== 0 && v !== 1))) throw Error('Invalid subject mask.');
    const mats = [], own = mat => (mats.push(mat), mat);
    try {
      const rgba = own(cv.matFromArray(h, w, cv.CV_8UC4, data)), rgb = own(new cv.Mat());
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      if (subject) {
        progress('Separating subject', 15);
        const mask = own(new cv.Mat(h, w, cv.CV_8UC1)), bg = own(new cv.Mat()), fg = own(new cv.Mat());
        const box = subject.box, marks = subject.marks;
        if (box && (box.length !== 4 || box.some(v => !Number.isFinite(v) || v < 0 || v > 1) || box[2] <= box[0] || box[3] <= box[1])) throw Error('Draw a larger subject box.');
        if (marks && (marks.length !== size || marks.some(v => v > 2))) throw Error('Invalid subject marks.');
        let fgSamples = 0, bgSamples = 0;
        for (let i = 0; i < size; i++) {
          const x = (i % w + 0.5) / w, y = (Math.floor(i / w) + 0.5) / h;
          let value = background ? (background[i] ? cv.GC_PR_BGD : cv.GC_PR_FGD) : cv.GC_PR_BGD;
          if (box) value = x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] ? cv.GC_PR_FGD : cv.GC_BGD;
          if (marks?.[i] === 1) value = cv.GC_FGD;
          if (marks?.[i] === 2) value = cv.GC_BGD;
          mask.data[i] = value;
          if (value === cv.GC_FGD || value === cv.GC_PR_FGD) fgSamples++; else bgSamples++;
        }
        if (fgSamples < 5 || bgSamples < 5) throw Error('Mark both a subject and some background.');
        cv.setRNGSeed?.(17);
        cv.grabCut(rgb, mask, new cv.Rect(), bg, fg, 3, cv.GC_INIT_WITH_MASK);
        background = Uint8Array.from(mask.data, v => v === cv.GC_BGD || v === cv.GC_PR_BGD ? 1 : 0);
        if (background.every(v => v === 1) || background.every(v => v === 0)) throw Error('Subject not separated. Add subject and background marks, then try again.');
      }
      progress('Smoothing photo edges', 45);
      const filtered = own(new cv.Mat()), filteredAgain = own(new cv.Mat()), lab = own(new cv.Mat());
      // Two bilateral passes suppress photographic texture without blurring silhouettes.
      const strength = Math.max(0, Math.min(3, Number(smooth) || 0));
      cv.bilateralFilter(rgb, filtered, strength ? 9 : 5, 22 + strength * 15, 3 + strength * 2, cv.BORDER_REFLECT_101);
      cv.bilateralFilter(filtered, filteredAgain, strength ? 9 : 5, 22 + strength * 15, 3 + strength * 2, cv.BORDER_REFLECT_101);
      cv.cvtColor(filteredAgain, lab, cv.COLOR_RGB2Lab);
      progress('Allocating layer tones', 75);
      const hist = new Array(256).fill(0);
      for (let i = 0; i < size; i++) if (!background?.[i]) hist[lab.data[i * 3]]++;
      const slots = background ? count - 1 : count;
      const tones = slots === 1 ? [0] : ToneTools.quantizedLevels(hist, slots), lut = new Uint8Array(256);
      for (let v = 0; v < 256; v++) {
        let best = 0;
        for (let k = 1; k < tones.length; k++) if (Math.abs(v - tones[k]) < Math.abs(v - tones[best])) best = k;
        lut[v] = (background ? 1 : 0) + best;
      }
      const labels = new Uint8Array(size), gray = new Uint8ClampedArray(size * 4);
      for (let i = 0; i < size; i++) {
        labels[i] = background?.[i] ? 0 : lut[lab.data[i * 3]];
        const v = Math.round(labels[i] * 255 / (count - 1)), p = i * 4;
        gray[p] = gray[p + 1] = gray[p + 2] = v; gray[p + 3] = 255;
      }
      ToneTools.cleanLevelSpeckles(gray, w, h);
      for (let i = 0; i < size; i++) {
        labels[i] = Math.round(gray[i * 4] * (count - 1) / 255);
        // Cleanup cannot fill the background or erase the darkest subject material.
        if (background) labels[i] = background[i] ? 0 : Math.max(1, labels[i]);
      }
      return {width: w, height: h, labels, background, count};
    } finally { for (const mat of mats.reverse()) mat.delete(); }
  }
  return {prepare};
});
