/* ==========================================================================
   Controles de Biblioteca - Estrategia "Transferir" (ISO/IEC 27002:2022 5.19-5.23)
   Base: relación con proveedores, acuerdos, cadena de suministro TIC,
   monitoreo de proveedores y servicios en la nube.

   Requiere que Catalogo_ISO ya tenga cargados los controles 5.19 a 5.23
   (vienen en la carga inicial del catálogo ISO 27002:2022).
   ========================================================================== */

INSERT INTO Controles_Empresa
    (nombre_control, id_iso_padre, naturaleza_valor, ejecucion_valor, documentacion_valor, eficacia_porcentaje, fecha_registro)
VALUES
    (N'Acuerdo de Nivel de Servicio (SLA) de Seguridad con Proveedores Críticos', '5.19', 100, 50, 100, 83.00, GETDATE()),
    (N'Cláusulas Contractuales de Confidencialidad y Tratamiento de Datos (Encargado de Tratamiento)', '5.20', 100, 50, 100, 83.00, GETDATE()),
    (N'Evaluación y Homologación de Riesgos en la Cadena de Suministro TIC', '5.21', 60, 50, 50, 53.00, GETDATE()),
    (N'Auditoría Periódica y Monitoreo de Desempeño de Proveedores', '5.22', 60, 50, 50, 53.00, GETDATE()),
    (N'Póliza de Ciberseguro y Contrato de Servicios en la Nube con Cláusulas de Seguridad', '5.23', 100, 100, 100, 100.00, GETDATE());
