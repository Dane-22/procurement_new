import { createClient } from 'redis';

let client;
let connecting;
const memory=new Map();
const inFlight=new Map();
const maxEntries=100;
export async function connectRedis() {
  if (!process.env.REDIS_URL) return null;
  if(client?.isReady)return client;
  if(connecting)return connecting;
  client ||= createClient({url:process.env.REDIS_URL,socket:{connectTimeout:1500,reconnectStrategy: retries=>retries>5 ? false : Math.min(250*2**retries,5000)},disableOfflineQueue:true});
  client.on('error',()=>{});
  connecting=client.connect().then(()=>client).catch(()=>null).finally(()=>{connecting=null;});
  return connecting;
}
export function redisClient(){return client?.isReady ? client : null;}
const timeout=async p=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Redis timeout')),500);})]);}finally{clearTimeout(timer);}};
// Explicit opt-in for non-authoritative reference data. Workflow routes never call this.
export async function referenceCache(key,ttlSeconds,loader) {
  if(!key.startsWith('reference:'))throw new Error('Only reference data may use the cache');
  const fullKey=`${process.env.NODE_ENV || 'development'}:procurement:v1:${key}`;
  const local=memory.get(fullKey);
  if(local?.expires>Date.now())return local.value;
  if(inFlight.has(fullKey))return inFlight.get(fullKey);
  const redis=redisClient();
  if(redis)try{const value=await timeout(redis.get(fullKey));if(value)return JSON.parse(value);}catch{/* source fallback */}
  const loading=loader();inFlight.set(fullKey,loading);
  let value;try{value=await loading;}finally{inFlight.delete(fullKey);}
  memory.set(fullKey,{value,expires:Date.now()+Math.min(ttlSeconds,5)*1000});
  if(memory.size>maxEntries)memory.delete(memory.keys().next().value);
  if(redis)await timeout(redis.set(fullKey,JSON.stringify(value),{EX:ttlSeconds})).catch(()=>{});
  return value;
}
export async function closeRedis(){memory.clear();if(client?.isOpen)await client.quit().catch(()=>client.destroy());}
