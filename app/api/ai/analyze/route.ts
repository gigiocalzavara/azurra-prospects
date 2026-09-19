import { NextRequest } from "next/server";
export async function POST(request: NextRequest){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return Response.json({error:"IA não configurada no servidor."},{status:503});
  const body=await request.json();
  const content=String(body?.content||"").slice(0,12000);
  const task=String(body?.task||"viral_reason");
  const prompts:Record<string,string>={
    viral_reason:"Analise por que este conteúdo tem potencial de viralização. Identifique hook, estrutura, emoção, retenção, CTA e padrões replicáveis.",
    hook:"Extraia o hook principal e crie 10 variações fortes em português do Brasil.",
    script:"Transforme a ideia em um roteiro curto para Reel/TikTok com hook, desenvolvimento e CTA.",
    angles:"Crie 8 novos ângulos editoriais baseados no conteúdo, sem copiar frases do original."
  };
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",input:`${prompts[task]||prompts.viral_reason}\n\nConteúdo:\n${content}`})});
  const data=await response.json();
  if(!response.ok) return Response.json({error:data?.error?.message||"Falha na análise."},{status:response.status});
  return Response.json({text:data.output_text||""});
}
