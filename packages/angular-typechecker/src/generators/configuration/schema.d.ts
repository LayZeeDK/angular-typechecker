export interface ConfigurationGeneratorSchema {
  project: string;
  tsConfig?: string;
  targetName?: string;
  skipFormat?: boolean;
}
