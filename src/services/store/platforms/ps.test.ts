import { describe, expect, test } from 'bun:test';

import {
    cleanPsProductTitle,
    extractPsEdition,
    getPsSearchQueryCandidates,
    parsePlayStationChihiroResponse,
    parsePlayStationProductHtml,
    parsePlayStationSearchHtml,
    pickBestAvailablePlayStationProduct,
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
      description: 'Zindan macerasi',
      image_url: 'https://image.api.playstation.com/hades-cover.jpg',
      price: '307,65 TL',
      original_price: '879,00 TL',
      discount: '-65%',
      store_url: `https://store.playstation.com/tr-tr/product/${PRODUCT_ID}`,
      release_date: '2021-08-13T00:00:00Z',
      developers: ['Supergiant Games'],
      genres: ['Aksiyon'],
      screenshots: ['https://image.api.playstation.com/hades-shot.jpg'],
      videos: [
        {
          platform: 'ps',
          id: 'ps-video-0',
          url: 'https://vulcan.dl.playstation.net/hades-trailer.mp4',
        },
      ],
    });
  });

  test('prefers purchasable GTA V platform edition over unavailable exact title', () => {
    const products = [
      {
        id: 'unavailable',
        title: 'Grand Theft Auto V',
        price: 'Not available',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/unavailable',
      },
      {
        id: 'ps5',
        title: 'Grand Theft Auto V (PlayStation 5)',
        price: '699,50 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/ps5',
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, 'Grand Theft Auto V Enhanced');

    expect(picked?.id).toBe('ps5');
  });

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
          release_date: '2021-08-13T00:00:00Z',
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
      genres: ['Action'],
      is_add_on: false,
    });
    expect(pickBestAvailablePlayStationProduct(parsed, 'Hades')?.id).toBe(PRODUCT_ID);
  });

  test('parses a Chihiro container with screenshots and preview video', () => {
    const payload = {
      id: PRODUCT_ID,
      name: 'PS5® için Hades',
      title_name: 'Hades',
      default_sku: { display_price: '307,65 TL', price: 30765 },
      images: [{ type: 10, url: 'https://image.api.playstation.com/hades-cover.jpg' }],
      mediaList: {
        screenshots: [{ type: 'SCREENSHOT', url: 'https://image.api.playstation.com/hades-shot.jpg' }],
        previews: [{ type: 'PREVIEW', url: 'https://video.playstation.net/hades.mp4' }],
      },
      metadata: { genre: { values: ['Action'] } },
      playable_platform: ['PS5'],
    };

    expect(parsePlayStationChihiroResponse(payload, 'tr-tr', true)[0]).toMatchObject({
      title: 'Hades',
      screenshots: ['https://image.api.playstation.com/hades-shot.jpg'],
      videos: [{ platform: 'ps', url: 'https://video.playstation.net/hades.mp4' }],
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

  test('cleans Turkish edition, Director Cut, and console platform suffixes for title matching', () => {
    expect(cleanPsProductTitle('EA SPORTS FC™ 25 Standart Sürüm PS4 ve PS5')).toBe('EA SPORTS FC 25');
    expect(cleanPsProductTitle('Grand Theft Auto V (PS4™ ve PS5™)')).toBe('Grand Theft Auto V');
    expect(cleanPsProductTitle('The Witcher 3: Wild Hunt – Complete Edition')).toBe('The Witcher 3: Wild Hunt');
    expect(cleanPsProductTitle("Baldur's Gate 3 - Dijital Deluxe Sürümü")).toBe("Baldur's Gate 3");
    expect(cleanPsProductTitle('Ghost of Tsushima YÖNETMENİN SÜRÜMÜ')).toBe('Ghost of Tsushima');
    expect(cleanPsProductTitle("Death Stranding Director's Cut")).toBe('Death Stranding');
    expect(cleanPsProductTitle('Call of Duty®: Black Ops 6 - Cross-Gen Paketi')).toBe('Call of Duty: Black Ops 6');
    expect(cleanPsProductTitle('Monster Hunter Rise PS4/PS5')).toBe('Monster Hunter Rise');
  });

  test('treats Chihiro entitlement-only products as add-ons so base game is chosen', () => {
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

    const match = pickBestAvailablePlayStationProduct(parsed, 'Cyberpunk 2077');
    expect(match?.id).toBe('paid-base-game');
    expect(match?.price).toBe('2.799,00 TL');
  });

  test('prefers modern PS4/PS5 editions over legacy-only PS3 versions', () => {
    const products = [
      {
        id: 'ps3-version',
        title: 'Grand Theft Auto V',
        price: '119,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/ps3-version',
        platforms: ['PS3™'],
      },
      {
        id: 'ps5-crossgen',
        title: 'Grand Theft Auto V (PS4™ ve PS5™)',
        price: '1.399,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/ps5-crossgen',
        platforms: ['PS4', 'PS5'],
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, 'Grand Theft Auto V');
    expect(picked?.id).toBe('ps5-crossgen');
    expect(picked?.price).toBe('1.399,00 TL');
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

  test('does not match Part I when searching for Part II', () => {
    const products = [
      {
        id: 'part1',
        title: 'The Last of Us™ Part I',
        price: '3.449,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/part1',
        platforms: ['PS5'],
        is_add_on: false,
      },
      {
        id: 'part2',
        title: 'The Last of Us Part II',
        price: '1.749,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/part2',
        platforms: ['PS4'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, 'The Last of Us Part II Remastered');
    expect(picked?.id).toBe('part2');
  });

  test('matches Director Cut search query against Turkish Yönetmenin Sürümü', () => {
    const products = [
      {
        id: 'dc-ps5',
        title: 'Ghost of Tsushima YÖNETMENİN SÜRÜMÜ',
        price: '1.049,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/dc-ps5',
        platforms: ['PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, "Ghost of Tsushima Director's Cut");
    expect(picked?.id).toBe('dc-ps5');
  });

  test('prefers standard base game over digital deluxe edition when query does not specify edition (Demon\'s Souls)', () => {
    const products = [
      {
        id: 'deluxe',
        title: "Demon's Souls Dijital Deluxe Sürüm",
        price: '4.749,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/deluxe',
        platforms: ['PS5'],
        is_add_on: false,
      },
      {
        id: 'standard',
        title: 'Demon’s Souls',
        price: '619,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/standard',
        platforms: ['PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, "Demon's Souls");
    expect(picked?.id).toBe('standard');
    expect(picked?.price).toBe('619,00 TL');
  });

  test('selects digital deluxe edition when search query specifies deluxe', () => {
    const products = [
      {
        id: 'deluxe',
        title: "Demon's Souls Dijital Deluxe Sürüm",
        price: '4.749,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/deluxe',
        platforms: ['PS5'],
        is_add_on: false,
      },
      {
        id: 'standard',
        title: 'Demon’s Souls',
        price: '619,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/standard',
        platforms: ['PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, "Demon's Souls Dijital Deluxe Sürüm");
    expect(picked?.id).toBe('deluxe');
    expect(picked?.price).toBe('4.749,00 TL');
  });

  test('falls back to digital deluxe edition when it is the only purchasable version available', () => {
    const products = [
      {
        id: 'deluxe',
        title: "Demon's Souls Dijital Deluxe Sürüm",
        price: '4.749,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/deluxe',
        platforms: ['PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, "Demon's Souls");
    expect(picked?.id).toBe('deluxe');
  });

  test('prefers Standart Sürüm over Ultimate Sürüm for base game query', () => {
    const products = [
      {
        id: 'fc25-ultimate',
        title: 'EA SPORTS FC™ 25 Ultimate Sürüm PS4 ve PS5',
        price: '4.000,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/fc25-ultimate',
        platforms: ['PS4', 'PS5'],
        is_add_on: false,
      },
      {
        id: 'fc25-standard',
        title: 'EA SPORTS FC™ 25 Standart Sürüm PS4 ve PS5',
        price: '2.900,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/fc25-standard',
        platforms: ['PS4', 'PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, 'EA SPORTS FC 25');
    expect(picked?.id).toBe('fc25-standard');
    expect(picked?.price).toBe('2.900,00 TL');
  });

  test('prefers base game over bundle/pack editions when query does not specify bundle', () => {
    const products = [
      {
        id: 'bundle',
        title: 'Cyberpunk 2077 ve Phantom Liberty Paketi',
        price: '3.499,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/bundle',
        platforms: ['PS5'],
        is_add_on: false,
      },
      {
        id: 'base',
        title: 'Cyberpunk 2077',
        price: '2.799,00 TL',
        original_price: null,
        discount: '',
        image_url: '',
        store_url: 'https://store.playstation.com/tr-tr/product/base',
        platforms: ['PS5'],
        is_add_on: false,
      },
    ];

    const picked = pickBestAvailablePlayStationProduct(products, 'Cyberpunk 2077');
    expect(picked?.id).toBe('base');
    expect(picked?.price).toBe('2.799,00 TL');
  });

  test('extractPsEdition correctly categorizes Turkish and English edition variants', () => {
    expect(extractPsEdition("Demon's Souls")).toBe('base');
    expect(extractPsEdition('Demon’s Souls')).toBe('base');
    expect(extractPsEdition("Demon's Souls Standart Sürüm")).toBe('base');
    expect(extractPsEdition('EA SPORTS FC™ 25 Standart Sürüm PS4 ve PS5')).toBe('base');
    expect(extractPsEdition('Grand Theft Auto V (PS4™ ve PS5™)')).toBe('base');
    expect(extractPsEdition('Call of Duty®: Black Ops 6 - Cross-Gen Paketi')).toBe('base');

    expect(extractPsEdition("Demon's Souls Dijital Deluxe Sürüm")).toBe('deluxe');
    expect(extractPsEdition("Baldur's Gate 3 - Dijital Deluxe Sürümü")).toBe('deluxe');
    expect(extractPsEdition('Hogwarts Legacy: Dijital Lüks Sürüm')).toBe('deluxe');
    expect(extractPsEdition('EA SPORTS FC™ 25 Ultimate Sürüm PS4 ve PS5')).toBe('ultimate');
    expect(extractPsEdition('Ghost of Tsushima YÖNETMENİN SÜRÜMÜ')).toBe('directors_cut');
    expect(extractPsEdition("Ghost of Tsushima Director's Cut")).toBe('directors_cut');
    expect(extractPsEdition('The Witcher 3: Wild Hunt – Complete Edition')).toBe('complete');
    expect(extractPsEdition('Resident Evil 4 Gold Edition')).toBe('gold');
    expect(extractPsEdition('Call of Duty®: Black Ops 6 - Kasa Sürümü')).toBe('vault');
    expect(extractPsEdition('Grand Theft Auto V: Premium Edition')).toBe('premium');
    expect(extractPsEdition('Cyberpunk 2077 ve Phantom Liberty Paketi')).toBe('bundle');
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
});
