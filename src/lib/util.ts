import { XMLParser } from "fast-xml-parser";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import {
  AffirmedXmlConfigurationType,
  cliOptionsType,
  PostmanCollectionFolderType,
  PostmanCollectionItemType,
  PostmanEnvironmentFileType,
  PostmanVariableValueType,
  VariableConfigurationType,
  XmlConfigurationType,
  XpgConfigurationType,
} from "../types";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

// XML parser setup
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
});

export const loadConfig = async (file: string) => {
  const configPath = pathToFileURL(resolve(file)).href;
  const importchanges = await import(configPath);
  const { default: configurations } = importchanges;
  return configurations;
};

const normalizeVariables = (
  variables: XpgConfigurationType["variables"] = {}
): VariableConfigurationType[] => {
  if (Array.isArray(variables)) {
    return variables;
  }

  return Object.entries(variables).map(([name, value]) => ({
    type: "collection" as const,
    name,
    value,
    valueType: "default" as const,
    enabled: true,
  }));
};

const formVariableLookup = (variables: VariableConfigurationType[]) =>
  variables.reduce<Record<string, string>>((lookup, variable) => {
    lookup[variable.name] = variable.type === "collection" ? variable.value : "";
    return lookup;
  }, {});

const getVariableOrBasePath = (
  basePath: string,
  variables: Record<string, string>
) => {
  return basePath && Object.prototype.hasOwnProperty.call(variables, basePath)
    ? `{{${basePath}}}`
    : basePath;
};

const findFiles = (
  dir: string,
  callback: (dir: string, file: string) => boolean | void
) => {
  const files = readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = join(dir, file.name);
    if (file.isDirectory()) {
      findFiles(fullPath, callback);
    } else {
      let toContinue = callback(dir, file.name);
      if (toContinue === false) {
        continue;
      }
    }
  }
};

const formUrlFields = (basePath: string, path: string, method: string) => {
  let url = [basePath, path, method].join("/");
  let host = [basePath];
  let paths = [path, method];
  return {
    url,
    host,
    paths,
  };
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const localName = (value = "") => value.split(":").pop() ?? value;

const isMandatory = (value: unknown) => value === true || value === "true";

const isRepeated = (node: Record<string, any>) => {
  const maxOccurs = node.maxOccurs;
  return maxOccurs === "unbounded" || Number(maxOccurs) > 1;
};

const formQueryParams = (method: any, queryTag: string) => {
  return asArray(method[queryTag])
    .filter((param: any) => param && typeof param === "object" && param.name)
    .map((param: any) => ({
      key: param.name,
      value: "",
      disabled: !isMandatory(param.mandatory),
    }));
};

type SchemaDefinition = {
  namespace: string;
  namespaces: Record<string, string>;
  node: Record<string, any>;
};

type SchemaIndex = {
  elements: Map<string, SchemaDefinition>;
  complexTypes: Map<string, SchemaDefinition>;
  simpleTypes: Map<string, SchemaDefinition>;
  groups: Map<string, SchemaDefinition>;
};

type SchemaReference = {
  namespace?: string;
  name: string;
};

const schemaKey = (namespace: string | undefined, name: string) =>
  `${namespace ?? ""}|${localName(name)}`;

const readSchemaNamespaces = (schema: Record<string, any>) => {
  const namespaces: Record<string, string> = {
    xsd: XSD_NAMESPACE,
    xs: XSD_NAMESPACE,
  };

  for (const [key, value] of Object.entries(schema)) {
    if (key === "xmlns") {
      namespaces[""] = String(value);
    } else if (key.startsWith("xmlns:")) {
      namespaces[key.slice("xmlns:".length)] = String(value);
    }
  }

  return namespaces;
};

const resolveQName = (
  qname: string | undefined,
  namespaces: Record<string, string>,
  defaultNamespace?: string
): SchemaReference | undefined => {
  if (!qname) {
    return undefined;
  }

  const [prefix, name] = qname.includes(":")
    ? qname.split(":", 2)
    : ["", qname];

  return {
    namespace: namespaces[prefix] ?? (prefix === "" ? defaultNamespace : undefined),
    name,
  };
};

const expandSchemaSources = (sources: string | string[] | undefined) => {
  if (!sources) {
    return [];
  }

  const files: string[] = [];
  const pending = asArray(sources);

  for (const source of pending) {
    const sourcePath = resolve(source);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      findFiles(sourcePath, (dir, file) => {
        if (extname(file) === ".xsd") {
          files.push(join(dir, file));
        }
      });
    } else if (stat.isFile() && extname(sourcePath) === ".xsd") {
      files.push(sourcePath);
    }
  }

  return files;
};

