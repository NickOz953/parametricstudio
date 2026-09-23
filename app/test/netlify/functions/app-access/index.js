const fs = require('fs');
const path = require('path');
const activate = require('./activate.cjs').handler;
const check = require('./check-activation.cjs').handler;
const cookieName = 'ps_app_activation';
const headers = {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'X-Frame-Options':'SAMEORIGIN'};
function response(body, statusCode=200, extra={}) {return {statusCode, headers:{...headers,...extra},body};}
function page(name) {const file=[path.join(__dirname,name),path.join(process.cwd(),'netlify/functions/app-access',name)].find(f=>fs.existsSync(f));return response(fs.readFileSync(file,'utf8'),200,{'Content-Type':'text/html; charset=utf-8'});}
exports.handler = async function(event) {
  try {
    if(event.httpMethod==='POST') {
      const origin=event.headers?.origin;
      const host=event.headers?.host;
      if(origin && new URL(origin).host!==host) return response('Forbidden',403);
      if((event.body||'').length>8192) return response('Request too large',413);
      const result=await activate(event);
      const data=JSON.parse(result.body);
      if(!data.valid || !data.token) return response(JSON.stringify({valid:false,message:data.message}),result.statusCode,{'Content-Type':'application/json'});
      const maxAge=Math.max(0,Math.floor((data.expiresAt-Date.now())/1000));
      return response(JSON.stringify({valid:true}),200,{'Content-Type':'application/json','Set-Cookie':`${cookieName}=${data.token}; Path=/app/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`});
    }
    if(event.httpMethod!=='GET') return response('Method not allowed',405,{'Allow':'GET, POST'});
    const cookies=event.headers?.cookie||'';
    const token=cookies.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(token) {
      const result=await check({httpMethod:'POST',body:JSON.stringify({token})});
      if(JSON.parse(result.body).valid===true) return page('application.html');
    }
    return page('login.html');
  } catch(error) {
    return response('Unable to load Parametric Studio. Please try again.',503,{'Content-Type':'text/plain; charset=utf-8'});
  }
};