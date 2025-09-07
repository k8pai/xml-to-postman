import { XMLParser } from "fast-xml-parser";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import {
  AffirmedXmlConfigurationType,
  PostmanCollectionFolderType,
  PostmanCollectionItemType,
  XmlConfigurationType,
  XpgConfigurationType,
} from "../types";
import { pathToFileURL } from "node:url";
import { emitWarning } from "node:process";

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

const getVariableOrBasePath = (
  basePath: string,
  variables: Record<string, string>
) => {
  return basePath && variables[basePath] ? `{{${basePath}}}` : basePath;
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

const formEndpointPath = (
  basePath: string,
  interfaceName: string,
  methodName: string
) => {
  return `${basePath}/${interfaceName}/${methodName}`;
};

const formIndividualRequest = (
  interfaceData: any,
  method: any,
  basePath: string
): PostmanCollectionItemType => {
  const params: any[] = [];
  if (Array.isArray(method.query_param)) {
    method.query_param.forEach((param: any) => {
      params.push({
        key: param.name,
        value: "",
        disabled: param.mandatory === "false" ? true : false,
      });
    });
  } else if (method.query_param && typeof method.query_param === "object") {
    params.push({
      key: method.query_param.name,
      value: "",
      disabled: method.query_param.mandatory === "false" ? true : false,
    });
  }

  let urlPath = formEndpointPath(basePath, interfaceData.name, method.name);
  return {
    name: method.name,
    request: {
      method: method.http_method,
      header: [],
      url: {
        raw: urlPath,
        host: [basePath],
        path: [interfaceData.name, method.name],
        query: params,
      },
      description: "",
    },
    response: [],
  };
};

const convertXmlToJson = (filePath: string) => {
  try {
    const xmlContent = readFileSync(filePath, "utf-8");
    const jsonContent = parser.parse(xmlContent);
    return jsonContent;
  } catch (error) {
    throw new Error(`Error reading file contents of xml ${filePath}`);
    return undefined;
  }
};

const getDefaultXmlConfig = (): AffirmedXmlConfigurationType => {
  return {
    interfaceTag: "ns:interface",
    methodTag: "method",
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
  file: string
): extractJsonContentsType => {
  let interfaceData = jsonContent[xmlConfig.interfaceTag];

  if (!interfaceData || !interfaceData.name) {
    console.error(
      `Warning: Skipping file '${file}', no <${xmlConfig.interfaceTag}> found!`
    );
    return undefined;
  }
  let methodData = interfaceData[xmlConfig.methodTag];

  return {
    interfaceData,
    methodData,
  };
};

interface PostmanCollectionType {
  info: Record<"name" | "schema", string>;
  item: PostmanCollectionFolderType[];
  variable?: { key: string; value: string }[];
}

export const formServiceRoutines = ({
  configuration,
}: {
  configuration: XpgConfigurationType;
}) => {
  try {
    const { variables = {}, modules = [], xml = {} } = configuration;
    let xmlConfig = xml;
    if (xmlConfig === undefined) {
      xmlConfig = getDefaultXmlConfig();
    } else {
      xmlConfig = processXmlConfig(xmlConfig);
    }

    const serviceRoutines: PostmanCollectionType = {
      info: {
        name: "BIOP_SUBSCRIBER",
        schema:
          "https://schema.getpostman.com/json/collection/v2.0.0/collection.json",
      },
      item: [],
    };

    for (const configs of modules) {
      const { directory, name, prefix, baseUrl } = configs;
      findFiles(directory, (dir: string, file: string) => {
        const filePath = join(dir, file);
        const relativeDirectoryFromPath = relative(directory, dir);

        if (extname(file) === ".xml") {
          const jsonContent = convertXmlToJson(filePath);
          const extractedContents = extractJsonContents(
            jsonContent,
            xmlConfig as AffirmedXmlConfigurationType,
            file
          );

          // returns from callback and continues the loop
          if (extractedContents === undefined) {
            return false;
          }
          const { interfaceData = {}, methodData = [] } = extractedContents;

          let folderName = interfaceData.name as string;

          if (relativeDirectoryFromPath !== "") {
            folderName = join(relativeDirectoryFromPath, folderName);
          }

          let record: PostmanCollectionFolderType = {
            name: folderName,
            item: [],
            event: [],
          };

          methodData.forEach((method) => {
            let basePath = getVariableOrBasePath(baseUrl, variables);
            let rec = formIndividualRequest(interfaceData, method, basePath);

            record.item.push(rec);
          });
          serviceRoutines.item.push(record);
        }
      });
    }

    if (Object.keys(variables).length > 0) {
      let envVariables = [];
      for (const [key, value] of Object.entries(variables)) {
        envVariables.push({
          key,
          value,
        });
      }
      serviceRoutines.variable = envVariables;
    }

    return serviceRoutines;
  } catch (error) {
    console.error(error);
  }
};
