'use strict';
importScripts('tone-tools.js', 'photo-relief.js', 'vendor/opencv.js');
// OpenCV's legacy thenable resolves to itself; do not assimilate it as a Promise.
const ready = new Promise(resolve => cv.Mat ? resolve() : cv.then(() => resolve()));
onmessage = async ({data}) => {
  try {
    await ready;
    const result = PhotoRelief.prepare(cv, data, (label, progress) => postMessage({label, progress}));
    postMessage({...result, done: true}, [result.labels.buffer, ...(result.background ? [result.background.buffer] : [])]);
  } catch (error) {
    postMessage({error: typeof error === 'number' ? 'Subject selection failed. Mark some subject and background, then try again.' : error.message || 'Photo preparation failed.'});
  }
};
