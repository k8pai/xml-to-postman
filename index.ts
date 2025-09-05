import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs';
import path from 'node:path';

// Path to the folder containing your XML files
const DIRECTORY_MAP = {
	SUBSCRIBER: '../biop_schema/idl/subscriber',
	ROC: '../biop_schema/idl/registrar',
	AAA: '../biop_schema/idl/aaa',
};

const MODULE_CONFIGURATIONS = {
	SUBSCRIBER: { prefix: 'sub', name: 'Subscriber', urlBasePath: 'baseurl' },
	ROC: { prefix: 'roc', name: 'Registrar', urlBasePath: 'registrarurl' },
	AAA: { prefix: 'aaa', name: 'AAA', urlBasePath: 'aaaurl' },
};

const variables = {
	baseurl: 'http://localhost:9982/subscriber',
	registrarurl: 'http://localhost:9982/registrar',
	aaaurl: 'http://localhost:9982/aaa',
};

// XML parser setup
const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '',
	allowBooleanAttributes: true,
});

const getVariableOrBasePath = (basePath) => {
	if (basePath && variables[basePath]) {
		return `{{${basePath}}}`;
	} else {
		return basePath || '';
	}
};

const formEndpointPath = (basePath, interfaceName, methodName) => {
	return `${basePath}/${interfaceName}/${methodName}`;
};

const formIndividualRequest = (interfaceData, method, configs) => {
	const params = [];
	if (Array.isArray(method.query_param)) {
		method.query_param.forEach((param) => {
			params.push({
				key: param.name,
				value: '',
				disabled: param.mandatory === 'false' ? true : false,
			});
		});
	} else if (method.query_param && typeof method.query_param === 'object') {
		params.push({
			key: method.query_param.name,
			value: '',
			disabled: method.query_param.mandatory === 'false' ? true : false,
		});
	}

	let basePath = getVariableOrBasePath(configs.urlBasePath);
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
			description: '',
		},
		response: [],
	};
};

const formServiceRoutines = () => {
	const serviceRoutines = {
		info: {
			name: 'BIOP_SUBSCRIBER',
			schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
		},
		item: [],
	};

	for (const [module, directory] of Object.entries(DIRECTORY_MAP)) {
		const moduleRecords = {};
		const configs = MODULE_CONFIGURATIONS[module];
		if (!configs) {
			console.warn(`No configuration found for module: ${module}`);
			continue;
		}
		fs.readdirSync(directory)
			.filter((file) => path.extname(file) === '.xml')
			.forEach((file) => {
				const filePath = path.join(directory, file);
				const xmlContent = fs.readFileSync(filePath, 'utf-8');
				const jsonObj = parser.parse(xmlContent);

				// Access interface
				const interfaceData = jsonObj['ns:interface'];
				if (!interfaceData || !interfaceData.name) {
					console.warn(`Skipping file ${file}, no <ns:interface> found`);
					return;
				}

				const interfaceName = interfaceData.name;
				moduleRecords[interfaceName] = {};
				let record = {
					name: interfaceData.name,
					item: [],
				};
				const methods = interfaceData.method;
				if (Array.isArray(methods)) {
					methods.forEach((method) => {
						let rec = formIndividualRequest(interfaceData, method, configs);
						const methodName = method.name;
						const httpMethod = method.http_method;
						moduleRecords[interfaceName][methodName] = httpMethod.toLowerCase();
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
	console.log(JSON.stringify(serviceRoutines, null, 2));
	// return serviceRoutines;
};

formServiceRoutines();
