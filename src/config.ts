import {logger} from 'react-native-logs';

interface KeyValuePair {
  key: string;
  value: string;
}
export enum Severity {
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  INFO = 'INFO',
  ERROR = 'ERROR',
}
export const DEBUG = Severity.DEBUG;
export const WARN = Severity.WARN;
export const INFO = Severity.INFO;
export const ERROR = Severity.ERROR;
export interface LogEntry {
  function: string;
  time: number;
  severity: string;
}
export {log, logIt};
const log = logger.createLogger();
const logIt = (
  message: string,
  severity: Severity = Severity.INFO,
  toConsole: boolean = false,
) => {
  const d = Date.now();
  if (toConsole) {
    let c;
    switch (severity) {
      case INFO:
        // c = console.;
        break;
      default:
        console.error(
          `caller: ${logIt.caller.name} ${severity} ${d} ${toConsole} ${message}`,
        );
    }
  }
};

if (__DEV__) {
  log.setSeverity('info');
} else {
  log.setSeverity('error');
}
