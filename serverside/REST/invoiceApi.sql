--------------------------------------------------------------------------------
-- Enable a schema and give it an alias. Here, /ords/apexdev becomes /ords/stgen
--
-- http://132.145.170.143:8080/ords/stgen
--
BEGIN
  ORDS.enable_schema(
    p_enabled             => TRUE,
    p_schema              => 'rhaworth[stage]',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'stgen',
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
END;
/
--------------------------------------------------------
--  Table REGISTERED_INVOICES
--
CREATE TABLE REGISTERED_INVOICES
   (	"INVOICE_ID" VARCHAR2(4000 BYTE), 
      "INVOICE_PHOTO" CLOB, 
      "INVOICE_STATUS" VARCHAR2(4000 BYTE), 
      "INVOICE_CAPTURE_TIME" NUMBER, 
      "INVOICE_REJECTION_REASON" VARCHAR2(4000 BYTE), 
      "INVOICE_DEVICE_PHONE_NUMBER" VARCHAR2(4000 BYTE), 
      "INVOICE_DEVICE_LANGUAGE" VARCHAR2(4000 BYTE)
   );
  -----------------------------------------------------------------------------------
  -- A POST method to register a scanned invoice
  --
  create or replace PROCEDURE register_invoice ( invoice_body IN CLOB )
  AS
      invoice  JSON_OBJECT_T;
      l_invoice_id  VARCHAR2(4000);
      l_invoice_photo CLOB;
      l_invoice_status VARCHAR2(4000);
      l_invoice_capture_time NUMBER;
      l_invoice_device_language VARCHAR2(4000);
      l_invoice_device_phone_number VARCHAR2(4000);
      l_invoice_rejection_reason VARCHAR2(4000);
  BEGIN
      invoice := JSON_OBJECT_T.parse(invoice_body);
      INSERT INTO log (key, valclob) VALUES ('invoice_body', invoice_body);

      l_invoice_id := invoice.get_string('invoice_id');
      l_invoice_photo := invoice.get_clob('invoice_photo');
      l_invoice_status := 'REGISTERED';
      l_invoice_capture_time := invoice.get_Number('invoice_capture_time');
      l_invoice_device_language := invoice.get_string('invoice_device_language');
      l_invoice_device_phone_number := invoice.get_string('invoice_device_phone_number');
      l_invoice_rejection_reason := invoice.get_string('invoice_rejection_reason');

      INSERT INTO registered_invoices (
          invoice_id,
          invoice_photo,
          invoice_status,
          invoice_capture_time,
          invoice_device_language,
          invoice_device_phone_number,
          invoice_rejection_reason
          )
      VALUES (
          l_invoice_id,
          l_invoice_photo,
          l_invoice_status,
          l_invoice_capture_time,
          l_invoice_device_language,
          l_invoice_device_phone_number,
          l_invoice_rejection_reason
          );

  EXCEPTION
    WHEN OTHERS THEN
      HTP.print(SQLERRM);
  END;
----------------------------------------------------------------------------------------------------------------------------------------
--    The web service can be called using the following URL, method, header and payload:
--    URL        : http://132.145.170.143:8080/ords/stgen/invoices/registered/   
--
--    getting a 301 (moved permanently) without explicit 8080 port in this URL
--
--    Method     : POST
--    Header     : Content-Type: application/json
--    Raw Payload:  {
--      "INVOICE_ID": "12345", "INVOICE_PHOTO": "this is a base64 image", "INVOICE_OCR_VALUES": [{"abc":"123"},{"def":"456"}], 
--      "INVOICE_STATUS": "REGISTERED", "INVOICE_CAPTURE_TIME": 2312341234, "INVOICE_DEVICE_LANGUAGE": "en", "INVOICE_REJECTION_REASON": null 
--    }
--
--    curl -k -i -X POST --data-ascii @/tmp/td1.json -H "Content-Type: application/json" http://132.145.170.143:8080/ords/stgen/invoices/registered/
--
--    curl -k -i -X GET --url http://132.145.170.143:8080/ords/stgen/invoices/registered/12345
--
BEGIN
  ORDS.define_module(
    p_module_name    => 'invoices',
    p_base_path      => 'invoices/',
    p_items_per_page => 0);

  ORDS.define_template(
    p_module_name    => 'invoices',
    p_pattern        => 'registered/:invoice_id');

  ORDS.define_handler(
    p_module_name    => 'invoices',
    p_pattern        => 'registered/:invoice_id',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_source         => 'SELECT * FROM registered_invoices WHERE invoice_id = :invoice_id',
    p_items_per_page => 0);
  
  ORDS.define_template(
   p_module_name     => 'invoices',
   p_pattern         => 'registered/');

  ORDS.define_handler(
    p_module_name    => 'invoices',
    p_pattern        => 'registered/',
    p_method         => 'POST',
    p_source_type    => ORDS.source_type_plsql,
    p_source         => 
'BEGIN
    register_invoice( :body_text );
END;', 
    p_items_per_page => 0);

  COMMIT;
END;
/