const addDefinitions = (
  target: Map<string, SchemaDefinition>,
  namespace: string,
  namespaces: Record<string, string>,
  nodes: Record<string, any>[]
) => {
  for (const node of nodes) {
    if (!node?.name) {
      continue;
    }

    target.set(schemaKey(namespace, node.name), {
      namespace,
      namespaces,
      node,
    });
  }
};

const buildSchemaIndex = (sources: string | string[] | undefined) => {
  const files = expandSchemaSources(sources);
  if (files.length === 0) {
    return undefined;
  }

  const index: SchemaIndex = {
    elements: new Map(),
    complexTypes: new Map(),
    simpleTypes: new Map(),
    groups: new Map(),
  };

  for (const file of files) {
    const content = parser.parse(readFileSync(file, "utf-8"));
    const schema = content["xsd:schema"] ?? content["xs:schema"] ?? content.schema;
    if (!schema) {
      continue;
    }

    const namespace = schema.targetNamespace ?? "";
    const namespaces = readSchemaNamespaces(schema);
    addDefinitions(index.elements, namespace, namespaces, asArray(schema["xsd:element"] ?? schema["xs:element"]));
    addDefinitions(index.complexTypes, namespace, namespaces, asArray(schema["xsd:complexType"] ?? schema["xs:complexType"]));
    addDefinitions(index.simpleTypes, namespace, namespaces, asArray(schema["xsd:simpleType"] ?? schema["xs:simpleType"]));
    addDefinitions(index.groups, namespace, namespaces, asArray(schema["xsd:group"] ?? schema["xs:group"]));
  }

  return index;
};

const mergeSchemaSources = (
  globalSources: string | string[] | undefined,
  moduleSources: string | string[] | undefined
) => [...asArray(globalSources), ...asArray(moduleSources)];

const findDefinition = (
  definitions: Map<string, SchemaDefinition>,
  ref: SchemaReference | undefined
) => {
  if (!ref) {
    return undefined;
  }

  return (
    definitions.get(schemaKey(ref.namespace, ref.name)) ??
    definitions.get(schemaKey(undefined, ref.name))
  );
};

const getChild = (node: Record<string, any>, childName: string) =>
  node[`xsd:${childName}`] ?? node[`xs:${childName}`] ?? node[childName];

const getParticleNodes = (node: Record<string, any>) => {
  const particles: Record<string, any>[] = [];

  for (const containerName of ["sequence", "choice", "all"]) {
    for (const container of asArray(getChild(node, containerName))) {
      particles.push(...asArray(getChild(container, "element")));
      particles.push(...asArray(getChild(container, "group")));
      particles.push(...getParticleNodes(container));
    }
  }

  particles.push(...asArray(getChild(node, "element")));
  particles.push(...asArray(getChild(node, "group")));
  return particles;
};

const getRestriction = (node: Record<string, any>) => getChild(node, "restriction");

const sampleForBuiltin = (typeName: string) => {
  switch (localName(typeName)) {
    case "boolean":
      return false;
    case "byte":
    case "decimal":
    case "double":
    case "float":
    case "int":
    case "integer":
    case "long":
    case "negativeInteger":
    case "nonNegativeInteger":
    case "nonPositiveInteger":
    case "positiveInteger":
    case "short":
    case "unsignedByte":
    case "unsignedInt":
    case "unsignedLong":
    case "unsignedShort":
      return 0;
    default:
      return "";
  }
};

