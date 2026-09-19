export async function GET(){
  return Response.json({ok:true,service:"azurra-viral",timestamp:new Date().toISOString()});
}
