/* ==========================================================================
   REPORTES.JS - Plantilla compartida para los reportes imprimibles/PDF
   (Activos, Riesgos, Controles, Historial de Tratamientos)
   ========================================================================= */

function badgeSeveridad(texto) {
    const t = (texto || '').toLowerCase();
    if (t.includes('crítico') || t.includes('critico')) return 'badge-critico';
    if (t.includes('alto')) return 'badge-alto';
    if (t.includes('medio')) return 'badge-medio';
    if (t.includes('bajo') || t.includes('marginal')) return 'badge-bajo';
    return 'badge-neutro';
}

/**
 * Abre una ventana nueva con un reporte imprimible con estilo consistente.
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título principal del reporte.
 * @param {string} opciones.subtitulo - Línea descriptiva bajo el título.
 * @param {Array<{valor:string, etiqueta:string, color?:string}>} [opciones.stats] - Tarjetas de resumen.
 * @param {string[]} opciones.columnas - Encabezados de la tabla.
 * @param {string} opciones.filasHtml - Filas <tr>...</tr> ya construidas.
 */
function abrirReporteElegante({ titulo, subtitulo, stats = [], columnas, filasHtml }) {
    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
    const hora = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

    const statsHtml = stats.map(s => `
        <div class="stat-card">
            <span class="stat-valor" style="color:${s.color || '#4f46e5'}">${s.valor}</span>
            <span class="stat-etiqueta">${s.etiqueta}</span>
        </div>
    `).join('');

    const columnasHtml = columnas.map(c => `<th>${c}</th>`).join('');

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
        <meta charset="UTF-8">
        <title>${titulo} - SecureCore</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --indigo: #4f46e5;
                --slate-900: #0f172a;
                --slate-500: #64748b;
                --slate-200: #e2e8f0;
                --slate-50: #f8fafc;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', Arial, sans-serif; }
            body { color: var(--slate-900); background: #ffffff; padding: 48px 56px; }

            .reporte-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                gap: 24px;
                border-bottom: 3px solid var(--indigo);
                padding-bottom: 20px;
                margin-bottom: 28px;
            }
            .marca {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--indigo);
                font-weight: 700;
                font-size: 13px;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                margin-bottom: 12px;
            }
            .marca .icono {
                width: 24px; height: 24px;
                border-radius: 7px;
                background: var(--indigo);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                flex-shrink: 0;
            }
            .reporte-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; line-height: 1.2; }
            .reporte-header p { font-size: 13px; color: var(--slate-500); }
            .meta-generacion { text-align: right; font-size: 12px; color: var(--slate-500); white-space: nowrap; }
            .meta-generacion strong { display: block; color: var(--slate-900); font-size: 14px; margin-bottom: 2px; }

            .stats-row { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .stat-card {
                flex: 1; min-width: 130px;
                background: var(--slate-50);
                border: 1px solid var(--slate-200);
                border-radius: 10px;
                padding: 14px 18px;
            }
            .stat-valor { display: block; font-size: 24px; font-weight: 800; line-height: 1.2; }
            .stat-etiqueta { font-size: 10.5px; color: var(--slate-500); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }

            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            thead th {
                background: var(--slate-900);
                color: #fff;
                text-transform: uppercase;
                letter-spacing: 0.03em;
                font-size: 10.5px;
                padding: 10px 10px;
                text-align: left;
            }
            thead th:first-child { border-top-left-radius: 6px; }
            thead th:last-child { border-top-right-radius: 6px; }
            tbody td { padding: 9px 10px; border-bottom: 1px solid var(--slate-200); vertical-align: top; }
            tbody tr:nth-child(even) { background: var(--slate-50); }
            tbody tr { page-break-inside: avoid; }

            .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
            .badge-critico { background: #fee2e2; color: #dc2626; }
            .badge-alto { background: #ffedd5; color: #ea580c; }
            .badge-medio { background: #fefce8; color: #ca8a04; }
            .badge-bajo { background: #dcfce7; color: #16a34a; }
            .badge-neutro { background: #eef2ff; color: #4f46e5; }

            .pie-reporte {
                margin-top: 28px;
                padding-top: 14px;
                border-top: 1px solid var(--slate-200);
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--slate-500);
            }

            .botones { margin-top: 28px; display: flex; gap: 12px; }
            .botones button {
                padding: 11px 22px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.15s ease;
            }
            .btn-print { background: var(--indigo); color: #fff; }
            .btn-print:hover { background: #4338ca; }

            @media print {
                body { padding: 0 28px; }
                .botones { display: none; }
                thead { display: table-header-group; }
            }
        </style>
        </head>
        <body>
            <div class="reporte-header">
                <div>
                    <div class="marca"><span class="icono">&#128737;</span> SecureCore</div>
                    <h1>${titulo}</h1>
                    <p>${subtitulo}</p>
                </div>
                <div class="meta-generacion">
                    <strong>${fecha}</strong>
                    Generado a las ${hora}
                </div>
            </div>

            ${stats.length ? `<div class="stats-row">${statsHtml}</div>` : ''}

            <table>
                <thead><tr>${columnasHtml}</tr></thead>
                <tbody>${filasHtml}</tbody>
            </table>

            <div class="pie-reporte">
                <span>SecureCore &middot; Plataforma de Gestión de Riesgos</span>
                <span>Documento de uso interno &mdash; confidencial</span>
            </div>

            <div class="botones">
                <button class="btn-print" onclick="window.print()">&#128424; Imprimir / Guardar como PDF</button>
            </div>
        </body>
        </html>
    `);
    ventana.document.close();
}

/* ==========================================================================
   EXPORTACIÓN A EXCEL CON PLANTILLA (encabezado de marca + tabla estilizada)
   Usa ExcelJS (soporta colores/fuentes/anchos), no la librería xlsx plana.
   ========================================================================= */

/**
 * Genera y descarga un .xlsx con encabezado de marca SecureCore, título del
 * reporte, tabla de encabezados resaltada y filas con bandas alternadas.
 * @param {Object} opciones
 * @param {string} opciones.nombreHoja - Nombre de la pestaña (máx. 31 caracteres).
 * @param {string} opciones.titulo - Título del reporte mostrado en el encabezado.
 * @param {string} opciones.subtitulo - Línea descriptiva bajo el título.
 * @param {string[]} opciones.columnas - Encabezados de columna.
 * @param {Array<Array<string|number>>} opciones.filas - Filas de datos, en el mismo orden que columnas.
 * @param {number[]} [opciones.anchos] - Ancho de cada columna (en caracteres aprox.).
 * @param {string} opciones.nombreArchivo - Nombre del archivo descargado (con .xlsx).
 */
async function descargarExcelElegante({ nombreHoja, titulo, subtitulo, columnas, filas, anchos, nombreArchivo }) {
    if (typeof ExcelJS === 'undefined') {
        alert('No se pudo cargar la librería de Excel. Verifica tu conexión a internet.');
        return;
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'SecureCore';
    libro.created = new Date();

    const hoja = libro.addWorksheet((nombreHoja || 'Reporte').slice(0, 31));
    const totalColumnas = columnas.length;

    hoja.mergeCells(1, 1, 1, totalColumnas);
    const celdaMarca = hoja.getCell(1, 1);
    celdaMarca.value = 'SecureCore · Plataforma de Gestión de Riesgos';
    celdaMarca.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    celdaMarca.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    celdaMarca.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    hoja.getRow(1).height = 26;

    hoja.mergeCells(2, 1, 2, totalColumnas);
    const celdaTitulo = hoja.getCell(2, 1);
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
    celdaTitulo.alignment = { indent: 1 };
    hoja.getRow(2).height = 22;

    const fecha = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });
    hoja.mergeCells(3, 1, 3, totalColumnas);
    const celdaSub = hoja.getCell(3, 1);
    celdaSub.value = `${subtitulo}  —  Generado el ${fecha}`;
    celdaSub.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    celdaSub.alignment = { indent: 1 };
    hoja.getRow(3).height = 18;

    hoja.addRow([]);

    const filaEncabezado = hoja.addRow(columnas);
    filaEncabezado.eachCell(celda => {
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        celda.alignment = { vertical: 'middle', wrapText: true };
    });
    filaEncabezado.height = 20;

    filas.forEach((fila, i) => {
        const row = hoja.addRow(fila);
        if (i % 2 === 1) {
            row.eachCell(celda => {
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
        }
        row.eachCell(celda => { celda.alignment = { vertical: 'top', wrapText: true }; });
    });

    hoja.columns.forEach((columna, i) => {
        columna.width = (anchos && anchos[i]) || 22;
    });

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlace.href);
}
