const fs = require('fs');
const paths = [
  '/categories/composite-strapping', '/categories/lashing-buckles',
  '/categories/load-securing-applications', '/categories/strapping-dispenser',
  '/categories/strapping-tools', '/categories/vacuum-metallized-polyester-film',
  '/categories/wire-buckles', '/categories/woven-lashing',
  '/products/container-load-lashing', '/products/heat-sealer-fkr400-400mm',
  '/products/heavy-duty-ratchet-tensioner-50mm', '/products/mobile-strapping-dispenser',
  '/products/steel-and-building-materials', '/products/vacuum-metallized-polyester-film',
  '/products/composite-cord-strapping', '/applications/steel-and-building-materials',
  '/applications/container-load-lashing', '/applications/pallet-load-securing'
];
async function get(base, path) {
  try {
    const r = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [,''])[1];
    return {path, status:r.status, location:r.headers.get('location'),
      canonical:(html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)||[])[1],
      robots:(html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i)||[])[1],
      xRobots:r.headers.get('x-robots-tag'), mainWords:main.replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length,
      title:(html.match(/<title>(.*?)<\/title>/i)||[])[1]};
  } catch(e) { return {path,error:e.message}; }
}
(async()=>{
  const base = process.argv[2] || 'http://127.0.0.1:4188';
  let sitemap=null; try { const response=await fetch(base+'/sitemap.xml',{signal:AbortSignal.timeout(12000)}); if(response.ok) sitemap=await response.text(); }catch{}
  const results=[];
  for(let i=0;i<paths.length;i+=4) results.push(...await Promise.all(paths.slice(i,i+4).map(p=>get(base,p))));
  for(const r of results) r.inSitemap=sitemap===null?null:sitemap.includes('<loc>https://www.composite-strapping.com'+r.path+'</loc>');
  const report={base,checkedAt:new Date().toISOString(),results};
  const name=base.startsWith('http://127.')?'local':'public';
  fs.writeFileSync('outputs/gsc-indexing-'+name+'-audit-20261026.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})();
