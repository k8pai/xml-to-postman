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

export const SchemaSourceSchema = z.union([
  z.string(),
  z.array(z.string()),
]);

export const PostmanConfigurationSchema = z
  .object({
    moduleFolders: z.boolean().default(false).optional(),
    outputDirectory: z.string().default("postman_collection").optional(),
  })
  .optional();


export const VariableScopeSchema = z.enum(["collection", "environment"]);
export const PostmanVariableValueTypeSchema = z.enum(["default", "secret"]);

const BaseVariableConfigurationSchema = z.object({
  name: z.string(),
  valueType: PostmanVariableValueTypeSchema.default("default").optional(),
  description: z.string().optional(),
  enabled: z.boolean().default(true).optional(),
});

export const CollectionVariableConfigurationSchema =
  BaseVariableConfigurationSchema.extend({
    type: z.literal("collection"),
    value: z.string(),
  }).strict();

export const EnvironmentVariableConfigurationSchema =
  BaseVariableConfigurationSchema.extend({
    type: z.literal("environment"),
    values: z.record(z.string(), z.string()),
  }).strict();

export const VariableConfigurationSchema = z.discriminatedUnion("type", [
  CollectionVariableConfigurationSchema,
  EnvironmentVariableConfigurationSchema,
]);

export const VariablesConfigurationSchema = z.union([
  z.record(z.string(), z.string()),
  z.array(VariableConfigurationSchema),
]);

export const XpgConfigurationSchema = z.object({
  name: z.string(),
  version: z.enum(["2.0", "2.1"]),
  modules: z.array(
    z.object({
      prefix: z.string().or(z.undefined()),
      name: z.string().or(z.undefined()),
      folder: z.string().or(z.boolean()).optional(),
      directory: z.string(),
      baseUrl: z.string(),
      schemas: SchemaSourceSchema.optional(),
    })
  ),
  variables: VariablesConfigurationSchema,
  xml: XmlConfigurationSchema.optional(),
  postman: PostmanConfigurationSchema,
  schemas: SchemaSourceSchema.optional(),
});

export type XpgConfigurationType = z.infer<typeof XpgConfigurationSchema>;
export type VariableScopeType = z.infer<typeof VariableScopeSchema>;
export type VariableConfigurationType = z.infer<typeof VariableConfigurationSchema>;

export type XmlConfigurationType = z.infer<typeof XmlConfigurationSchema>;
export type AffirmedXmlConfigurationType = {
  [key in keyof XmlConfigurationType]-?: XmlConfigurationType[key];
};

export interface ModuleConfigurationType {
  prefix: string;
  name: string;
  folder?: string | boolean;
  baseUrl: string;
  directory: string;
  schemas?: string | string[];
}

export interface queryParamsType {
  key: string;
  value: string;
  disabled: boolean;
}

export interface PostmanVariableValueType {
  key: string;
  value: string;
  type?: "default" | "secret";
  description?: string;
  enabled?: boolean;
}

export interface PostmanEnvironmentFileType {
  id: string;
  name: string;
  values: PostmanVariableValueType[];
  _postman_variable_scope: "environment";
  _postman_exported_at: string;
  _postman_exported_using: string;
}

export interface PostmanCollectionItemType {
  name: string;
  request: {
    method: string;
    header: any[];
    body?: {
      mode: "raw";
      raw: string;
      options: {
        raw: {
          language: "json";
        };
      };
    };
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
  item: Array<PostmanCollectionItemType | PostmanCollectionFolderType>;
  event?: any[];
}

export interface cliOptionsType {
  config: string;
  outfile: string;
  verbose: boolean;
  help: boolean;
}
