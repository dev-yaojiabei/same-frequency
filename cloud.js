export const CLOUD_ORIGIN='https://same-frequency-records.yaoshiyou.chatgpt.site';
export class CloudError extends Error {constructor(status,message){super(message);this.status=status;}}
export async function cloudRequest(action,data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetch(`${CLOUD_ORIGIN}/api/cloud/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal,credentials:'omit',cache:'no-store'});
  const result=await res.json().catch(()=>null);
  if(!res.ok||!result)throw new CloudError(res.status,result?.error||'云端暂时没有正确响应，请稍后重试。');
  return result;
 }catch(e){if(e instanceof CloudError)throw e;throw new CloudError(0,e.name==='AbortError'?'连接云端超时，请稍后重试。':'暂时连接不到云端，请检查网络后重试。');}finally{clearTimeout(timer);}
}
