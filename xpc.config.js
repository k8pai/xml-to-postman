/** @type {import('./src/types').XpgConfigurationType} */
export const xpcConfig = {
  name: "biop_api",
  version: "2.0",
  modules: [
    {
      prefix: "sub",
      name: "Subscriber",
      baseUrl: "baseurl",
      directory: "../../product/biop_schema/idl/subscriber",
    },
    {
      prefix: "reg",
      name: "Registrar",
      baseUrl: "registrarurl",
      directory: "../../product/biop_schema/idl/registrar",
    },
    {
      prefix: "aaa",
      name: "AAA",
      baseUrl: "aaaurl",
      directory: "../../product/biop_schema/idl/aaa",
    },
  ],
  variables: [
    {
      type: "environment",
      name: "baseurl",
      values: {
        dev: "http://localhost:9982/biop/subscriber",
        staging: "http://tekenlight-stg.com/biop/subscriber",
        uat: "http://tekenlight-uat.com/biop/subscriber",
        prod: "http://tekenlight.com/biop/subscriber",
      },
    },
    {
      type: "environment",
      name: "registrarurl",
      values: {
        dev: "http://localhost:9982/biop/registrar",
        staging: "http://tekenlight-stg.com/biop/registrar",
        uat: "http://tekenlight-uat.com/biop/registrar",
        prod: "http://tekenlight.com/biop/registrar",
      },
    },
    {
      type: "environment",
      name: "aaaurl",
      values: {
        dev: "http://localhost:9982/biop/aaa",
        staging: "http://tekenlight-stg.com/biop/aaa",
        uat: "http://tekenlight-uat.com/biop/aaa",
        prod: "http://tekenlight.com/biop/aaa",
      },
    },
  ],
  schemas: "../../product/biop_schema/xsd",
  postman: {
    moduleFolders: true,
    outputDirectory: "postman_collection",
  },
  xml: {
    interfaceTag: ["ns:interface", "ns:application", "application"],
    methodTag: "method",
  },
};

export default xpcConfig;
