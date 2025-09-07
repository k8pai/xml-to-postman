import { XMLParser } from "fast-xml-parser";
import fs from "node:fs";
import path from "node:path";
import {
  PostmanCollectionFolderType,
  PostmanCollectionItemType,
  XpgConfigurationType,
} from "./types";
export * from "./types";

// XML parser setup
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
});

const getVariableOrBasePath = (
  basePath: string,
  variables: Record<string, string>
) => {
  if (basePath && variables[basePath]) {
    return `{{${basePath}}}`;
  } else {
    return basePath;
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
  const { variables = {}, modules = [] } = configuration;
  const serviceRoutines: PostmanCollectionType = {
    info: {
      name: "BIOP_SUBSCRIBER",
      schema:
        "https://schema.getpostman.com/json/collection/v2.0.0/collection.json",
    },
    item: [],
  };

  for (const configs of modules) {
    // const moduleRecords = {};
    const { directory, name, prefix, baseUrl } = configs;
    fs.readdirSync(directory)
      .filter((file) => path.extname(file) === ".xml")
      .forEach((file) => {
        const filePath = path.join(directory, file);
        const xmlContent = fs.readFileSync(filePath, "utf-8");
        const jsonObj = parser.parse(xmlContent);

        // Access interface
        const interfaceData = jsonObj["ns:interface"];
        if (!interfaceData || !interfaceData.name) {
          console.warn(`Skipping file ${file}, no <ns:interface> found`);
          return;
        }

        const interfaceName = interfaceData.name as string;
        // moduleRecords[interfaceName] = {};
        let record: PostmanCollectionFolderType = {
          name: interfaceData.name,
          item: [],
          event: [],
        };
        const methods = interfaceData.method;
        if (Array.isArray(methods)) {
          methods.forEach((method) => {
            let basePath = getVariableOrBasePath(configs.baseUrl, variables);

            let rec = formIndividualRequest(interfaceData, method, basePath);
            record.item.push(rec);
          });
        }
        serviceRoutines.item.push(record);
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
  // console.log(JSON.stringify(serviceRoutines, null, 2));
  // return serviceRoutines;
};
