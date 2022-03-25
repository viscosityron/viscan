---------------------------------------------------------------------------------------
-- Enable a schema and give it an alias. Here, /apex212/apexdev becomes /apex212/viscan
--
-- https://apexdev.viscosityna.com/apex212/viscan/
--
BEGIN
  ORDS.enable_schema(
    p_enabled             => TRUE,
    p_schema              => 'rhaworth',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'viscan',
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
END;
/
--------------------------------------------------------
--  Table LOG
--
DROP TABLE LOG;
CREATE TABLE LOG
   (  "KEY" VARCHAR2(4000 BYTE),
      "VALCLOB" CLOB
   );
--------------------------------------------------------
--  Table REGISTRY
--
DROP TABLE REGISTRY;
CREATE TABLE REGISTRY
   (  "DOCUMENT_ID" VARCHAR2(4000 BYTE), 
      "PHOTO" CLOB, 
      "STATUS" VARCHAR2(4000 BYTE), 
      "CAPTURED_TIME" NUMBER, 
      "PROCESSED_TIME" NUMBER, 
      "ERROR_PCT" NUMBER,
      "REJECTION_REASON" VARCHAR2(4000 BYTE),
      "DEVICE_PHONE_NUMBER" VARCHAR2(4000 BYTE), 
      "DEVICE_LANGUAGE" VARCHAR2(4000 BYTE)
   );
  -----------------------------------------------------------------------------------
  -- A POST method to register a scanned document
  --
  create or replace PROCEDURE register_document ( document_body IN CLOB )
  AS
      document JSON_OBJECT_T;
      l_document_id VARCHAR2(4000);
      l_photo CLOB;
      l_status VARCHAR2(4000);
      l_captured_time NUMBER;
      l_processed_time NUMBER;
      l_error_pct NUMBER;
      l_device_phone_number VARCHAR2(4000);
      l_device_language VARCHAR2(4000);
      l_rejection_reason VARCHAR2(4000);
  BEGIN
      document := JSON_OBJECT_T.parse(document_body);   
      INSERT INTO log (key, valclob) VALUES ('document_body', document_body);

      l_document_id := document.get_string('id');
      l_photo := document.get_clob('photo');
      l_status := 'REGISTERED';
      l_captured_time := document.get_Number('captured_time');
      l_processed_time := document.get_Number('processed_time');
      l_error_pct := document.get_Number('error_pct');
      l_device_language := document.get_string('device_language');
      l_device_phone_number := document.get_string('device_phone_number');
      l_rejection_reason := document.get_string('rejection_reason');

      INSERT INTO registry (
          document_id,
          photo,
          status,
          captured_time,
          processed_time,
          error_pct,
          device_language,
          device_phone_number,
          rejection_reason
          )
      VALUES (
          l_document_id,
          l_photo,
          l_status,
          l_captured_time,
          l_processed_time,
          l_error_pct,
          l_device_language,
          l_device_phone_number,
          l_rejection_reason
          );

  EXCEPTION
    WHEN OTHERS THEN
      HTP.print(SQLERRM);
  END;
----------------------------------------------------------------------------------------------------------------------------------------
--    The web service can be called using the following URL, method, header and payload:
--    URL        : https://apexdev.viscosityna.com/apex212/viscan/documents/registered/   
--
--    ?????????? test that this goes away with new url...
--       getting a 301 (moved permanently) without explicit 8080 port in this URL
--
--    Method     : POST
--    Header     : Content-Type: application/json
--    Raw Payload:  {
--      "DOCUMENT_ID": "12345", "INVOICE_PHOTO": "this is a base64 image", "DOCUMENT_OCR_VALUES": [{"abc":"123"},{"def":"456"}], 
--      "STATUS": "REGISTERED", "CAPTURE_TIME": 2312341234, "DEVICE_LANGUAGE": "en", "REJECTION_REASON": null 
--    }
--
--    curl -k -i -X POST --data-ascii @/tmp/td1.json -H "Content-Type: application/json" https://apexdev.viscosityna.com/apex212/viscan/documents/registered/
--
--    curl -k -i -X GET --url https://apexdev.viscosityna.com/apex212/viscan/documents/registered/12345
--
    BEGIN
    ORDS.define_module(
        p_module_name    => 'documents',
        p_base_path      => 'documents/',
        p_items_per_page => 0);

    ORDS.define_template(
        p_module_name    => 'documents',
        p_pattern        => 'registered/:document_id');

    ORDS.define_handler(
        p_module_name    => 'documents',
        p_pattern        => 'registered/:document_id',
        p_method         => 'GET',
        p_source_type    => ORDS.source_type_collection_feed,
        p_source         => 'SELECT * FROM registry WHERE document_id = :document_id',
        p_items_per_page => 0);
    
    ORDS.define_template(
    p_module_name     => 'documents',
    p_pattern         => 'registered/');

    ORDS.define_handler(
        p_module_name    => 'documents',
        p_pattern        => 'registered/',
        p_method         => 'POST',
        p_source_type    => ORDS.source_type_plsql,
        p_source         => 
    'BEGIN
        register_document( :body_text );
    END;', 
        p_items_per_page => 0);

    COMMIT;
    END;
/