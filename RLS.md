# Row Level Security (RLS) en Supabase — Guia paso a paso

## Que es RLS

Row Level Security es una funcionalidad de PostgreSQL que restringe **fila por fila** quien puede leer, insertar, actualizar o eliminar datos. Supabase la utiliza como capa de seguridad principal: sin politicas RLS activas, ninguna fila es accesible a traves de la API publica.

> **Regla de oro**: cuando RLS esta habilitado en una tabla y no existen politicas, **todo queda bloqueado por defecto**. Solo las politicas que crees determinan que puede hacer cada usuario.

---

## Conceptos clave

| Concepto | Descripcion |
|----------|-------------|
| `ENABLE ROW LEVEL SECURITY` | Activa RLS en la tabla. Sin esto, las filas son visibles para todos. |
| **Policy** | Regla que define quien puede ejecutar una operacion (SELECT, INSERT, UPDATE, DELETE) y sobre cuales filas. |
| `USING (...)` | Condicion que filtra las filas **existentes** (se aplica en SELECT, UPDATE y DELETE). |
| `WITH CHECK (...)` | Condicion que valida las filas **nuevas o modificadas** (se aplica en INSERT y UPDATE). |
| `auth.uid()` | Funcion de Supabase que devuelve el `id` (uuid) del usuario autenticado en la peticion actual. |
| `TO <rol>` | A que rol de Postgres aplica la politica (ej. `authenticated`, `anon`). |

### Cuando se usa USING y cuando WITH CHECK

| Operacion | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | Si — filtra que filas puedes ver | No aplica |
| INSERT | No aplica | Si — valida la fila nueva |
| UPDATE | Si — filtra que filas puedes modificar | Si — valida la fila despues del cambio |
| DELETE | Si — filtra que filas puedes borrar | No aplica |

---

## Las 3 politicas que ya tiene el proyecto

La tabla `profiles` ya fue creada con RLS habilitado y 3 politicas desde el SQL Editor del Dashboard. Revisemos cada una.

### La tabla

```sql
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
```

La columna `id` es una referencia directa a `auth.users`. Esto permite relacionar cada fila con el usuario que la posee. Al habilitar RLS, la tabla queda **completamente cerrada** hasta que se definan politicas.

---

### Politica 1 — SELECT (lectura)

```sql
create policy "Authenticated users can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (true);
```

**Que hace**: cualquier usuario con sesion activa puede ver **todos** los perfiles.

| Parte | Significado |
|-------|-------------|
| `for select` | Solo aplica a consultas de lectura. |
| `to authenticated` | Solo usuarios con sesion activa. Un visitante anonimo (`anon`) no puede leer nada. |
| `using (true)` | La condicion siempre es verdadera → puede ver **todas** las filas de la tabla. |

**En la app**: cuando un usuario inicia sesion y ve la tabla de "Usuarios registrados", esta politica es la que permite que el `SELECT` funcione.

---

### Politica 2 — INSERT (insercion)

```sql
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());
```

**Que hace**: un usuario autenticado solo puede insertar una fila donde el `id` sea su propio uuid.

| Parte | Significado |
|-------|-------------|
| `for insert` | Solo aplica a inserciones. |
| `with check (id = auth.uid())` | La fila nueva debe tener un `id` igual al uuid del usuario actual. Nadie puede crear filas a nombre de otro. |

**En la app**: el trigger `handle_new_user()` usa el rol `security definer` (superusuario) para insertar la fila, asi que esta politica no lo afecta directamente. Pero si alguien intenta un INSERT manual desde la API, la politica lo restringe a su propia fila.

> INSERT solo usa `WITH CHECK` (no `USING`) porque no hay filas existentes que filtrar — solo se valida la fila nueva.

---

### Politica 3 — UPDATE (actualizacion)

```sql
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
```

**Que hace**: un usuario autenticado solo puede modificar **su propia fila**.

| Parte | Significado |
|-------|-------------|
| `using (id = auth.uid())` | Filtra las filas existentes: solo puede seleccionar para modificar la fila cuyo `id` coincide con su uuid. |
| `with check (id = auth.uid())` | Valida que despues de la modificacion, el `id` siga siendo el suyo. Evita que cambie el `id` a otro usuario. |

**En la app**: si se implementara un formulario de "Editar perfil", esta politica garantiza que el usuario A no pueda cambiar el nombre del usuario B.

> UPDATE necesita **ambas** condiciones: `USING` para elegir que filas se pueden tocar, y `WITH CHECK` para validar el resultado.

---

### Que falta

La tabla tiene politicas para SELECT, INSERT y UPDATE, pero **no tiene politica para DELETE**. Eso significa que actualmente **ningun usuario puede eliminar filas** a traves de la API, incluso estando autenticado. RLS bloquea la operacion porque no existe una politica que la permita.

Vamos a agregar esa cuarta politica como ejercicio.

---

## Ejercicio: agregar la politica DELETE paso a paso

### Paso 1 — Entender que queremos

Queremos que cada usuario pueda eliminar **unicamente su propio perfil**. No debe poder borrar el de nadie mas.

La regla es simple: solo puedes borrar la fila donde `id = auth.uid()`.

### Paso 2 — Escribir la politica

```sql
create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (id = auth.uid());
```

Desglose:

