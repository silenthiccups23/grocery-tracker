// Store product link generation
// Links directly to the store's own product search page.
// These URLs work when a real user clicks them from their normal browser.

const STORE_SEARCH_URLS: Array<{ keyword: string; urlTemplate: string }> = [
  // Albertsons / Safeway family
  { keyword: "albertsons", urlTemplate: "https://www.albertsons.com/shop/search-results.html?q={q}" },
  { keyword: "vons", urlTemplate: "https://www.vons.com/shop/search-results.html?q={q}" },
  { keyword: "pavilions", urlTemplate: "https://www.pavilions.com/shop/search-results.html?q={q}" },
  { keyword: "safeway", urlTemplate: "https://www.safeway.com/shop/search-results.html?q={q}" },
  { keyword: "jewel", urlTemplate: "https://www.jewelosco.com/shop/search-results.html?q={q}" },
  { keyword: "shaw", urlTemplate: "https://www.shaws.com/shop/search-results.html?q={q}" },
  { keyword: "acme", urlTemplate: "https://www.acmemarkets.com/shop/search-results.html?q={q}" },
  // Kroger family
  { keyword: "ralphs", urlTemplate: "https://www.ralphs.com/search?query={q}&searchType=default_search" },
  { keyword: "kroger", urlTemplate: "https://www.kroger.com/search?query={q}&searchType=default_search" },
  { keyword: "food 4 less", urlTemplate: "https://www.food4less.com/search?query={q}&searchType=default_search" },
  { keyword: "fry", urlTemplate: "https://www.frysfood.com/search?query={q}&searchType=default_search" },
  { keyword: "fred meyer", urlTemplate: "https://www.fredmeyer.com/search?query={q}&searchType=default_search" },
  { keyword: "king soopers", urlTemplate: "https://www.kingsoopers.com/search?query={q}&searchType=default_search" },
  { keyword: "smith", urlTemplate: "https://www.smithsfoodanddrug.com/search?query={q}&searchType=default_search" },
  // Big-box / wholesale
  { keyword: "walmart", urlTemplate: "https://www.walmart.com/search?q={q}" },
  { keyword: "target", urlTemplate: "https://www.target.com/s?searchTerm={q}" },
  { keyword: "costco", urlTemplate: "https://www.costco.com/CatalogSearch?dept=All&keyword={q}" },
  { keyword: "sam's club", urlTemplate: "https://www.samsclub.com/s/{q}" },
  { keyword: "bj's", urlTemplate: "https://www.bjs.com/search/{q}" },
  // Specialty / natural
  { keyword: "trader joe", urlTemplate: "https://www.traderjoes.com/home/search?q={q}&section=products" },
  { keyword: "whole foods", urlTemplate: "https://www.wholefoodsmarket.com/search?text={q}" },
  { keyword: "sprouts", urlTemplate: "https://shop.sprouts.com/store/sprouts/s?k={q}" },
  { keyword: "natural grocers", urlTemplate: "https://www.naturalgrocers.com/search?keywords={q}" },
  // Value / discount
  { keyword: "aldi", urlTemplate: "https://www.aldi.us/products/?search={q}" },
  { keyword: "grocery outlet", urlTemplate: "https://www.groceryoutlet.com/search?q={q}" },
  { keyword: "smart & final", urlTemplate: "https://www.smartandfinal.com/search?q={q}" },
  { keyword: "winco", urlTemplate: "https://www.wincofoods.com/products/search?q={q}" },
  // International
  { keyword: "h mart", urlTemplate: "https://www.hmart.com/search?q={q}" },
  { keyword: "99 ranch", urlTemplate: "https://www.99ranch.com/search?keyword={q}" },
  { keyword: "mitsuwa", urlTemplate: "https://mitsuwa.com/search?q={q}" },
  // Regional
  { keyword: "publix", urlTemplate: "https://www.publix.com/shop/search?query={q}" },
  { keyword: "h-e-b", urlTemplate: "https://www.heb.com/search/?q={q}" },
  { keyword: "meijer", urlTemplate: "https://www.meijer.com/shopping/search.html?text={q}" },
  { keyword: "wegmans", urlTemplate: "https://shop.wegmans.com/search?search_term={q}" },
  { keyword: "stop & shop", urlTemplate: "https://stopandshop.com/search?query={q}" },
  { keyword: "giant", urlTemplate: "https://giantfood.com/search?query={q}" },
  { keyword: "food lion", urlTemplate: "https://shop.foodlion.com/search?search_term={q}" },
  { keyword: "harris teeter", urlTemplate: "https://www.harristeeter.com/search?query={q}" },
  { keyword: "gelson", urlTemplate: "https://www.gelsons.com/shop#!/?q={q}" },
  { keyword: "stater bros", urlTemplate: "https://www.staterbros.com/search?q={q}" },
  { keyword: "northgate", urlTemplate: "https://shop.northgatemarket.com/store/northgate-market/s?k={q}" },
  { keyword: "cardenas", urlTemplate: "https://shop.cardenasmarkets.com/search?search_term={q}" },
  { keyword: "vallarta", urlTemplate: "https://shop.vallartasupermarkets.com/search?search_term={q}" },
];

export function getStoreProductUrl(storeName: string, productName: string, tags: string[]): string {
  const lowerStore = storeName.toLowerCase();
  const query = [productName, ...tags].join(" ");
  const encoded = encodeURIComponent(query);

  for (const entry of STORE_SEARCH_URLS) {
    if (lowerStore.includes(entry.keyword)) {
      return entry.urlTemplate.replace("{q}", encoded);
    }
  }
  // Fallback: search on the store's own website via Google
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} ${storeName}`)}+grocery+price`;
}

/**
 * Navigate to an external URL. Uses top-level navigation to escape
 * nested iframes (deploy sites inside double-nested iframes,
 * and iOS Safari blocks target="_blank" popups from within them).
 */
export function navigateToStore(url: string, e: React.MouseEvent) {
  e.preventDefault();
  // Try to navigate the topmost window so we escape all iframe layers
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin — top is not accessible
  }
  // Try parent
  try {
    if (window.parent && window.parent !== window) {
      window.parent.location.href = url;
      return;
    }
  } catch {}
  // Direct navigation as last resort
  window.location.href = url;
}
