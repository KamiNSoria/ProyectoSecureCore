# SecureCore

Plataforma web de gestión de riesgos de seguridad de la información (SGSI), inspirada en la metodología **MAGERIT** y el estándar **ISO/IEC 27001:2022 / 27002:2022**, con mapeo a normativa ecuatoriana (LOPDP, Ley de Comercio Electrónico).

Permite administrar el ciclo completo: **Activos → Análisis de Riesgos → Tratamiento (controles y plan) → Cumplimiento → Comunicación/Observaciones**.

## Arquitectura

El proyecto está dividido en dos partes que corren por separado:

| Parte | Descripción | Ubicación |
|---|---|---|
| **Frontend** | HTML + CSS + JavaScript vanilla (sin framework ni build step) | este repositorio |
| **Backend** | API REST en Django + Django REST Framework, sobre SQL Server | repositorio `SEGURIDAD37` (carpeta `api/` y `core/`) |

El frontend consume la API vía `fetch` contra `http://127.0.0.1:8000/api` (constante `API_BASE` definida en cada archivo `js/*.js`).

## Estructura del repositorio

```
ProyectoSecureCore/
├── index.html                  # Dashboard principal
├── pages/                      # Vistas de cada módulo
│   ├── login.html
│   ├── registro.html
│   ├── activos.html
│   ├── analisis.html           # Análisis de riesgos
│   ├── tratamiento.html        # Biblioteca de controles + Plan de tratamiento
│   ├── cumplimiento.html       # Dashboard de madurez y mapeo normativo
│   └── comunicacion.html       # Observaciones
├── js/                         # Lógica de cada vista + helpers (session.js, dashboard.js, reportes.js)
├── css/                        # Estilos por módulo + global.css / theme.css (modo oscuro)
├── seed_controles_transferencia.sql   # Datos semilla para controles de transferencia (ISO 5.19–5.23)
└── APISecureCore/               # (placeholder, sin uso actual)
```

## Módulos funcionales

- **Autenticación**: registro y login contra `auth_user` de Django (token vía DRF `TokenAuthentication`).
- **Activos**: inventario de activos con clasificación CID (Confidencialidad, Integridad, Disponibilidad) y cálculo automático de criticidad.
- **Análisis de Riesgos**: creación de riesgos vinculados a un activo, con amenaza/vulnerabilidad (catálogo o texto libre) y cálculo de score inherente (`probabilidad × impacto`).
- **Tratamiento**: biblioteca de controles (catálogo ISO 27002) y plan de tratamiento por riesgo (estrategias Mitigar / Transferir / Aceptar / Evitar), con cálculo de score y nivel residual.
- **Cumplimiento**: dashboard de solo lectura con nivel de madurez, gap analysis por dominio ISO y mapeo a marcos legales (LOPDP, Código de Ética, ISO 27001, Ley de Comercio Electrónico).
- **Comunicación**: registro de observaciones libres asociadas a un módulo (activos, riesgos, tratamiento, riesgo residual, monitoreo, general).

## Requisitos

- Navegador moderno (no requiere Node ni build tools para el frontend).
- Para el backend: Python 3.11+, SQL Server con el driver ODBC 17, y el repositorio `SEGURIDAD37` clonado aparte.

## Puesta en marcha

### 1. Backend (API)

```bash
cd SEGURIDAD37
python -m venv venv
venv\Scripts\activate          # Windows
pip install django djangorestframework django-cors-headers mssql-django
python manage.py migrate
python manage.py createsuperuser   # opcional, para tener un usuario con id=1
python manage.py runserver
```

La API queda disponible en `http://127.0.0.1:8000/api/`. La base de datos configurada por defecto es `SecureCoreDB` en SQL Server local con autenticación de Windows (`Trusted_Connection`) — ajusta `core/settings.py` según tu entorno.

### 2. Frontend

No requiere instalación. Basta con servir la carpeta como sitio estático, por ejemplo:

```bash
cd ProyectoSecureCore
npx serve .
# o simplemente abrir index.html con la extensión Live Server de VS Code
```

> Abrir `index.html` con doble clic (`file://`) puede causar problemas de CORS al llamar a la API; se recomienda usar un servidor local.

### 3. Flujo de prueba recomendado

1. Registrarse desde `pages/registro.html`.
2. Iniciar sesión en `pages/login.html`.
3. Crear un **Activo** en `pages/activos.html`.
4. Crear un **Riesgo** en `pages/analisis.html`, vinculado al activo anterior.
5. Registrar un **Control** en la pestaña "Controles" de `pages/tratamiento.html`.
6. Crear el **Plan de Tratamiento** en la misma página, vinculando el riesgo y el control creados.
7. Revisar el estado en `pages/cumplimiento.html` y registrar una **Observación** en `pages/comunicacion.html`.

## Notas técnicas

- Los IDs de propietario/responsable (`id_propietario`, `id_responsable`) se envían actualmente fijos como `1` desde el frontend, a la espera de integrar el usuario autenticado real vía `session.js`.
- El modo oscuro se persiste en `localStorage` (`securecore_theme`) y se aplica antes del render para evitar parpadeos (flash of unstyled theme).
- No hay un modelo de "Plan de Tratamiento" independiente: la pestaña "Plan" de `tratamiento.html` opera sobre la misma tabla que la biblioteca de tratamientos por riesgo.
