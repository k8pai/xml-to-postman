#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

const program = new Command();

program
	.name('xpc')
	.description('CLI to generate the Import file for postman.')
	.option('-c, --config <path>', 'specify config file path')
	.helpOption('-h, --help', 'show help');

program.parse(process.argv);

const options = program.opts();

const findConfigFile = async (dir: string, filename: string = '.xpcrc') => {
	while (true) {
		let possible = path.join(dir, filename);
		console.log('possible => ', possible);
		if (fs.existsSync(possible)) return possible;

		let parentPath = path.dirname(dir);
		if (parentPath === dir) break;
		dir = parentPath;
	}

	throw new Error(`Config file not found`);
};

try {
	let configPath = options.config || (await findConfigFile(process.cwd()));
	let contents = fs.readFileSync(configPath, 'utf-8');
	console.log(JSON.parse(contents));
} catch (e: any) {
	console.log();
	console.error(e.message);
	process.exit(1);
}
