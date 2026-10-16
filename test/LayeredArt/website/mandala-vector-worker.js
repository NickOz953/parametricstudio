'use strict';
importScripts('vendor/clipper.js','mandala-vectors.js');
self.onmessage=({data})=>{try{self.postMessage({layers:MandalaVectors.generate(data.settings,data.width,data.height,data.border)});}catch(e){self.postMessage({error:e.message});}};