const buildSimpleTypeSample = (
  definition: SchemaDefinition,
  index: SchemaIndex,
  seen: Set<string>
): any => {
  const restriction = getRestriction(definition.node);
  const firstEnumeration = asArray(getChild(restriction ?? {}, "enumeration"))[0];
  if (firstEnumeration?.value !== undefined) {
    return firstEnumeration.value;
  }

  const baseRef = resolveQName(
    restriction?.base,
    definition.namespaces,
    definition.namespace
  );
  return buildTypeSample(baseRef, index, seen);
};

const buildGroupSample = (
  definition: SchemaDefinition,
  index: SchemaIndex,
  seen: Set<string>
) => buildObjectFromParticles(getParticleNodes(definition.node), definition, index, seen);

const buildObjectFromParticles = (
  particles: Record<string, any>[],
  definition: SchemaDefinition,
  index: SchemaIndex,
  seen: Set<string>
) => {
  const sample: Record<string, any> = {};

  for (const particle of particles) {
    if (particle.ref && !particle.name) {
      const groupRef = resolveQName(particle.ref, definition.namespaces, definition.namespace);
      const group = findDefinition(index.groups, groupRef);
      if (group) {
        const value = buildGroupSample(group, index, seen);
        Object.assign(sample, Array.isArray(value) ? value[0] ?? {} : value);
      }
      continue;
    }

    if (!particle.name) {
      continue;
    }

    sample[particle.name] = buildElementSample(
      { ...definition, node: particle },
      index,
      seen
    );
  }

  return sample;
};

const buildComplexTypeSample = (
  definition: SchemaDefinition,
  index: SchemaIndex,
  seen: Set<string>
): any => {
  const complexContent = getChild(definition.node, "complexContent");
  const extension = getChild(complexContent ?? {}, "extension");
  const baseRef = resolveQName(extension?.base, definition.namespaces, definition.namespace);
  const baseValue = baseRef ? buildTypeSample(baseRef, index, seen) : {};
  const contentNode = extension ?? definition.node;
  const directGroups = asArray(getChild(contentNode, "group"));
  const particles = getParticleNodes(contentNode);

  if (directGroups.length === 1 && particles.length === 1 && isRepeated(directGroups[0])) {
    const groupRef = resolveQName(directGroups[0].ref, definition.namespaces, definition.namespace);
    const group = findDefinition(index.groups, groupRef);
    return [group ? buildGroupSample(group, index, seen) : {}];
  }

  const currentValue = buildObjectFromParticles(particles, definition, index, seen);
  return {
    ...(typeof baseValue === "object" && !Array.isArray(baseValue) ? baseValue : {}),
    ...currentValue,
  };
};

function buildTypeSample(
  ref: SchemaReference | undefined,
  index: SchemaIndex,
  seen: Set<string>
): any {
  if (!ref) {
    return "";
  }

  if (ref.namespace === XSD_NAMESPACE || ref.name.startsWith("xsd:")) {
    return sampleForBuiltin(ref.name);
  }

  const key = schemaKey(ref.namespace, ref.name);
  if (seen.has(key)) {
    return {};
  }

  const complexType = findDefinition(index.complexTypes, ref);
  if (complexType) {
    seen.add(key);
    const sample = buildComplexTypeSample(complexType, index, seen);
    seen.delete(key);
    return sample;
  }

  const simpleType = findDefinition(index.simpleTypes, ref);
  if (simpleType) {
    seen.add(key);
    const sample = buildSimpleTypeSample(simpleType, index, seen);
    seen.delete(key);
    return sample;
  }

  const element = findDefinition(index.elements, ref);
  if (element) {
    return buildElementSample(element, index, seen);
  }

  return "";
}

