'use strict';
importScripts('vendor/clipper.js','kaleidoscope-vectors.js');
self.onmessage=({data})=>{try{self.postMessage({layers:KaleidoscopeVectors.generate(data.settings,data.width,data.height,data.border)});}catch(e){self.postMessage({error:e.message});}};
