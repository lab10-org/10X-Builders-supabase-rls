# Supabase Local - Gestión de Usuarios

Ejemplo local de Supabase corriendo en Docker para registrar, autenticar y listar usuarios. Incluye una migración SQL con tabla `profiles`, RLS y trigger, más un mini cliente web con Vite.

## Requisitos

- [Docker Desktop](https://docs.docker.com/desktop/) instalado y en ejecución
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Node.js 18+

## Estructura del proyecto

```
.
├── supabase/
│   ├── config.toml                              # Configuración del stack local
│   └── migrations/
│       └── 20260329000000_create_profiles.sql   # Tabla profiles + RLS + trigger
└── web/
    ├── .env                                     # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
    ├── index.html
    └── src/
        ├── supabase.js                          # Cliente Supabase
        ├── main.js                              # App: signup, signin, listado
        └── style.css
```

## Inicio rápido

### 1. Levantar Supabase local

```bash
supabase start
```

La primera vez descarga las imágenes Docker (~5 min). Al terminar muestra las URLs y claves:

| Servicio | URL |
|----------|-----|
| API      | http://127.0.0.1:54321 |
| Studio   | http://127.0.0.1:54323 |
| Mailpit  | http://127.0.0.1:54324 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

Puedes consultarlas en cualquier momento con:

```bash
supabase status
```

### 2. Instalar dependencias del cliente web

```bash
cd web
npm install
```

### 3. Verificar variables de entorno

El archivo `web/.env` ya apunta al stack local por defecto:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Si tus puertos son distintos, actualiza la URL. Para obtener la `ANON_KEY` ejecuta:

```bash
supabase status -o env | grep ANON_KEY
```

### 4. Levantar el cliente web

```bash
cd web
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## Cómo usarlo

### Desde la app web (http://localhost:5173)

1. **Registrar usuario** - Rellena nombre, email y password (min. 6 caracteres) y haz clic en "Registrarse". La sesión se inicia automáticamente.
2. **Iniciar sesion** - Usa email y password de un usuario existente.
3. **Ver usuarios** - Una vez autenticado, se muestra la tabla con todos los perfiles registrados.
4. **Cerrar sesion** - Boton "Salir" en la barra de sesion.

### Desde Supabase Studio (http://127.0.0.1:54323)

- **Authentication > Users** - Crear, editar, eliminar y confirmar usuarios de Auth.
- **Table Editor > profiles** - Ver y editar las filas de la tabla `profiles` sincronizada con Auth.

## Base de datos

La migración `20260329000000_create_profiles.sql` crea:

### Tabla `public.profiles`

| Columna    | Tipo        | Descripcion |
|------------|-------------|-------------|
| id         | uuid (PK)   | Referencia a `auth.users`, cascade on delete |
| email      | text        | Email del usuario |
| full_name  | text        | Nombre completo (desde metadata del signup) |
| created_at | timestamptz | Fecha de creacion |

### Politicas RLS (demo local)

| Operacion | Quien           | Condicion |
|-----------|-----------------|-----------|
| SELECT    | authenticated   | Todos los perfiles visibles |
| INSERT    | authenticated   | Solo su propia fila (`id = auth.uid()`) |
| UPDATE    | authenticated   | Solo su propia fila (`id = auth.uid()`) |

> Estas politicas son permisivas a proposito para el ejemplo. En produccion, restringir el SELECT y usar roles admin o `service_role`.

### Trigger

Cuando se registra un usuario en `auth.users`, la funcion `handle_new_user()` inserta automaticamente una fila en `profiles` con el `id`, `email` y `full_name` extraido de la metadata.

## Comandos utiles

```bash
# Ver estado y claves del stack local
supabase status

# Reiniciar base de datos (borra datos, reaplicar migraciones)
supabase db reset

# Detener contenedores Docker
supabase stop

# Detener y borrar volumenes (datos locales)
supabase stop --no-backup
```

## Notas

- Todo corre en `127.0.0.1` (local). No se despliega a Supabase Cloud.
- La confirmacion de email esta desactivada (`enable_confirmations = false` en `config.toml`), asi que los usuarios quedan activos al registrarse.
- Mailpit (http://127.0.0.1:54324) captura los emails que Supabase enviaria en produccion.
