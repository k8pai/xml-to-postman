/** @type {import('./dist/index').XpgConfigurationType} */
export const xpcConfig = {
  name: "Testing",
  version: "2.0",
  modules: [
    {
      prefix: "sub",
      name: "Subscriber",
      baseUrl: "baseurl",
      directory: "./docs",
    },
  ],
  variables: {
    baseurl: "http://localhost:9982/subscriber",
    registrarurl: "http://localhost:9982/registrar",
    aaaurl: "http://localhost:9982/aaa",
  },
};

export default xpcConfig;
