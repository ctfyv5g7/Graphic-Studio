import {createClient} from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const enabled=!!(url&&key)
const sb=enabled?createClient(url,key):null
async function uid(){let{data:{session}}=await sb.auth.getSession();if(!session){const r=await sb.auth.signInAnonymously();if(r.error)throw r.error;session=r.data.session}return session.user.id}
export async function save(name,data){const user_id=await uid();const{error}=await sb.from('graphs').upsert({user_id,name,data,updated_at:new Date().toISOString()},{onConflict:'user_id,name'});if(error)throw error}
export async function list(){await uid();const{data,error}=await sb.from('graphs').select('name,data,updated_at').order('updated_at',{ascending:false});if(error)throw error;return data}
