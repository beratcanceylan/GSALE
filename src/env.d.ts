declare namespace NodeJS {
  interface ProcessEnv {
    /** GitHub release download base for the game catalog, e.g. https://github.com/<owner>/<repo>/releases/download/catalog-latest */
    EXPO_PUBLIC_CATALOG_BASE_URL?: string | undefined;
  }
}
