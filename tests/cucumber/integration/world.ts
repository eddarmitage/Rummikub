import { setWorldConstructor, World as CucumberWorld, type IWorldOptions } from "@cucumber/cucumber";

export class IntegrationWorld extends CucumberWorld {
  gameId = "";
  playerIdByName = new Map<string, string>();

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(IntegrationWorld);
