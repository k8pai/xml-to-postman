# XML to Postman CLI (`xpc`)

A CLI tool to **convert XML interface schema files** into an **importable Postman collection**.
It supports configuration via a `xpc.config.js` file (or a custom config path via CLI options).

---

## 📦 Installation

```bash
npm i -g @k8pai/xml-to-postman
```

Or use it locally in a project:

```bash
npm i @k8pai/xml-to-postman
```

---

## 🚀 Usage

Run the CLI in a project with a config file:

```bash
xpc
```

By default, the tool looks for a config file named **`xpc.config.js`** in the current working directory.
This can be overridden using CLI options.

---

## ⚙️ CLI Options

| Option                 | Alias | Description                                                         | Example                                       |
| ---------------------- | ----- | ------------------------------------------------------------------- | --------------------------------------------- |
| `-c, --config <path>`  |       | Specify config file path (overrides `xpc.config.js`).               | `xpc -c ./configs/xpc.config.js`              |
| `-o, --outfile <path>` |       | Specify output file path for the generated Postman collection JSON. | `xpc -o ./collections/inventory.postman.json` |
| `-h, --help`           |       | Show help information.                                              | `xpc --help`                                  |

---

### Sample Config (`xpc.config.js`)

```js
/** @type {import('@k8pai/xml-to-postman').XpgConfigurationType} */
export const xpcConfig = {
  name: "Testing",
  version: "2.0",
  modules: [
    {
      prefix: "",
      name: "patients",
      baseUrl: "patientsurl",
      directory: "./idl/patients",
    },
    {
      prefix: "",
      name: "doctors",
      baseUrl: "doctorsurl",
      directory: "./idl/doctors",
    },
    {
      prefix: "",
      name: "authentication",
      baseUrl: "authenticationurl",
      directory: "./idl/auth",
    },
  ],
  variables: [
    {
      type: "environment",
      name: "patientsurl",
      values: {
        dev: "http://localhost:9982/patients",
        staging: "http://localhost:9982/patients",
        uat: "http://localhost:9982/patients",
        prod: "http://localhost:9982/patients",
      },
      valueType: "default",
    },
    {
      type: "environment",
      name: "doctorsurl",
      values: {
        dev: "http://localhost:9982/doctors",
        staging: "http://localhost:9982/doctors",
        uat: "http://localhost:9982/doctors",
        prod: "http://localhost:9982/doctors",
      },
      valueType: "default",
    },
    {
      type: "collection",
      name: "authenticationurl",
      value: "http://localhost:9982/authentication",
    },
  ],
  schemas: "./xsd",
  postman: {
    moduleFolders: true,
    outputDirectory: "postman_collection",
  },
};

export default xpcConfig;
```

---

## 📌 How It Works

* The CLI reads all **XML schema files** from the directories defined in `modules`.
* Each `<ns:interface>` and `<method>` in XML is converted into a **Postman request**.
* Generated requests are grouped under interface folders. Module folders can be enabled with `postman.moduleFolders`.
* Variables from `variables` use typed scopes. `collection` variables are injected into the collection and `environment` variables are written to generated environment files.
* When `postman.moduleFolders` is `true`, generated folders are grouped by module first (for example `Testing/patients/appointments` instead of `Testing/appointments`).
* `schemas` can point to one XSD file, a folder containing XSD files, or an array of files/folders. Module-level `schemas` are merged with global `schemas`.
* Method `input` and `output` tags are resolved against configured XSD schemas to generate JSON request body and response examples.
* The collection JSON and generated environment files are saved together in `postman.outputDirectory` (default: `postman_collection`).
* A reference to the sample XML schema file can be found [here](./docs/readme.md)
---

## Configuration Reference

| Key | Type | Description |
| --- | --- | --- |
| `variables` | `Record<string, string> \| Variable[]` | Variable config. The old object format is still accepted as collection variables. The new array format supports `type: "collection"` or `"environment"`. |
| `variables[].values` | `Record<string, string>` | Required only for `type: "environment"`. Object keys are environment names and values are that variable value for each generated environment. |
| `variables[].valueType` | `"default" \| "secret"` | Optional Postman environment variable value type. Defaults to `"default"`. |
| `variables[].description` | `string` | Optional description included in generated environment variable files. |
| `variables[].enabled` | `boolean` | Optional enabled flag for generated environment variables. Defaults to `true`. |
| `schemas` | `string \| string[]` | Optional global XSD source path or paths. Each entry can be a single `.xsd` file or a directory scanned recursively for `.xsd` files. |
| `postman.moduleFolders` | `boolean` | Optional. When `true`, each module becomes a top-level Postman folder before interface folders are added. Defaults to `false` for backwards compatibility. |
| `postman.outputDirectory` | `string` | Optional output folder for the generated collection and environment files. Defaults to `postman_collection`. |
| `modules[].folder` | `string \| boolean` | Optional per-module folder control. A string names the module folder. `true` uses `name` or `prefix`; `false` disables the module folder even when global grouping is enabled. |
| `modules[].schemas` | `string \| string[]` | Optional module-specific XSD source path or paths. These are merged with global `schemas`. |
| `xml.queryTag` | `string` | Optional XML tag name for query params. Defaults to `query_param`. |

Query params with `mandatory="true"` are generated as enabled Postman query parameters. Other query params are generated but disabled by default.

Environment variable values are configured per environment with `values`:

```js
{
  type: "environment",
  name: "baseurl",
  values: {
    dev: "http://localhost:9982/dev",
    staging: "https://staging.example.com",
    prod: "https://api.example.com",
  },
  valueType: "secret",
  description: "API base URL",
}
```

---

## 📝 Example Command

```bash
xpc -c ./configs/xpc.config.js -o ./collections/inventory.postman.json
```

✅ This will:

* Use `./configs/xpc.config.js` as the configuration file.
* Generate a Postman collection file named `inventory.postman.json` in `./collections`, with environment files beside it.

You can now import that JSON file directly into Postman. 🎉

---

## ⚡ Features

* Parses multiple XML schema files in a folder.
* Supports CRUD operations (`fetch`, `add`, `modify`, `delete`, `undelete`, `list`).
* Generates a valid Postman Collection v2.1 JSON.
* Maps:

  * `http_method` → Postman request method.
  * `query_param` → Query params in request.
  * `input` → JSON request body example resolved from configured XSD schemas.
  * `output` → JSON response example resolved from configured XSD schemas.

---

## 📖 Notes

* Default config file is `xpc.config.js` if no `--config` is provided.
* `version` must be either `2.0` or `2.1` (Postman collection schema versions).
* Query parameters, inputs, and outputs from XML are mapped into Postman requests automatically. Inputs and outputs require `schemas` when you want generated JSON examples.
* Use typed `variables` to decide whether a value belongs to the collection or generated environment files. Any configured variable can still be referenced in URLs as `{{baseurl}}`.

---
