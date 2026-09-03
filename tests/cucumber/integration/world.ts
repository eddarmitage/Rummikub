import { setWorldConstructor, World as CucumberWorld, type IWorldOptions } from "@cucumber/cucumber";

export class IntegrationWorld extends CucumberWorld {
  gameId = "";
  playerIdByName = new Map<string, string>();
  /** The response to the last "add player" request — set by steps that expect it to fail. */
  lastPlayerResponse?: Response;
  /** The response to the last "add round" request — set by steps that expect it to fail. */
  lastRoundResponse?: Response;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(IntegrationWorld);
