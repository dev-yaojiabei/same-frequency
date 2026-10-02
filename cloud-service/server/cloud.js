import {decodeProfile,buildReport,reportText} from './shared/core.js';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export function normalizeName(value){
 if(typeof value!=='string')throw new HttpError(400,'请填写昵称。');
 const name=value.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!name||name.length>20||/[\p{Cc}\p{Cf}]/u.test(name))throw new HttpError(400,'昵称需要 1～20 个字符，不能包含不可见控制字符。');
 return {name,key:name.toLocaleLowerCase('en-US')};
}
const allowedOrigins=new Set(['https://dev-yaojiabei.github.io','https://same-frequency-records.yaoshiyou.chatgpt.site','http://127.0.0.1:4173','http://localhost:4173']);
function json(data,status,origin){const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};if(origin&&allowedOrigins.has(origin))h['Access-Control-Allow-Origin']=origin;return new Response(JSON.stringify(data),{status,headers:h});}
async function hash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'请以 JSON 提交。');
 if(Number(request.headers.get('content-length')||0)>24000)throw new HttpError(413,'提交内容过长。');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'提交内容为空。');
 let total=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>24000){await reader.cancel();throw new HttpError(413,'提交内容过长。');}parts.push(value);}
 const all=new Uint8Array(total);let pos=0;for(const part of parts){all.set(part,pos);pos+=part.length;}
 try{const data=JSON.parse(new TextDecoder().decode(all));if(!data||typeof data!=='object'||Array.isArray(data))throw 0;return data;}catch{throw new HttpError(400,'无法读取提交内容。');}
}
function dbBinding(env){if(!env.DB)throw new HttpError(503,'云端存储暂时不可用，请稍后重试。');return env.DB;}
export async function handleCloud(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(origin&&!allowedOrigins.has(origin)&&origin!==url.origin)return json({error:'此来源未获允许。'},403,null);
 if(request.method==='OPTIONS'){const headers={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'};if(origin&&allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;return new Response(null,{status:204,headers});}
 if(url.pathname==='/api/cloud/health')return json({ok:true,service:'same-frequency-records'},200,origin);
 if(request.method!=='POST')return json({error:'此接口只接受 POST。'},405,origin);
 try{
  const db=dbBinding(env),data=await readBody(request),now=Date.now(),bucket=Math.floor(now/600000);
  const ip=request.headers.get('CF-Connecting-IP');
  if(ip){const rateKey=await hash(`${bucket}:${ip}`);const rate=await db.prepare('INSERT INTO rate_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(rateKey,now+1200000).first();if(rate.count>120)throw new HttpError(429,'操作有点频繁，请十分钟后再试。');await db.prepare('DELETE FROM rate_windows WHERE key IN (SELECT key FROM rate_windows WHERE expires_at < ? LIMIT 20)').bind(now).run();}
  const {name,key}=normalizeName(data.name),action=url.pathname.replace('/api/cloud/','');
  if(action==='register'){
   if(data.consent!==true)throw new HttpError(400,'请先确认昵称可见范围。');
   const created=await db.prepare('INSERT INTO nicknames (key,name,created_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING RETURNING name').bind(key,name,now).first();
   if(!created)throw new HttpError(409,'这个昵称已存在，不能重复创建。若你之前用过它，请选择“进入已有昵称”。');
   return json({name:created.name,created:true},201,origin);
  }
  const owner=await db.prepare('SELECT name FROM nicknames WHERE key = ?').bind(key).first();if(!owner)throw new HttpError(404,'没有找到这个昵称，请检查输入，或先创建新昵称。');
  if(action==='enter')return json({name:owner.name},200,origin);
  if(action==='list'){
   const result=await db.prepare('SELECT id,title,kind,score,created_at FROM pair_records WHERE nickname = ? ORDER BY created_at DESC,id DESC LIMIT 100').bind(key).all();
   return json({name:owner.name,records:result.results||[]},200,origin);
  }
  if(action==='record'){
   if(typeof data.id!=='string'||!/^[a-f0-9]{64}$/.test(data.id))throw new HttpError(400,'记录编号无效。');
   const record=await db.prepare('SELECT payload,created_at FROM pair_records WHERE nickname = ? AND id = ?').bind(key,data.id).first();if(!record)throw new HttpError(404,'找不到这份记录。');
   return json({...JSON.parse(record.payload),created_at:record.created_at,id:data.id},200,origin);
  }
  if(action==='save'){
   if(data.consent!==true)throw new HttpError(400,'保存前请确认双方知晓昵称查询的可见范围。');
   if(!Array.isArray(data.codes)||data.codes.length!==2||data.codes.some(c=>typeof c!=='string'||c.length>7000)||!['friend','partner','neutral'].includes(data.kind))throw new HttpError(400,'请提交两份完整答案码和关系视角。');
   const codes=data.codes.map(c=>c.replace(/\s/g,''));let a,b;
   try{[a,b]=await Promise.all(codes.map(decodeProfile));}catch(e){throw new HttpError(400,e.message);}
   if(a.id===b.id)throw new HttpError(400,'不能把同一份答卷重复配对。');
   if(normalizeName(a.n).key!==key&&normalizeName(b.n).key!==key)throw new HttpError(400,'请使用这两份答卷中其中一人的昵称保存。');
   const id=await hash(JSON.stringify([data.kind,...[...codes].sort()]));
   const existing=await db.prepare('SELECT id FROM pair_records WHERE nickname = ? AND id = ?').bind(key,id).first();if(existing)return json({id,duplicate:true,name:owner.name},200,origin);
   const report=buildReport(a,b,data.kind),payload=JSON.stringify({codes,kind:data.kind,report,reportText:reportText(report),reportVersion:1});
   const row=await db.prepare('INSERT INTO pair_records (nickname,id,title,kind,score,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM pair_records WHERE nickname = ?) < 100 ON CONFLICT(nickname,id) DO NOTHING RETURNING id').bind(key,id,`${a.n} × ${b.n}`,data.kind,report.metrics.score,payload,now,key).first();
   if(!row){const duplicate=await db.prepare('SELECT id FROM pair_records WHERE nickname = ? AND id = ?').bind(key,id).first();if(duplicate)return json({id,duplicate:true,name:owner.name},200,origin);throw new HttpError(409,'这个昵称已保存 100 份记录，暂时不能继续添加。');}
   return json({id,name:owner.name,saved:true},201,origin);
  }
  throw new HttpError(404,'接口不存在。');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status,origin);console.error('Cloud storage request failed',e?.name||'Error');return json({error:'云端存储暂时不可用，内容未丢失，请稍后重试。'},503,origin);}
}