const buildElementSample = (
  definition: SchemaDefinition,
  index: SchemaIndex,
  seen: Set<string>
): any => {
  const element = definition.node;
  let sample: any;

  if (element.type) {
    sample = buildTypeSample(
      resolveQName(element.type, definition.namespaces, definition.namespace),
      index,
      seen
    );
  } else if (getChild(element, "complexType")) {
    sample = buildComplexTypeSample(
      { ...definition, node: getChild(element, "complexType") },
      index,
      seen
    );
  } else if (getChild(element, "simpleType")) {
    sample = buildSimpleTypeSample(
      { ...definition, node: getChild(element, "simpleType") },
      index,
      seen
    );
  } else if (element.ref) {
    sample = buildElementFromReference(
      resolveQName(element.ref, definition.namespaces, definition.namespace),
      index
    );
  } else {
    sample = "";
  }

  return isRepeated(element) ? [sample] : sample;
};

const buildElementFromReference = (
  ref: SchemaReference | undefined,
  index: SchemaIndex | undefined
) => {
  if (!index || !ref) {
    return undefined;
  }

  const element = findDefinition(index.elements, ref);
  if (!element) {
    return undefined;
  }

  return buildElementSample(element, index, new Set());
};

const buildPayloadSample = (
  nodeOrNodes: any,
  index: SchemaIndex | undefined
) => {
  if (!index || !nodeOrNodes) {
    return undefined;
  }

  const nodes = asArray(nodeOrNodes).filter((node: any) => node?.name);
  if (nodes.length === 0) {
    return undefined;
  }

  if (nodes.length === 1) {
    return buildElementFromReference(
      { namespace: nodes[0].namespace, name: nodes[0].name },
      index
    );
  }

  return nodes.reduce<Record<string, any>>((payload, node: any) => {
    payload[node.name] = buildElementFromReference(
      { namespace: node.namespace, name: node.name },
      index
    );
    return payload;
  }, {});
};

const formJsonRequestBody = (sample: any) => ({
  mode: "raw" as const,
  raw: JSON.stringify(sample, null, 2),
  options: {
    raw: {
      language: "json" as const,
    },
  },
});

const formExampleResponse = (
  request: PostmanCollectionItemType["request"],
  methodName: string,
  sample: any
) => ({
  name: `${methodName} response`,
  originalRequest: request,
  status: "OK",
  code: 200,
  header: [
    {
      key: "Content-Type",
      value: "application/json",
    },
  ],
  body: JSON.stringify(sample, null, 2),
});

const formIndividualRequest = (
  interfaceData: any,
  method: any,
  basePath: string,
  xmlConfig: AffirmedXmlConfigurationType,
  schemaIndex?: SchemaIndex
): PostmanCollectionItemType => {
  const params = formQueryParams(method, xmlConfig.queryTag);
  const inputSample = buildPayloadSample(method.input, schemaIndex);
  const outputSample = buildPayloadSample(method.output, schemaIndex);

  let partialUrl = formUrlFields(basePath, interfaceData.name, method.name);
  const request: PostmanCollectionItemType["request"] = {
    method: method.http_method,
    header: [],
    url: {
      raw: partialUrl.url,
      host: partialUrl.host,
      path: partialUrl.paths,
      query: params,
    },
    description: method.documentation ?? "",
  };

  if (inputSample !== undefined) {
    request.header.push({
      key: "Content-Type",
      value: "application/json",
    });
    request.body = formJsonRequestBody(inputSample);
  }

  return {
    name: method.name,
    request,
    response:
      outputSample === undefined
        ? []
        : [formExampleResponse(request, method.name, outputSample)],
  };
};

const convertXmlToJson = (filePath: string) => {
  try {
    const xmlContent = readFileSync(filePath, "utf-8");
    const jsonContent = parser.parse(xmlContent);
    return jsonContent;
  } catch (error) {
    throw new Error(`Error reading file contents of xml ${filePath}`);
  }
};

const getDefaultXmlConfig = (): AffirmedXmlConfigurationType => {
  return {
    interfaceTag: ["ns:interface"],
    methodTag: ["method"],
    queryTag: "query_param",
  };
};

const processXmlConfig = (
  xmlConfig: Partial<XmlConfigurationType>
): AffirmedXmlConfigurationType => {
  const defaultConfigurations = getDefaultXmlConfig();
  return {
    ...defaultConfigurations,
    ...xmlConfig,
  } as AffirmedXmlConfigurationType;
};

