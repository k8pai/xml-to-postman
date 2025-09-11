import z from "zod";

export const XmlConfigurationSchema = z.object({
  interfaceTag: z
    .union([z.string().transform((val) => [val]), z.array(z.string())])
    .optional(),
  methodTag: z
    .union([z.string().transform((val) => [val]), z.array(z.string())])
    .optional(),
  queryTag: z.string().default("query_param").optional(),
});

export const XpgConfigurationSchema = z.object({
  name: z.string(),
  version: z.enum(["2.0", "2.1"]),
  modules: z.array(
    z.object({
      prefix: z.string().or(z.undefined()),
      name: z.string().or(z.undefined()),
      directory: z.string(),
      baseUrl: z.string(),
    })
  ),
  variables: z.record(z.string(), z.string()),
  xml: XmlConfigurationSchema.optional(),
});

export type XpgConfigurationType = z.infer<typeof XpgConfigurationSchema>;

export type XmlConfigurationType = z.infer<typeof XmlConfigurationSchema>;
export type AffirmedXmlConfigurationType = {
  [key in keyof XmlConfigurationType]-?: XmlConfigurationType[key];
};

export interface ModuleConfigurationType {
  prefix: string;
  name: string;
  baseUrl: string;
  directory: string;
}

export interface queryParamsType {
  key: string;
  value: string;
  disabled: boolean;
}

export interface PostmanCollectionItemType {
  name: string;
  request: {
    method: string;
    header: any[];
    url: {
      raw: string;
      host: string[];
      path: string[];
      query: queryParamsType[];
    };
    description: string;
  };
  response: any[];
}

export interface PostmanCollectionEventType {
  listen: "prerequest" | "postrequest";
  script: {
    type: "text/javascript" | string;
    packages: Record<string, any>;
    exec: string[];
  };
}
export interface PostmanCollectionFolderType {
  name: string;
  item: PostmanCollectionItemType[];
  event?: any[];
}

export interface cliOptionsType {
  config: string;
  outfile: string;
  verbose: boolean;
  help: boolean;
}
