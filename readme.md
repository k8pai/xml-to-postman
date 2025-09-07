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
  variables: {
    patientsurl: "http://localhost:9982/patients",
    doctorsurl: "http://localhost:9982/doctors",
    authenticationurl: "http://localhost:9982/authentication",
  },
};

export default xpcConfig;
```

---

## 📌 How It Works

* The CLI reads all **XML schema files** from the directories defined in `modules`.
* Each `<ns:interface>` and `<method>` in XML is converted into a **Postman request**.
* Generated requests are grouped under Postman folders by module `name` or `prefix`.
* Variables from `variables` are injected into the Postman collection for easy environment management.
* The final JSON is saved as a Postman collection (default: `collection.json`).
* A reference to the sample XML schema file can be found [here](./docs/readme.md)
---

## 📝 Example Command

```bash
xpc -c ./configs/xpc.config.js -o ./collections/inventory.postman.json
```

✅ This will:

* Use `./configs/xpc.config.js` as the configuration file.
* Generate a Postman collection file named `inventory.postman.json` in `./collections`.

You can now import that JSON file directly into Postman. 🎉

---

## ⚡ Features

* Parses multiple XML schema files in a folder.
* Supports CRUD operations (`fetch`, `add`, `modify`, `delete`, `undelete`, `list`).
* Generates a valid Postman Collection v2.1 JSON.
* Maps:

  * `http_method` → Postman request method.
  * `query_param` → Query params in request.
  * `input` → Request body placeholder.
  * `output` → Response placeholder.

---

## 📖 Notes

* Default config file is `xpc.config.js` if no `--config` is provided.
* `version` must be either `2.0` or `2.1` (Postman collection schema versions).
* Query parameters, inputs, and outputs from XML are mapped into Postman requests automatically.
* Use the `variables` section in config to define Postman variables (e.g., `{{baseurl}}`).

---
