/* eslint-disable no-undef */
// import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import {
  getUniqueId as getDeviceUniqueId,
  getPhoneNumber,
} from 'react-native-device-info';
import * as RNFS from 'react-native-fs';
import {log, DEBUG, INFO, WARN, ERROR, logIt} from './config';
import axios, {AxiosResponse} from 'axios';
import {Alert} from 'react-native';

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

export type {KeyValuePair, InvoiceMetadata, InvoiceData, Invoice};

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
    let httpRequests = [];
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
            let e = error.toString();
            const regexTimeout = /timeout of [0-9]+ms exceeded/;
            if (e === 'Network Error') {
              e = 'Network Unavailable';
            } else if (e.match(regexTimeout)) {
              e = `Server Unavailable at ${registrationUrl}`;
            } else if (e === 'Error: Request failed with status code 404') {
              e = `Bad URL: ${registrationUrl}`;
            }
            Alert.alert(
              `Failed to register invoice ${invoice_rec.invoice_capture_time}`,
              e,
            );
          }),
      );
    }
    await Promise.all(httpRequests);
    return unregisteredInvoicesCount;
  }
  static async getInvoiceOnDevice(key: string) {
    log.info(`Invoices: getInvoiceOnDevice(${key})`);
    try {
      const [metadata, data] = await Promise.all([
        // AsyncStorage.getItem(key),
        EncryptedStorage.getItem(key),
      ]);
      var invoice: Invoice;
      if (metadata && data) {
        const invoiceMetadata: InvoiceMetadata = JSON.parse(metadata);
        log.info(`invoice status: ${invoiceMetadata.status}`);
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
      console.error(`Error in getInvoiceOnDevice: ${err.code}: ${err.message}`);
    }
  }
  static async getUnregisteredInvoicesOnDevice(): Promise<Invoice[]> {
    let unregisteredInvoices: Invoice[] = [];
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
      console.error(
        `Error in getUnregisteredInvoicesOnDevice: ${err.code}: ${err.message}`,
      );
    }
    return unregisteredInvoices;
  }
  static async clearAllInvoicesOnDevice() {
    log.debug('Invoices: clearAllInvoicesOnDevice()');
    try {
      // await Promise.all([AsyncStorage.clear(), EncryptedStorage.clear()]);
      await Promise.all([EncryptedStorage.clear()]);
    } catch (err) {
      console.error(
        `Error in clearAllInvoicesOnDevice: ${err.code}: ${err.message}`,
      );
    }
  }
  static clearInvoiceOnDevice(key: string) {
    log.info(`Invoices: clearInvoiceOnDevice(${key})`);
    try {
      EncryptedStorage.removeItem(key);
      //AsyncStorage.removeItem(key);
    } catch (err) {f
      console.error(
        `Error in clearInvoiceOnDevice: ${err.code}: ${err.message}`,
      );
    }
  }
  static async createInvoiceFromImage(imagePath: string): Promise<Invoice> {
    log.info(`createInvoiceFromImage: createInvoiceFromImage(${imagePath})`);
    const newInvoice: any = await RNFS.readFile(imagePath, 'base64')
      .then(async (base64String) => {
        const key: string = `${getDeviceUniqueId()}.${Date.now()}`;
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
        const msg = `Error in createInvoiceFromImage: ${err.code}: ${err.message}`;
        console.error(msg);
        throw new Error(msg);
      });
    return newInvoice;
  }
  static async storeInvoiceOnDevice(invoice: Invoice): Promise<void> {
    log.info(`Invoices: storeInvoiceOnDevice(${invoice.id})`);
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
      console.error(
        `Error in storeInvoiceOnDevice: ${err.code}: ${err.message}`,
      );
    }
  }
}
