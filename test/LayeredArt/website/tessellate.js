'use strict';
function tessellateContours(rings,lib=globalThis.libtess){
  const triangles=[],tess=new lib.GluTesselator();let error;
  tess.gluTessCallback(lib.gluEnum.GLU_TESS_VERTEX_DATA,(vertex,out)=>out.push(vertex[0],vertex[1]));
  tess.gluTessCallback(lib.gluEnum.GLU_TESS_COMBINE,coords=>[coords[0],coords[1],coords[2]]);
  tess.gluTessCallback(lib.gluEnum.GLU_TESS_EDGE_FLAG,()=>{});
  tess.gluTessCallback(lib.gluEnum.GLU_TESS_ERROR,code=>{error=code;});
  tess.gluTessProperty(lib.gluEnum.GLU_TESS_WINDING_RULE,lib.windingRule.GLU_TESS_WINDING_ODD);
  tess.gluTessNormal(0,0,1);tess.gluTessBeginPolygon(triangles);
  for(const ring of rings){if(ring.length<3)continue;tess.gluTessBeginContour();for(const [x,y]of ring){const vertex=[x,y,0];tess.gluTessVertex(vertex,vertex);}tess.gluTessEndContour();}
  tess.gluTessEndPolygon();tess.gluDeleteTess();if(error)throw Error('Could not tessellate contours: '+error);return triangles;
}
if(typeof module!=='undefined')module.exports=tessellateContours;
