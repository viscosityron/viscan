import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import {
	getUniqueId as getDeviceUniqueId,
	getPhoneNumber,
} from 'react-native-device-info';
import * as RNFS from 'react-native-fs';
import axios, { AxiosResponse } from 'axios';
import { Alert } from 'react-native';
import {log, DEBUG, INFO, WARN, ERROR} from './config';


export enum InvoiceStatus {
  CAPTURED = 'CAPTURED',
  REGISTERED = 'REGISTERED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum InvoiceRejectionReason {
  INCOMPLETE_DATA = 'INCOMPLETE_DATA',
  OPERATOR_INTERVENTION = 'OPERATOR_INTERVENTION',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
}

export type { KeyValuePair, InvoiceMetadata, InvoiceData, Invoice };

interface KeyValuePair {
  key: string;
  value: string;
}
interface InvoiceMetadata {
  status: InvoiceStatus;
  rejectionReason?: InvoiceRejectionReason;
}
interface InvoiceData {
  photo: string;
  OCRValues?: KeyValuePair[];
}
interface Invoice {
  id: string;
  invoiceMetadata: InvoiceMetadata;
  invoiceData: InvoiceData;
  devicePhoneNumber: string;
  deviceLanguage?: string;
  rejectionReason?: InvoiceRejectionReason;
}

export default class Invoices {
	static async registerInvoices() {
		const unregisteredInvoices = await this.getUnregisteredInvoicesOnDevice();
		let unregisteredInvoicesCount = 0;
		const httpRequests = [];
		for (const invoice of unregisteredInvoices) {
			const invoice_rec = {
				invoice_id: invoice.id,
				invoice_photo: invoice.invoiceData.photo,
				invoice_status: invoice.invoiceMetadata.status,
				invoice_capture_time: invoice.id.substr(invoice.id.indexOf('.') + 1),
				invoice_device_language: invoice.deviceLanguage,
				invoice_device_phone_number: invoice.devicePhoneNumber,
				invoice_rejection_reason: invoice.rejectionReason,
			};
			const registrationUrl =
        'http://132.145.170.143:8080/ords/stgen/invoices/registered/';
			httpRequests.push(
				axios
					.post(registrationUrl, invoice_rec)
					.then((response) => {
						if (response.data === '') {
							Invoices.clearInvoiceOnDevice(invoice.id);
						} else {
							throw new Error(response.data);
						}
					})
					.catch((error) => {
						unregisteredInvoicesCount++;
						let errorText = error.toString();
						const regexTimeout = /timeout of [0-9]+ms exceeded/;
						if (errorText === 'Network Error') {
							errorText = 'Network Unavailable';
						} else if (errorText.match(regexTimeout)) {
							errorText = `Server Unavailable at ${registrationUrl}`;
						} else if (errorText === 'Error: Request failed with status code 404') {
							errorText = `Bad URL: ${registrationUrl}`;
						}
						Alert.alert(
							`Failed to register invoice ${invoice_rec.invoice_capture_time}`,
							errorText,
						);
					}),
			);
		}
		await Promise.all(httpRequests);
		return unregisteredInvoicesCount;
	}
	static async getInvoiceOnDevice(key: string) {
		log(INFO,`Invoices: getInvoiceOnDevice(${key})`);
		try {
			const [metadata, data] = await Promise.all([
				AsyncStorage.getItem(key),
				EncryptedStorage.getItem(key),
			]);
			var invoice: Invoice;
			if (metadata && data) {
				const invoiceMetadata: InvoiceMetadata = JSON.parse(metadata);
				log(INFO,`invoice status: ${invoiceMetadata.status}`);
				const invoiceData = JSON.parse(data);
				const devicePhoneNumber = await getPhoneNumber();
				invoice = {
					id: key,
					invoiceMetadata: invoiceMetadata,
					invoiceData: invoiceData,
					devicePhoneNumber: devicePhoneNumber,
					rejectionReason: invoiceMetadata.rejectionReason,
				};
				return invoice;
			}
			return null;
		} catch (err) {
			log(ERROR, `Error in getInvoiceOnDevice: ${err.message}`);
		}
	}
	static async getUnregisteredInvoicesOnDevice(): Promise<Invoice[]> {
		const unregisteredInvoices: Invoice[] = [];
		try {
			//const keys = await AsyncStorage.getAllKeys();
			const keys = ['1', '2', '3'];
			for (const key of keys) {
				const invoice: any = await this.getInvoiceOnDevice(key);
				if (invoice) {
					if (invoice.invoiceMetadata.status === InvoiceStatus.CAPTURED) {
						unregisteredInvoices.push(invoice);
					}
				}
			}
		} catch (err) {
			log(ERROR, `Error in getUnregisteredInvoicesOnDevice: ${err.message}`);
		}
		return unregisteredInvoices;
	}
	static async clearAllInvoicesOnDevice() {
		log(DEBUG,'Invoices: clearAllInvoicesOnDevice()');
		try {
			// await Promise.all([AsyncStorage.clear(), EncryptedStorage.clear()]);
			await Promise.all([EncryptedStorage.clear()]);
		} catch (err) {
			log(ERROR, `Error in clearAllInvoicesOnDevice: ${err.message}`);
		}
	}
	static clearInvoiceOnDevice(key: string) {
		log(INFO,`Invoices: clearInvoiceOnDevice(${key})`);
		try {
			EncryptedStorage.removeItem(key);
			//AsyncStorage.removeItem(key);
		} catch (err) {
			log(ERROR, `Error in clearInvoiceOnDevice: ${err.message}`);
		}
	}
	static async createInvoiceFromImage(imagePath: string): Promise<Invoice> {
		log(INFO,`createInvoiceFromImage: createInvoiceFromImage(${imagePath})`);
		const newInvoice: any = await RNFS.readFile(imagePath, 'base64')
			.then(async (base64String) => {
				const key = `${getDeviceUniqueId()}.${Date.now()}`;
				const invoiceMetadata: InvoiceMetadata = {
					status: InvoiceStatus.CAPTURED,
				};
				const invoiceData: InvoiceData = {
					photo: base64String,
				};
				const devicePhoneNumber: string = await getPhoneNumber();
				const invoice: Invoice = {
					id: key,
					devicePhoneNumber: devicePhoneNumber,
					invoiceData: invoiceData,
					invoiceMetadata: invoiceMetadata,
				};
				await Invoices.storeInvoiceOnDevice(invoice);
			})
			.catch((err) => {
				const msg = `Error in createInvoiceFromImage: ${err.message}`;
				log(ERROR, msg);
				throw new Error(msg);
			});
		return newInvoice;
	}
	static async storeInvoiceOnDevice(invoice: Invoice): Promise<void> {
		log(INFO,`Invoices: storeInvoiceOnDevice(${invoice.id})`);
		try {
			// await AsyncStorage.setItem(
			//   invoice.id,
			//   JSON.stringify(invoice.invoiceMetadata),
			// );
			await EncryptedStorage.setItem(
				invoice.id,
				JSON.stringify(invoice.invoiceData),
			);
		} catch (err) {
			log(ERROR, `Error in storeInvoiceOnDevice: ${err.message}`
			);
		}
	}
}