type extractJsonContentsType =
  | undefined
  | {
      interfaceData: Record<string, any>;
      methodData: any[];
    };
const extractJsonContents = (
  jsonContent: any,
  xmlConfig: AffirmedXmlConfigurationType,
  file: string,
  verbose: boolean
): extractJsonContentsType => {
  let interfaceData = null,
    methodData = null;

  for (let validInterfaceTag of xmlConfig.interfaceTag) {
    if (jsonContent[validInterfaceTag]) {
      interfaceData = jsonContent[validInterfaceTag];
      for (let validMethodTag of xmlConfig.methodTag) {
        if (interfaceData[validMethodTag]) {
          methodData = interfaceData[validMethodTag];
        }
      }
    }
  }

  if (interfaceData === null) {
    if (verbose) {
      console.error(
        `Warning: Skipping file '${file}', no <${xmlConfig.interfaceTag.join(
          ", "
        )}> found!`
      );
    }
    return undefined;
  } else if (!interfaceData.name) {
    if (verbose) {
      console.error(
        `Warning: Skipping file '${file}', no 'name' property for <${xmlConfig.interfaceTag.join(
          " or "
        )}> found!`
      );
    }
    return undefined;
  }

  if (methodData === null) {
    if (verbose) {
      console.error(
        `Warning: Skipping file '${file}', no <${xmlConfig.methodTag.join(
          ", "
        )}> found!`
      );
    }
    return undefined;
  }

  return {
    interfaceData,
    methodData,
  };
};

const formPostmanCollectionInfo = ({
  name,
  version,
}: Pick<XpgConfigurationType, "name" | "version">) => {
  return {
    name,
    schema: `https://schema.getpostman.com/json/collection/v${version}.0/collection.json`,
  };
};

interface PostmanCollectionType {
  info: Record<"name" | "schema", string>;
  item: PostmanCollectionFolderType[];
  variable?: { key: string; value: string }[];
}

const POSTMAN_EXPORTER = "xml-to-postman";

const valueForEnvironment = (
  variable: Extract<VariableConfigurationType, { type: "environment" }>,
  environment: string
) => variable.values[environment] ?? "";

const formPostmanVariableValue = (
  variable: VariableConfigurationType,
  value: string
): PostmanVariableValueType => ({
  key: variable.name,
  value,
  type: variable.valueType ?? "default",
  ...(variable.description ? { description: variable.description } : {}),
  enabled: variable.enabled ?? true,
});

const formCollectionVariables = (variables: VariableConfigurationType[]) =>
  variables
    .filter((variable) => variable.type === "collection")
    .map((variable) => ({
      key: variable.name,
      value: variable.value,
    }));

export const formPostmanEnvironmentFiles = (
  configuration: XpgConfigurationType
): Array<{ fileName: string; content: PostmanEnvironmentFileType }> => {
  const variables = normalizeVariables(configuration.variables);
  const environmentVariables = variables.filter(
    (variable): variable is Extract<VariableConfigurationType, { type: "environment" }> =>
      variable.type === "environment"
  );

  if (environmentVariables.length === 0) {
    return [];
  }

  const environments = Array.from(
    new Set(environmentVariables.flatMap((variable) => Object.keys(variable.values)))
  );
  const exportedAt = new Date().toISOString();
  return environments.map((environment) => ({
    fileName: `${environment}.environment.json`,
    content: {
      id: randomUUID(),
      name: environment,
      values: environmentVariables
        .filter((variable) => Object.prototype.hasOwnProperty.call(variable.values, environment))
        .map((variable) =>
          formPostmanVariableValue(
            variable,
            valueForEnvironment(variable, environment)
          )
        ),
      _postman_variable_scope: "environment",
      _postman_exported_at: exportedAt,
      _postman_exported_using: POSTMAN_EXPORTER,
    },
  }));
};

