import {getSupabase} from '../../services/supabase';
export async function postAssistant(path:string,body:unknown):Promise<unknown> {
 const client=getSupabase(); if(!client) throw new Error('No session');
 const {data:{session},error}=await client.auth.getSession(); if(error || !session) throw new Error('No session');
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
 if(!response.ok) throw new Error('Request failed'); return response.json();
}
