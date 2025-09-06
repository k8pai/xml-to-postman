import fs from 'fs';
import path from 'path';

const readConfigFile = () => {
	console.log('...', __dirname);
	const configPath = path.join(__dirname, 'xpc.config.json');
	console.log(configPath);
	const rawData = fs.readFileSync(configPath);
	const configDynamic = JSON.parse(rawData.toString('utf8'));
	console.log(configDynamic); // 4000
};

export { readConfigFile };
export default readConfigFile;
