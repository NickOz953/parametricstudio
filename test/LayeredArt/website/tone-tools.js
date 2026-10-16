(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ToneTools=factory();})(globalThis,()=>{
  'use strict';
  function apply(data,s={}){
    const lut=new Uint8Array(256),contrast=Math.pow(2,(s.contrast||0)/50);
    for(let i=0;i<256;i++){let x=i/255;x+=(s.shadows||0)/250*(1-x)**2+(s.highlights||0)/250*x*x;x=(x-.5)*contrast+.5+(s.brightness||0)/200;lut[i]=Math.round(Math.max(0,Math.min(1,x))*255);}
    for(let i=0;i<data.length;i+=4)data[i]=data[i+1]=data[i+2]=lut[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])];return data;
  }
  function histogram(data){const h=new Array(256).fill(0);for(let i=0;i<data.length;i+=4)h[data[i]]++;return h;}
  function automatic(hist,count){const total=hist.reduce((a,b)=>a+b,0),cuts=[];let sum=0,i=0;for(let k=1;k<count;k++){while(i<254&&sum<total*k/count)sum+=hist[i++];cuts.push(Math.max(k,Math.min(255-count+k,Math.max(i,(cuts.at(-1)||0)+1))));}return cuts;}
  function valid(cuts,count){return Array.isArray(cuts)&&cuts.length===count-1&&cuts.every((v,i)=>Number.isInteger(v)&&v>=1&&v<=254&&(!i||v>cuts[i-1]));}
  function levelPlan(hist,count,{minPeakMass=.015}={}){
    const total=hist.reduce((a,b)=>a+b,0);if(!total)return null;
    const smooth=hist.map((_,i)=>{let sum=0,weight=0;for(let j=-6;j<=6;j++){const w=Math.exp(-j*j/8);sum+=(hist[Math.max(0,Math.min(255,i+j))]||0)*w;weight+=w;}return sum/weight;});
    const peaks=[];
    for(let i=0;i<256;i++)if(smooth[i]>=(smooth[i-1]??-1)&&smooth[i]>(smooth[i+1]??-1))peaks.push(i);
    const chosen=[];
    for(const p of peaks.sort((a,b)=>smooth[b]-smooth[a])){
      const mass=hist.slice(Math.max(0,p-12),Math.min(256,p+13)).reduce((a,b)=>a+b,0);
      if(mass>=total*minPeakMass&&chosen.every(q=>Math.abs(p-q)>=18))chosen.push(p);
    }
    chosen.sort((a,b)=>a-b);
    for(let i=1;i<chosen.length;){const a=chosen[i-1],b=chosen[i];if(Math.min(...smooth.slice(a+1,b))>Math.min(smooth[a],smooth[b])*.3){chosen.splice(smooth[a]<smooth[b]?i-1:i,1);i=Math.max(1,i-1);}else i++;}
    if(chosen.length<2||chosen.length>12)return null;
    // Only use band snapping when most pixels already belong to distinct flat tones.
    let covered=0;for(let i=0;i<256;i++)if(chosen.some(p=>Math.abs(i-p)<=14))covered+=hist[i];
    if(covered/total<.85)return null;
    for(let i=1;i<chosen.length;i++)if(Math.min(...smooth.slice(chosen[i-1]+1,chosen[i]))>Math.min(smooth[chosen[i-1]],smooth[chosen[i]])*.3)return null;
    let groups=chosen.map(p=>({value:p,weight:0,sum:0}));
    for(let i=0;i<256;i++){const g=groups.reduce((a,b)=>Math.abs(i-a.value)<=Math.abs(i-b.value)?a:b);g.weight+=hist[i];g.sum+=hist[i]*i;}
    groups.forEach(g=>g.value=g.sum/g.weight);
    while(groups.length>count){let best=0,cost=Infinity;for(let i=0;i<groups.length-1;i++){const a=groups[i],b=groups[i+1],c=(a.value-b.value)**2*a.weight*b.weight/(a.weight+b.weight);if(c<cost){cost=c;best=i;}}const a=groups[best],b=groups[best+1];groups.splice(best,2,{value:(a.sum+b.sum)/(a.weight+b.weight),sum:a.sum+b.sum,weight:a.weight+b.weight});}
    const levels=groups.map(g=>Math.round(g.value)),cuts=levels.slice(1).map((v,i)=>Math.round((levels[i]+v)/2));
    // Extra requested bands remain empty instead of splitting texture into new geometry.
    for(let i=1;cuts.length<count-1&&i<255;i++)if(!cuts.includes(i))cuts.push(i);
    cuts.sort((a,b)=>a-b);return {levels,cuts};
  }
  function snapLevels(data,levels){if(!Array.isArray(levels)||levels.length<2||levels.length>12||levels.some(v=>!Number.isInteger(v)||v<0||v>255))return data;const lut=new Uint8Array(256);for(let i=0;i<256;i++)lut[i]=levels.reduce((a,b)=>Math.abs(i-a)<=Math.abs(i-b)?a:b);for(let i=0;i<data.length;i+=4)data[i]=data[i+1]=data[i+2]=lut[data[i]];return data;}
  function cleanLevelSpeckles(data,width,height){
    const seen=new Uint8Array(width*height),queue=new Int32Array(width*height),neighbors=new Uint32Array(256);
    for(let start=0;start<seen.length;start++){
      if(seen[start])continue;const value=data[start*4];let head=0,tail=1,replacement=value,best=0;queue[0]=start;seen[start]=1;neighbors.fill(0);
      while(head<tail){const p=queue[head++],x=p%width;for(let direction=0;direction<4;direction++){
        const q=direction===0?(x?p-1:-1):direction===1?(x<width-1?p+1:-1):direction===2?(p>=width?p-width:-1):(p<seen.length-width?p+width:-1);
        if(q<0)continue;const other=data[q*4];
        if(other!==value){
          // Only tiny regions need a replacement; ties still choose the lowest tone.
          if(tail<9){const mass=++neighbors[other];if(mass>best||mass===best&&other<replacement){best=mass;replacement=other;}}
        }else if(!seen[q]){seen[q]=1;queue[tail++]=q;}
      }}
      if(tail<9)for(let k=0;k<tail;k++){const i=queue[k]*4;data[i]=data[i+1]=data[i+2]=replacement;}
    }
    return data;
  }
  function band(value,cuts){let i=0;while(i<cuts.length&&value>=cuts[i])i++;return i;}
  function posterize(data,cuts){const lut=new Uint8Array(256);for(let value=0;value<256;value++)lut[value]=Math.round(band(value,cuts)*255/cuts.length);for(let i=0;i<data.length;i+=4)data[i]=data[i+1]=data[i+2]=lut[data[i]];return data;}
  function removeArtifacts(data,width,height){
    // A small median neighborhood rejects isolated specks without blurring edges.
    const source=new Uint8ClampedArray(data),values=new Uint8Array(9);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let n=0,sum=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const v=source[(Math.max(0,Math.min(height-1,y+dy))*width+Math.max(0,Math.min(width-1,x+dx)))*4];values[n++]=v;sum+=v;
      }
      values.sort();const i=(y*width+x)*4,median=values[4];
      const value=values[8]-values[0]<=18?Math.round(sum/9):Math.abs(source[i]-median)>18?median:source[i];
      data[i]=data[i+1]=data[i+2]=value;
    }
    return data;
  }
  function quantizedLevels(hist,count){
    const values=hist.map((n,i)=>n>0?i:-1).filter(i=>i>=0),n=values.length,k=Math.min(n,Math.max(2,Math.min(12,Math.round(count)||5)));
    if(n<=k)return values;
    const weight=[0],sum=[0],square=[0];
    for(const v of values){weight.push(weight.at(-1)+hist[v]);sum.push(sum.at(-1)+hist[v]*v);square.push(square.at(-1)+hist[v]*v*v);}
    // Optimal contiguous grayscale groups using weighted squared error; at most 256 bins.
    const cost=(a,b)=>{const w=weight[b]-weight[a],s=sum[b]-sum[a];return square[b]-square[a]-s*s/w;};
    let prev=new Float64Array(n+1).fill(Infinity);prev[0]=0;
    const splits=Array.from({length:k+1},()=>new Uint16Array(n+1));
    for(let group=1;group<=k;group++){
      const next=new Float64Array(n+1).fill(Infinity);
      for(let end=group;end<=n;end++)for(let start=group-1;start<end;start++){
        const error=prev[start]+cost(start,end);if(error<next[end]){next[end]=error;splits[group][end]=start;}
      }prev=next;
    }
    const levels=[];let end=n;
    for(let group=k;group>0;group--){const start=splits[group][end];levels.unshift(Math.round((sum[end]-sum[start])/(weight[end]-weight[start])));end=start;}
    if(values[0]===0)levels[0]=0;
    if(values.at(-1)===255)levels[levels.length-1]=255;
    return levels;
  }
  return {apply,histogram,automatic,valid,band,posterize,removeArtifacts,levelPlan,snapLevels,cleanLevelSpeckles,quantizedLevels};
});
