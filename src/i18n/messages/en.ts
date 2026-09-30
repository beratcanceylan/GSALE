/** Source catalog: every other language must provide exactly these keys and placeholders. */
export const en = {
  'tabs.home': 'Home',
  'tabs.search': 'Search',
  'tabs.favorites': 'Favorites',
  'tabs.free': 'Free',
  'tabs.settings': 'Settings',

  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.close': 'Close',
  'common.clear': 'Clear',
  'common.loading': 'Loading…',

  'home.popular': 'Popular',
  'home.empty': 'No games to show right now.',
  'home.loading': 'Loading popular games…',

  'search.placeholder': 'Search games',
  'search.hint': 'Type at least 2 letters.',
  'search.empty': 'No games found for “{query}”.',
  'search.resultCount.one': '{count} game',
  'search.resultCount.other': '{count} games',
  'search.loading': 'Searching every store…',

  'free.title': 'Free right now',
  'free.empty': 'No free games right now.',
  'free.loading': 'Loading free games…',
  'free.upcoming': 'Free next',
  'free.poweredBy': 'Giveaways by {source}',

  'favorites.title': 'Favorites',
  'favorites.empty': 'Games you favorite appear here.',
  'favorites.add': 'Add to favorites',
  'favorites.remove': 'Remove from favorites',
  'favorites.search': 'Search favorites',
  'favorites.noMatch': 'No favorites match “{query}”.',

  'detail.loading': 'Checking prices…',
  'detail.error': 'Could not load this game.',
  'detail.notFound': 'Game not found.',
  'detail.editions': 'Editions',
  'detail.prices': 'Prices',
  'detail.lowest': 'Lowest',
  'detail.notSoldHere': 'Not sold in this edition',
  'detail.noPrices': 'No store sells this edition right now.',
  'detail.openStore': 'Open {store}',
  'detail.cover': '{title} cover',

  'edition.base': 'Standard',
  'edition.deluxe': 'Deluxe',
  'edition.ultimate': 'Ultimate',
  'edition.gold': 'Gold',
  'edition.goty': 'Game of the Year',
  'edition.complete': 'Complete',
  'edition.definitive': 'Definitive',
  'edition.premium': 'Premium',
  'edition.collector': 'Collector’s',
  'edition.special': 'Special',
  'edition.anniversary': 'Anniversary',
  'edition.directors-cut': 'Director’s Cut',
  'edition.enhanced': 'Enhanced',
  'edition.legendary': 'Legendary',
  'edition.champion': 'Champion',
  'edition.vault': 'Vault',

  'price.free': 'Free',
  'price.unknown': 'Price unavailable',
  'price.gamePass': 'Game Pass',
  'price.was': 'was {price}',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.country': 'Country',
  'settings.countryHint': 'Prices come from this country’s stores.',
  'settings.about': 'About',
  'settings.version': 'Version {version}',
  'settings.disclaimer': 'Prices are read from the stores and converted to Turkish lira. Always check the store before buying.',
  'settings.restartTitle': 'Restart required',
  'settings.restartBody': 'Close and reopen GSale to switch the layout direction.',
  'settings.searchLanguages': 'Search languages',
  'settings.searchCountries': 'Search countries',

  'notifications.title': 'Notifications',
  'notifications.empty': 'Price-drop and free-game alerts are coming soon.',

  'country.TR': 'Türkiye',
  'country.US': 'United States',
  'country.GB': 'United Kingdom',
  'country.DE': 'Germany',
  'country.FR': 'France',
  'country.NL': 'Netherlands',
  'country.PL': 'Poland',
  'country.UA': 'Ukraine',
  'country.KZ': 'Kazakhstan',
  'country.AR': 'Argentina',
  'country.BR': 'Brazil',
  'country.CA': 'Canada',
  'country.AU': 'Australia',
  'country.JP': 'Japan',
  'country.IN': 'India',
} as const;

export type MessageKey = keyof typeof en;

/** Extra CLDR plural forms some languages need beyond English "one"/"other". */
export type PluralExtraKey =
  | 'search.resultCount.zero'
  | 'search.resultCount.two'
  | 'search.resultCount.few'
  | 'search.resultCount.many';

export type Messages = { readonly [K in MessageKey]: string } & Partial<Record<PluralExtraKey, string>>;
