'use strict';
importScripts('vendor/clipper.js','cut-cleanup.js');
self.onmessage=({data})=>self.postMessage({results:CutCleanup.stack(data.jobs,data.board)});
