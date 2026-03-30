# Supabase Cloud - Gestión de Usuarios

Ejemplo con Supabase Cloud para registrar, autenticar y listar usuarios. Incluye una tabla `profiles` con RLS y trigger creados desde el Dashboard web de Supabase, más un mini cliente web con Vite.

## Requisitos

- Cuenta en [Supabase](https://supabase.com) (plan gratuito)
- Node.js 18+

## Estructura del proyecto

```
.
└── web/
    ├── .env                  # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
    ├── index.html
    └── src/
        ├── supabase.js       # Cliente Supabase
        ├── main.js           # App: signup, signin, listado
        └── style.css
```

## Inicio rápido

### 1. Crear un proyecto en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard) e inicia sesión.
2. Haz clic en **New Project**.
3. Elige una organización, nombre de proyecto y contraseña para la base de datos.
4. Selecciona la región más cercana y haz clic en **Create new project**.
5. Espera a que el proyecto se aprovisione (~2 minutos).

### 2. Crear la tabla `profiles` y configurar RLS

Abre el **SQL Editor** en el menú lateral del Dashboard y ejecuta el siguiente SQL:

```sql
-- Tabla profiles
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Políticas RLS
create policy "Authenticated users can read all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trigger: auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Haz clic en **Run**. Deberías ver `Success. No rows returned`.

### 3. Desactivar la confirmación de email (opcional, para desarrollo)

1. En el Dashboard, ve a **Authentication > Providers > Email**.
2. Desactiva **Confirm email** para que los usuarios queden activos al registrarse sin necesidad de verificar su correo.

### 4. Obtener las claves del proyecto

1. Ve a **Project Settings > API** (o haz clic en **Connect** en la barra superior).
2. Copia:
   - **Project URL** → `https://<tu-proyecto>.supabase.co`
   - **anon public key** → la clave pública anónima

### 5. Configurar variables de entorno

Edita el archivo `web/.env` con tus valores:

```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...tu-anon-key
```

### 6. Instalar dependencias del cliente web

```bash
cd web
npm install
```

### 7. Levantar el cliente web

```bash
cd web
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## Cómo usarlo

### Desde la app web (http://localhost:5173)

1. **Registrar usuario** - Rellena nombre, email y password (min. 6 caracteres) y haz clic en "Registrarse". La sesión se inicia automáticamente.
2. **Iniciar sesión** - Usa email y password de un usuario existente.
3. **Ver usuarios** - Una vez autenticado, se muestra la tabla con todos los perfiles registrados.
4. **Cerrar sesión** - Botón "Salir" en la barra de sesión.

### Desde el Dashboard de Supabase

- **Authentication > Users** - Crear, editar, eliminar y confirmar usuarios de Auth.
- **Table Editor > profiles** - Ver y editar las filas de la tabla `profiles` sincronizada con Auth.

## Base de datos

### Tabla `public.profiles`

| Columna    | Tipo        | Descripción |
|------------|-------------|-------------|
| id         | uuid (PK)   | Referencia a `auth.users`, cascade on delete |
| email      | text        | Email del usuario |
| full_name  | text        | Nombre completo (desde metadata del signup) |
| created_at | timestamptz | Fecha de creación |

### Políticas RLS (demo)

| Operación | Quién           | Condición |
|-----------|-----------------|-----------|
| SELECT    | authenticated   | Todos los perfiles visibles |
| INSERT    | authenticated   | Solo su propia fila (`id = auth.uid()`) |
| UPDATE    | authenticated   | Solo su propia fila (`id = auth.uid()`) |

> Estas políticas son permisivas a propósito para el ejemplo. En producción, restringir el SELECT y usar roles admin o `service_role`.

### Trigger

Cuando se registra un usuario en `auth.users`, la función `handle_new_user()` inserta automáticamente una fila en `profiles` con el `id`, `email` y `full_name` extraído de la metadata.

## Notas

- El proyecto usa Supabase Cloud. No requiere Docker ni Supabase CLI.
- Si desactivaste la confirmación de email, los usuarios quedan activos al registrarse.
- Para ver los emails de confirmación (si está activada), revisa la sección **Authentication > Users** en el Dashboard.
