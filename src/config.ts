import { logger, consoleTransport } from 'react-native-logs';

export enum Severity {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}
export const DEBUG = Severity.DEBUG;
export const INFO = Severity.INFO;
export const WARN = Severity.WARN;
export const ERROR = Severity.ERROR;

const defaultConfig = {
	levels: {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	},
	severity: 'debug',
	transport: consoleTransport,
	transportOptions: {
		colors: {
			debug: 'white',
			info: 'blueBright',
			warn: 'yellowBright',
			error: 'redBright',
		},
	},
	async: true,
	dateFormat: 'time',
	printLevel: true,
	printDate: true,
	enabled: true,
};

export const Logger = logger.createLogger(defaultConfig);
export const log = (
	severity: Severity = DEBUG,
	fName: string,
	message = ' ',
	logParms = false,
	...parms: any[]
) => {
	const printableParms = new Array<string>();
	const getPrintableParms = (item: any) => {
		const type = typeof item;
		if (type === 'object') {
			printableParms.push(JSON.stringify(item));
		} else {
			printableParms.push(item);
		}
	};
	const f =
		severity === INFO
			? Logger.info
			: severity === WARN
				? Logger.warn
				: severity === ERROR
					? Logger.error
					: Logger.debug;
	const msg =
		severity === INFO || severity === WARN ? `${message}` : ` ${message}`;
	if (logParms && parms.length > 0) {
		const parmsArray: Array<any> = Array.from(parms);
		parmsArray.forEach(getPrintableParms);
	}
	f(`\t${fName} ${msg} ${printableParms}`);
};
