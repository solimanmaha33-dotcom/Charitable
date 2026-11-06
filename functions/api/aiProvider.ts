type AIEnv = { AI?: { run: (model:string, input:unknown) => Promise<unknown> } };
export async function complete(env: AIEnv, system:string, content:string):Promise<string> {
 if(!env.AI) throw new Error('AI unavailable');
 const result=await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:system},{role:'user',content}],max_tokens:1024});
 if(!result || typeof result!=='object' || !('response' in result) || typeof result.response!=='string') throw new Error('Invalid model response');
 return result.response;
}
