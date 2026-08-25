import { setWorldConstructor, World as CucumberWorld, type IWorldOptions } from "@cucumber/cucumber";
import type { Browser, BrowserContext, Page } from "@playwright/test";

export class E2EWorld extends CucumberWorld {
  browser!: Browser;
  /** The authenticated "organizer" who sets up the game — see hooks.ts's Before. */
  context!: BrowserContext;
  page!: Page;
  /** Only created by the "anonymous visitor" step — a genuinely separate, unauthenticated
   *  browser session following the game's share link, distinct from `context`/`page` above. */
  anonymousContext?: BrowserContext;
  anonymousPage?: Page;
  gameUrl = "";

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(E2EWorld);