const resolveModuleFolderName = (moduleConfig: {
  folder?: string | boolean;
  name?: string;
  prefix?: string;
}) => {
  if (typeof moduleConfig.folder === "string") {
    return moduleConfig.folder;
  }

  if (moduleConfig.folder === false) {
    return undefined;
  }

  return moduleConfig.name || moduleConfig.prefix;
};

const getOrCreateFolder = (
  folders: PostmanCollectionFolderType[],
  name: string
) => {
  let folder = folders.find((candidate) => candidate.name === name);
  if (!folder) {
    folder = { name, item: [], event: [] };
    folders.push(folder);
  }

  return folder;
};

export const formServiceRoutines = ({
  configuration,
  cliOptions,
}: {
  configuration: XpgConfigurationType;
  cliOptions: cliOptionsType;
}) => {
  try {
    const {
      name,
      version,
      variables = {},
      modules = [],
      xml = {},
      postman = {},
      schemas,
    } = configuration;
    const normalizedVariables = normalizeVariables(variables);
    const variableLookup = formVariableLookup(normalizedVariables);
    let xmlConfig = xml;
    if (xmlConfig === undefined) {
      xmlConfig = getDefaultXmlConfig();
    } else {
      xmlConfig = processXmlConfig(xmlConfig);
    }

    const serviceRoutines: PostmanCollectionType = {
      info: formPostmanCollectionInfo({ name, version }),
      item: [],
    };

    for (const configs of modules) {
      const { directory, baseUrl } = configs;
      const schemaIndex = buildSchemaIndex(
        mergeSchemaSources(schemas, configs.schemas)
      );
      const moduleFolderName =
        postman?.moduleFolders || configs.folder !== undefined
          ? resolveModuleFolderName(configs)
          : undefined;
      const moduleFolder = moduleFolderName
        ? getOrCreateFolder(serviceRoutines.item, moduleFolderName)
        : undefined;
      const folderTarget = moduleFolder
        ? (moduleFolder.item as PostmanCollectionFolderType[])
        : serviceRoutines.item;

      findFiles(directory, (dir: string, file: string) => {
        const filePath = join(dir, file);
        const relativeDirectoryFromPath = relative(directory, dir);

        if (extname(file) === ".xml") {
          if (cliOptions.verbose) {
            console.log("processing xml file:", filePath);
          }
          const jsonContent = convertXmlToJson(filePath);
          const extractedContents = extractJsonContents(
            jsonContent,
            xmlConfig as AffirmedXmlConfigurationType,
            file,
            cliOptions.verbose
          );

          // returns from callback and continues the loop
          if (extractedContents === undefined) {
            return false;
          }
          const { interfaceData = {}, methodData = [] } = extractedContents;

          // forming folders and appointing each methods of the interface to the item array.
          let folderName = interfaceData.name as string;
          if (relativeDirectoryFromPath !== "") {
            folderName = join(relativeDirectoryFromPath, folderName);
          }

          let record: PostmanCollectionFolderType = {
            name: folderName,
            item: [],
            event: [],
          };

          if (Array.isArray(methodData) && methodData.length > 0) {
            methodData.forEach((method) => {
              let basePath = getVariableOrBasePath(baseUrl, variableLookup);
              let rec = formIndividualRequest(
                interfaceData,
                method,
                basePath,
                xmlConfig as AffirmedXmlConfigurationType,
                schemaIndex
              );

              record.item.push(rec);
            });
          } else if (typeof methodData === "object") {
            let basePath = getVariableOrBasePath(baseUrl, variableLookup);
            let rec = formIndividualRequest(
              interfaceData,
              methodData,
              basePath,
              xmlConfig as AffirmedXmlConfigurationType,
              schemaIndex
            );

            record.item.push(rec);
          }
          folderTarget.push(record);
        }
      });
    }

    const collectionVariables = formCollectionVariables(normalizedVariables);
    if (collectionVariables.length > 0) {
      serviceRoutines.variable = collectionVariables;
    }

    return serviceRoutines;
  } catch (error) {
    console.error(error);
  }
};
