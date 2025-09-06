#!/usr/bin/env node

import fs, { writeFileSync, existsSync } from "fs";
import path, { join, dirname } from "path";
import { Command } from "commander";
import { XpgConfigurationSchema } from "@/types";
import { formServiceRoutines } from "@/lib";
import { loadConfig } from "@/lib";
import z from "zod";

const program = new Command();

program
  .name("xpc")
  .description("CLI to generate the Import file for postman.")
  .option("-c, --config <path>", "specify config file path")
  .option("-o, --outfile <path>", "specify output file path")
  .helpOption("-h, --help", "show help");

program.parse(process.argv);

const options = program.opts();

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

try {
  let configPath = options.config || (await findConfigFile(process.cwd()));
  let configurations = await loadConfig(configPath);
  let output_file = options.outfile;
  const result = XpgConfigurationSchema.strict().safeParse(configurations);

  if (result.success === true) {
    const response = formServiceRoutines({ configuration: result.data });
    if (output_file === undefined) {
      output_file = result.data.name.endsWith(".json")
        ? result.data.name
        : `${result.data.name}.json`;
    }
    writeFileSync(output_file, JSON.stringify(response, null, 2));
  } else {
    const pretty = z.prettifyError(result.error);
    console.log("Invalid configuration!!!");
  }
} catch (e: any) {
  console.error(e.message);
  process.exit(1);
}
