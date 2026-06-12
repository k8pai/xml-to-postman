#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { Command } from "commander";
import { cliOptionsType, XpgConfigurationSchema } from "../types.js";
import {
  formPostmanEnvironmentFiles,
  formServiceRoutines,
  loadConfig,
} from "../lib/index.js";
import z from "zod";

const program = new Command();

program
  .name("xpc")
  .description("CLI to generate the Import file for postman.")
  .option("-c, --config <path>", "specify config file path")
  .option("-o, --outfile <path>", "specify output file path")
  .option("-v, --verbose", "specify whether to log verbose output")
  .helpOption("-h, --help", "show help");

program.parse(process.argv);

const options = program.opts<cliOptionsType>();

const findConfigFile = async (
  dir: string,
  filename: string = "xpc.config.js"
) => {
  while (true) {
    let possible = join(dir, filename);
    if (existsSync(possible)) return possible;

    let parentPath = dirname(dir);
    if (parentPath === dir) break;
    dir = parentPath;
  }

  throw new Error(`Config file not found`);
};

const main = async () => {
  try {
    let configPath = options.config || (await findConfigFile(process.cwd()));
    let configurations = await loadConfig(configPath);
    let output_file = options.outfile;
    const result = XpgConfigurationSchema.strict().safeParse(configurations);

    if (result.success === true) {
      const response = formServiceRoutines({
        configuration: result.data,
        cliOptions: options,
      });
      const configuredOutputDirectory =
        result.data.postman?.outputDirectory ?? "postman_collection";
      if (output_file === undefined) {
        const collectionFileName = result.data.name.endsWith(".json")
          ? result.data.name
          : `${result.data.name}.json`;
        output_file = join(configuredOutputDirectory, collectionFileName);
      } else if (dirname(output_file) === ".") {
        output_file = join(configuredOutputDirectory, output_file);
      }

      const outputDirectory = dirname(output_file);
      mkdirSync(outputDirectory, { recursive: true });

      writeFileSync(output_file, JSON.stringify(response, null, 2));

      for (const environmentFile of formPostmanEnvironmentFiles(result.data)) {
        writeFileSync(
          join(outputDirectory, environmentFile.fileName),
          JSON.stringify(environmentFile.content, null, 2)
        );
      }
    } else {
      const pretty = z.prettifyError(result.error);
      console.log("Invalid configuration!!!");
      console.log(pretty);
    }
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }
};

main();
