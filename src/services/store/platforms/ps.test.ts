import { describe, expect, test } from 'bun:test';

import {
    getPsSearchQueryCandidates,
    parsePlayStationChihiroResponse,
    parsePlayStationProductHtml,
    parsePlayStationSearchHtml,
} from '@/services/store/platforms/ps-parse';

const PRODUCT_ID = 'EP4484-PPSA03711_00-3235764131417729';

describe('PlayStation Store SSR parsing', () => {
  test('parses search tiles with current price, original price, discount, and URL', () => {
    const html = `
      <li>
        <div data-qa="search#productTile0">
          <a
            data-telemetry-meta="{&quot;id&quot;:&quot;${PRODUCT_ID}&quot;,&quot;index&quot;:0,&quot;name&quot;:&quot;Hades&quot;,&quot;price&quot;:&quot;307,65&nbsp;TL&quot;,&quot;titleId&quot;:&quot;PPSA03711_00&quot;}"
            href="/tr-tr/product/${PRODUCT_ID}"
          >
            <img src="https://image.api.playstation.com/hades.jpg" />
          </a>
          <span class="psw-m-r-3">307,65&nbsp;TL</span>
          <s data-qa="search#productTile0#price#price-strikethrough">879,00&nbsp;TL</s>
        </div>
      </li>
    `;

    const parsed = parsePlayStationSearchHtml(html, 'tr-tr');

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: PRODUCT_ID,
      title: 'Hades',
      price: '307,65 TL',
      original_price: '879,00 TL',
      discount: '-65%',
      image_url: 'https://image.api.playstation.com/hades.jpg',
      store_url: `https://store.playstation.com/tr-tr/product/${PRODUCT_ID}`,
    });
  });

  test('upgrades PlayStation search thumbnail URLs to larger artwork', () => {
    const html = `
      <li>
        <a
          data-telemetry-meta="{&quot;id&quot;:&quot;${PRODUCT_ID}&quot;,&quot;name&quot;:&quot;Fortnite&quot;,&quot;price&quot;:&quot;Ücretsiz&quot;}"
          href="/tr-tr/product/${PRODUCT_ID}"
        >
          <img src="https://image.api.playstation.com/vulcan/ap/rnd/fortnite.png?w=54&amp;thumb=true" />
        </a>
      </li>
    `;

    expect(parsePlayStationSearchHtml(html, 'tr-tr')[0]?.image_url).toBe(
      'https://image.api.playstation.com/vulcan/ap/rnd/fortnite.png?w=440',
    );
  });

  test('parses product pages with CTA price data and rich metadata', () => {
    const html = `
      <script id="mfe-jsonld-tags" type="application/ld+json">
        {"@context":"http://schema.org","@type":"Product","name":"Hades","description":"Zindan macerasi","image":["https://image.api.playstation.com/hades-cover.jpg"]}
      </script>
      <script id="__NEXT_DATA__" type="application/json">
        {"cache":{"Concept:123":{"id":"123","__typename":"Concept","personalizedMeta":{"media":[{"__typename":"Media","role":"PREVIEW","type":"VIDEO","url":"https://vulcan.dl.playstation.net/hades-trailer.mp4"},{"__typename":"Media","role":"SCREENSHOT","type":"IMAGE","url":"https://image.api.playstation.com/hades-shot.jpg"}]}},"Product:${PRODUCT_ID}:concept":{"id":"${PRODUCT_ID}","__typename":"Product","name":"Hades"},"Product:${PRODUCT_ID}:detail":{"id":"${PRODUCT_ID}","__typename":"Product","publisherName":"Supergiant Games","releaseDate":"2021-08-13T00:00:00Z","localizedGenres":[{"__typename":"LocalizedGenre","value":"Aksiyon"}]},"ADD_TO_CART:ADD_TO_CART:${PRODUCT_ID}-E003":{"id":"ADD_TO_CART:ADD_TO_CART:${PRODUCT_ID}-E003","__typename":"GameCTA","local":{"priceOrText":"307,65 TL","originalPrice":"879,00 TL","discountBadgeText":"%65 indirimden yararlanin"}}}}
      </script>
    `;

    const parsed = parsePlayStationProductHtml(html, PRODUCT_ID, 'tr-tr');

    expect(parsed).toMatchObject({
      id: PRODUCT_ID,
      title: 'Hades',
      image_url: 'https://image.api.playstation.com/hades-cover.jpg',
      price: '307,65 TL',
      original_price: '879,00 TL',
      discount: '-65%',
      store_url: `https://store.playstation.com/tr-tr/product/${PRODUCT_ID}`,
    });
  });

  test('parses a Chihiro container with screenshots and preview video', () => {
    const payload = {
      id: PRODUCT_ID,
      name: 'PS5® için Hades',
      title_name: 'Hades',
      default_sku: { display_price: '307,65 TL', price: 30765 },
      images: [{ type: 10, url: 'https://image.api.playstation.com/hades-cover.jpg' }],
      mediaList: {
        previews: [{ type: 'PREVIEW', url: 'https://video.playstation.net/hades.mp4' }],
      },
      metadata: { genre: { values: ['Action'] } },
      playable_platform: ['PS5'],
    };

    expect(parsePlayStationChihiroResponse(payload, 'tr-tr', true)[0]).toMatchObject({
      title: 'Hades',
    });
  });

  test('normalizes free Chihiro prices to the shared Turkish label', () => {
    const [parsed] = parsePlayStationChihiroResponse(
      {
        links: [{
          id: PRODUCT_ID,
          name: 'GSALE Free Game',
          default_sku: { display_price: 'Free', price: 0 },
          images: [],
        }],
      },
      'tr-tr',
    );

    expect(parsed?.price).toBe('Ücretsiz');
  });

  test('generates cleaned search query candidates for punctuation, colons, numbers, and hyphens', () => {
    expect(getPsSearchQueryCandidates("Baldur's Gate 3")).toContain('Baldurs_Gate_3');
    expect(getPsSearchQueryCandidates('Spider-Man')).toContain('SpiderMan');
    expect(getPsSearchQueryCandidates('NieR:Automata')).toContain('NieR_Automata');
    expect(getPsSearchQueryCandidates('Warhammer 40,000: Space Marine 2')).toContain('Warhammer_40000_Space_Marine_2');
    expect(getPsSearchQueryCandidates('Uncharted: Legacy of Thieves Collection')).toContain('Uncharted');
  });

  test('extracts outright purchase price from product page bypassing subscription upsell', () => {
    const html = `
      <script id="mfe-jsonld-tags" type="application/ld+json">
        {"@context":"http://schema.org","@type":"Product","name":"Alan Wake 2"}
      </script>
      <script id="__NEXT_DATA__" type="application/json">
        {"cache":{
          "GameCTA:UPSELL:1":{
            "id":"GameCTA:UPSELL:1",
            "__typename":"GameCTA",
            "type":"UPSELL_PS_PLUS_TRIAL",
            "local":{"priceOrText":"Oyun Deneme Sürümü"},
            "price":{"discountedPrice":"Oyun Deneme Sürümü","isTiedToSubscription":true}
          },
          "GameCTA:ADD_TO_CART:${PRODUCT_ID}":{
            "id":"GameCTA:ADD_TO_CART:${PRODUCT_ID}",
            "__typename":"GameCTA",
            "type":"ADD_TO_CART",
            "local":{
              "priceOrText":"1.099,00 TL",
              "telemetryMeta":{
                "skuDetail":{
                  "skuPriceDetail":[{
                    "originalPriceFormatted":"1.099,00 TL",
                    "discountPriceFormatted":"1.099,00 TL",
                    "offerApplicability":"APPLICABLE",
                    "offerIsTiedToSubscription":false
                  }]
                }
              }
            },
            "price":{"basePrice":"1.099,00 TL","discountedPrice":"1.099,00 TL","isTiedToSubscription":false}
          }
        }}
      </script>
    `;

    const parsed = parsePlayStationProductHtml(html, PRODUCT_ID, 'tr-tr');
    expect(parsed?.price).toBe('1.099,00 TL');
  });

  test('does not treat standard games with IS_ACTIVE / FALSE eligibilities as add-ons', () => {
    const payload = {
      links: [
        {
          id: 'standard-game',
          name: "Demon's Souls",
          top_category: 'downloadable_game',
          playable_platform: ['PS5'],
          default_sku: {
            display_price: '619,00 TL',
            price: 61900,
            eligibilities: [
              {
                id: 'SIE-ENTITLEMENT-DRM',
                operand: 'IS_ACTIVE',
                operator: 'FALSE',
              },
            ],
          },
        },
      ],
    };

    const parsed = parsePlayStationChihiroResponse(payload, 'tr-tr');
    expect(parsed[0]?.is_add_on).toBeFalse();
    expect(parsed[0]?.price).toBe('619,00 TL');
  });


  test('prioritizes hyphen-free candidates before hyphenated candidates for Chihiro compatibility', () => {
    const candidates = getPsSearchQueryCandidates('Spider-Man 2');
    expect(candidates[0]).toBe('SpiderMan_2');
    expect(candidates).toContain('Spider-Man_2');
  });

  test('falls back to JSON-LD offers price when HTML cache CTA records are missing', () => {
    const htmlWithJsonLdOnly = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "http://schema.org",
              "@type": "Product",
              "name": "Dragon's Dogma 2",
              "sku": "EP0102-PPSA09664_00-DD2GAME000000000",
              "offers": {
                "@type": "Offer",
                "price": 1311.75,
                "priceCurrency": "TRY"
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const parsed = parsePlayStationProductHtml(htmlWithJsonLdOnly, 'EP0102-PPSA09664_00-DD2GAME000000000', 'tr-tr');
    expect(parsed?.title).toBe("Dragon's Dogma 2");
    expect(parsed?.price).toBe('1.311,75 TL');
  });

  test('skips malformed search metadata and normalizes legacy image and relative links', () => {
    const html = `
      <li><a data-telemetry-meta="not-json" href="foo/product/bad"><img src="bad?x=1"></a></li>
      <li><a data-telemetry-meta="{&quot;id&quot;:&quot;edge&quot;,&quot;name&quot;:&quot;Edge&quot;}"
        href="foo/product/edge"><img src="bad url?x=1"></a></li>
      <li><a data-telemetry-meta="{&quot;id&quot;:&quot;edge&quot;,&quot;name&quot;:&quot;Duplicate&quot;}"></a></li>
    `;
    const products = parsePlayStationSearchHtml(html, 'tr-tr');
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: 'edge',
      image_url: 'bad url',
      store_url: 'https://store.playstation.com/tr-tr/foo/product/edge',
    });
  });

  test('skips malformed JSON-LD and invalid CTA records before a valid price', () => {
    const cache = {
      invalid: { __typename: 'GameCTA', id: `a-${PRODUCT_ID}`, type: 'OTHER', price: { isTiedToSubscription: true } },
      unrelated: { __typename: 'GameCTA', id: 'unrelated', type: 'ADD_TO_CART', price: { discountedPrice: '999,00 TL' } },
      subscription: { __typename: 'GameCTA', id: `b-${PRODUCT_ID}`, type: 'ADD_TO_CART', price: { isTiedToSubscription: true, discountedPrice: 'Free' } },
      valid: { __typename: 'GameCTA', id: `c-${PRODUCT_ID}`, type: 'ADD_TO_CART', price: { discountedPrice: '99,00 TL' } },
    };
    const html = `<script type="application/ld+json">{oops}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Edge"}</script>
      <script type="application/json">${JSON.stringify({ cache })}</script>`;
    const parsed = parsePlayStationProductHtml(html, PRODUCT_ID, 'tr-tr');
    expect(parsed?.title).toBe('Edge');
    expect(parsed?.price).toBe('99,00 TL');
  });

  test('reads numeric Chihiro prices without display text', () => {
    const parsed = parsePlayStationChihiroResponse({ links: [
      { id: 'free-numeric', name: 'Free Numeric', default_sku: { price: 0 } },
      { id: 'paid-numeric', name: 'Paid Numeric', default_sku: { price: 12500 } },
    ] }, 'tr-tr');
    expect(parsed[0]?.price).toBe('Ücretsiz');
    expect(parsed[1]?.price).toBe('125,00 TL');
  });

  test('falls back after malformed embedded strings and absent JSON-LD', () => {
    const html = `<script type="application/json">${JSON.stringify({
      cache: { product: { id: PRODUCT_ID, __typename: 'Product', name: 'Fallback' } },
    })}</script><script>"priceOrText":"bad\\q"</script>`;
    const parsed = parsePlayStationProductHtml(html, PRODUCT_ID, 'tr-tr');
    expect(parsed?.title).toBe('Fallback');
    expect(parsed?.price).toBe('bad\\q');
  });

  test('returns an unknown price when every cache CTA lacks a purchasable price', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"No Offer"}</script>
      <script type="application/json">${JSON.stringify({ cache: {
        a: { __typename: 'GameCTA', id: PRODUCT_ID, type: 'OTHER' },
        b: { __typename: 'GameCTA', id: PRODUCT_ID, type: 'OTHER' },
      } })}</script>`;
    const parsed = parsePlayStationProductHtml(html, PRODUCT_ID, 'tr-tr');
    expect(parsed?.price).toBe('Bilinmiyor');
  });

  test('uses the unknown price label for Chihiro items without a SKU', () => {
    const parsed = parsePlayStationChihiroResponse({ links: [
      { id: 'unknown-price', name: 'Unknown Price' },
    ] }, 'tr-tr');
    expect(parsed[0]?.price).toBe('Bilinmiyor');
  });
});

describe('Chihiro parsing', () => {
  test('parses the live Chihiro catalog response and ignores add-ons', () => {
    const payload = {
      links: [
        {
          id: 'UP1001-CUSA00000_00-GAMEADDON0000000',
          name: 'Hades DLC',
          top_category: 'add_on',
          default_sku: { display_price: '0,00 TL', price: 0 },
        },
        {
          id: PRODUCT_ID,
          name: 'Hades',
          title_name: 'Hades',
          top_category: 'downloadable_game',
          default_sku: { display_price: '307,65 TL', price: 30765 },
          images: [
            { type: 10, url: 'https://image.api.playstation.com/hades-cover.jpg' },
            { type: 12, url: 'https://image.api.playstation.com/hades-shot.jpg' },
          ],
          metadata: { genre: { values: ['Action'] } },
          playable_platform: ['PS5'],
          provider_name: 'Supergiant Games',
        },
      ],
    };

    const parsed = parsePlayStationChihiroResponse(payload, 'tr-tr');
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toMatchObject({
      id: PRODUCT_ID,
      title: 'Hades',
      price: '307,65 TL',
      image_url: 'https://image.api.playstation.com/hades-cover.jpg',
      platforms: ['PS5'],
      is_add_on: false,
    });
  });

  test('treats Chihiro entitlement-only products as add-ons', () => {
    const payload = {
      links: [
        {
          id: 'entitlement-sku',
          name: 'Cyberpunk 2077',
          top_category: 'downloadable_game',
          default_sku: {
            display_price: 'Ücretsiz',
            price: 0,
            eligibilities: [
              {
                id: 'SIE-ENTITLEMENT-1',
                operand: 'IS_ACTIVE',
                operator: 'TRUE',
              },
            ],
          },
        },
        {
          id: 'paid-base-game',
          name: 'Cyberpunk 2077',
          top_category: 'downloadable_game',
          default_sku: {
            display_price: '2.799,00 TL',
            price: 279900,
            eligibilities: [],
          },
        },
      ],
    };

    const parsed = parsePlayStationChihiroResponse(payload, 'tr-tr');
    expect(parsed[0]?.is_add_on).toBeTrue();
    expect(parsed[1]?.is_add_on).toBeFalse();

  });
});
