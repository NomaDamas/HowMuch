// A self-contained Playwright evaluate callback. No page-wide regex, snippets or inferred stock.
export function renderedProduct(){
  const content=node=>node?.getAttribute('content')||node?.getAttribute('datetime')||node?.getAttribute('href')||node?.textContent?.trim();
  const meta=key=>document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]')?.content;
  const products=[...document.querySelectorAll('[itemscope][itemtype$="/Product"]')];
  const output=[];
  for(const product of products){
    const name=content(product.querySelector('[itemprop="name"]'));
    for(const offer of product.querySelectorAll('[itemscope][itemtype$="/Offer"]')){
      if(offer.closest('[itemscope][itemtype$="/Product"]')!==product)continue;
      const get=key=>content(offer.querySelector('[itemprop="'+key+'"]'));
      output.push({'@type':'Product',name,offers:{'@type':'Offer',price:get('price'),priceCurrency:get('priceCurrency'),priceValidUntil:get('priceValidUntil'),validThrough:get('validThrough'),itemCondition:get('itemCondition'),availability:get('availability')}});
    }
  }
  if(!output.length && /^(product|product.item)$/i.test(meta('og:type')||'')){
    const availability=String(meta('product:availability') || '').toLowerCase().replace(/[\s_-]/g,'');
    const condition=String(meta('product:condition')||'').toLowerCase();
    output.push({'@type':'Product',name:meta('og:title'),image:meta('og:image'),offers:{'@type':'Offer',price:meta('product:price:amount')||meta('og:price:amount'),priceCurrency:meta('product:price:currency')||meta('og:price:currency'),priceValidUntil:meta('product:price:valid_until')||meta('og:price:valid_until'),validThrough:meta('product:expiration_time')||meta('og:expiration_time'),availability:({instock:'InStock',outofstock:'OutOfStock'})[availability],itemCondition:({new:'NewCondition',used:'UsedCondition'})[condition]}});
  }
  return output;
}