| Parte | Que significa |
|-------|---------------|
| `"Users can delete their own profile"` | Nombre descriptivo de la politica. |
| `on public.profiles` | Se aplica a la tabla `profiles`. |
| `for delete` | Solo afecta operaciones de eliminacion. |
| `to authenticated` | Solo usuarios con sesion activa. |
| `using (id = auth.uid())` | Solo puede borrar la fila cuyo `id` coincide con su uuid. |

> DELETE solo usa `USING` (no `WITH CHECK`) porque no hay fila "nueva" que validar — solo se necesita saber cuales filas existentes se pueden borrar.

### Paso 3 — Aplicar la politica

Ejecutar directamente en el Dashboard de Supabase:

1. Abre tu proyecto en [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Ve a **SQL Editor** en el menu lateral.
3. Pega la sentencia SQL:

```sql
create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (id = auth.uid());
```

4. Haz clic en **Run**.
5. Deberia aparecer `Success. No rows returned` — eso esta bien, la politica se creo correctamente.

### Paso 4 — Verificar que la politica se creo

Ejecuta esta consulta en el SQL Editor del Dashboard para listar todas las politicas de la tabla:

```sql
select policyname, cmd, roles
from pg_policies
where tablename = 'profiles';
```

Resultado esperado:

| policyname | cmd | roles |
|------------|-----|-------|
| Authenticated users can read all profiles | SELECT | {authenticated} |
| Users can insert their own profile | INSERT | {authenticated} |
| Users can update their own profile | UPDATE | {authenticated} |
| Users can delete their own profile | DELETE | {authenticated} |

Ahora hay **4 politicas**: una por cada operacion CRUD.

### Paso 5 — Probar que funciona

#### Preparacion

1. Registra dos usuarios desde la app web (http://localhost:5173 o tu URL de deploy): **usuario A** y **usuario B**.
2. Inicia sesion como **usuario A**.
3. Abre la **consola del navegador** (F12 > Console).

Para acceder al cliente de Supabase desde la consola, primero importalo:

```javascript
const { supabase } = await import('/src/supabase.js')
```

#### Prueba 1 — Intentar borrar el perfil de otro usuario (debe fallar)

Primero obtengamos los perfiles para ver los IDs:

```javascript
const { data } = await supabase.from('profiles').select('id, email')
console.table(data)
```

Copia el `id` del **usuario B** y ejecuta:

```javascript
const { data, error } = await supabase
  .from('profiles')
  .delete()
  .eq('id', '<pega-aqui-el-id-del-usuario-b>')
  .select()

console.log('Filas eliminadas:', data)
console.log('Error:', error)
```

**Resultado esperado**: `Filas eliminadas: []` (array vacio). RLS filtro la fila porque su `id` no coincide con `auth.uid()`. No hay error explicito — simplemente no encuentra filas que pueda borrar.

#### Prueba 2 — Borrar el propio perfil (debe funcionar)

```javascript
const { data: session } = await supabase.auth.getSession()
const myId = session.session.user.id

const { data, error } = await supabase
  .from('profiles')
  .delete()
  .eq('id', myId)
  .select()

console.log('Filas eliminadas:', data)
console.log('Error:', error)
```

**Resultado esperado**: `Filas eliminadas: [{id: '...', email: '...', ...}]` — la fila propia se elimino correctamente. `Error: null`.

#### Prueba 3 — Verificar que desaparecio

Recarga la pagina. La tabla de usuarios registrados deberia mostrar solo al **usuario B**.

---

## Resumen visual: como decide RLS

```
Peticion API (con JWT del usuario)
        │
        ▼
┌─────────────────────┐
│  RLS habilitado?     │──── No ───▶ Acceso total (peligroso)
└─────────────────────┘
        │ Si
        ▼
┌─────────────────────┐
│  Existe politica     │──── No ───▶ Acceso denegado (0 filas)
│  para la operacion?  │
└─────────────────────┘
        │ Si
        ▼
┌─────────────────────┐
│  USING / WITH CHECK  │──── No cumple ───▶ Fila excluida o error
│  se cumplen?         │
└─────────────────────┘
        │ Si
        ▼
   Operacion exitosa
```

---

## Errores comunes

| Error | Causa | Solucion |
|-------|-------|----------|
| `0 filas` sin error | No hay politica para la operacion, o la condicion `USING` excluye las filas. | Revisar politicas con `select * from pg_policies where tablename = 'profiles'`. |
| `new row violates row-level security policy` | INSERT o UPDATE no cumple el `WITH CHECK`. | Verificar que la fila nueva cumple la condicion (ej. que el `id` sea `auth.uid()`). |
| Las politicas no aplican en el Dashboard | El Dashboard usa el rol `postgres` (superusuario), que bypasea RLS. | Probar desde la API o usar `set role authenticated` en SQL Editor. |
| `service_role` ignora RLS | Comportamiento esperado; ese rol es para operaciones del servidor. | Nunca exponer la clave `service_role` en el cliente. |

---

## Buenas practicas

1. **Siempre habilita RLS** en tablas expuestas a la API publica.
2. **Principio de minimo privilegio**: empieza sin politicas y agrega solo las necesarias.
3. **Nombra las politicas de forma descriptiva** para facilitar auditorias.
4. **No uses `using (true)` en SELECT para datos sensibles** — restringe a `id = auth.uid()` si cada usuario solo debe ver sus propios datos.
5. **Testa con roles reales** (`set role authenticated` / `set role anon`) en el SQL Editor antes de desplegar.
6. **Separa politicas por operacion** (SELECT, INSERT, UPDATE, DELETE) en vez de una sola politica generica.
