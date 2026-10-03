## Organización del código

`index.js` registra la aplicación. `App.tsx` configura los proveedores globales y muestra la pantalla inicial.

| Carpeta           | Responsabilidad                                            |
| ----------------- | ---------------------------------------------------------- |
| `src/components/` | Componentes reutilizables, incluyendo `TaskItem`.          |
| `src/screens/`    | Pantallas Login, Registro, Home y Crear tarea.             |
| `src/navigation/` | Configuración de React Navigation y sus stacks.            |
| `src/context/`    | Estado compartido mediante Context, como la autenticación. |
| `src/services/`   | Acceso a AsyncStorage y programación de notificaciones.    |
| `src/utils/`      | Funciones auxiliares y validaciones.                       |
| `src/types/`      | Tipos de TypeScript compartidos.                           |
| `__tests__/`      | Tests automatizados.                                       |

Las carpetas pendientes de implementar contienen un archivo `.gitkeep` para conservarlas en Git. Se reemplazará al agregar el primer archivo de código. La navegación, la autenticación local y la persistencia de tareas ya están implementadas. Las notificaciones corresponden al punto 6.

## Navegación y autenticación (puntos 3 y 4)

Se usa React Navigation 7 con Native Stack. `AuthProvider` mantiene la sesión en memoria; las pantallas privadas solo existen cuando `user` tiene una identidad validada.

- Login → Registro → guardar cuenta → Login con el usuario completado.
- Login con credenciales correctas → Home → Crear tarea → cancelar o usar Atrás.
- **Cerrar sesión** desmonta Home/Crear tarea y vuelve a Login sin historial privado.
- Al cerrar completamente y volver a abrir la app, se solicita iniciar sesión nuevamente. Las cuentas siguen guardadas.

Las cuentas se guardan en AsyncStorage bajo `@gestorDeTareas/users:v1`. Se permiten varios usuarios. Los nombres se comparan ignorando mayúsculas y espacios al inicio/final; las contraseñas se comparan exactamente. No se permiten campos vacíos ni usuarios duplicados. Los errores de lectura/escritura se muestran en el formulario y no se borran cuentas si los datos guardados están dañados.

El almacenamiento de contraseñas en texto plano es parte de la autenticación local educativa permitida por la consigna. La sesión y los parámetros de navegación no incluyen contraseñas. No se guarda una sesión persistente ni se utiliza un backend.

- `src/services/auth.ts`: registro, validación de credenciales almacenadas y acceso a AsyncStorage.
- `src/context/AuthContext.tsx`: usuario activo, inicio y cierre de sesión.
- `src/utils/validations.ts`: validaciones de campos y normalización del usuario.
- `src/types/user.ts`: cuenta almacenada e identidad de sesión.

Se eliminó el acceso de demo. Las tareas ya se guardan por usuario. `ReminderNotice` aclara que las fechas de recordatorio se guardan, pero aún no se envían notificaciones.

`Screen`, `FormField`, `FormMessage`, `AppButton`, `TaskItem` y `ReminderNotice` son componentes reutilizables. Los colores y estilos compartidos están en `src/styles.ts`.

## Tareas persistentes (punto 5)

- **Crear tarea** valida un título de 1 a 120 caracteres después de quitar espacios exteriores. Guardar vuelve a Home y actualiza la lista.
- Cada tarea guarda `id`, `userId`, `title`, `completed`, `createdAt`, `reminderAt` y `notificationId` (por ahora `null`). Los recordatorios opcionales de 30 segundos, 1 minuto o 5 minutos se convierten a una fecha ISO al guardar. No se programan avisos todavía.
- `src/services/tasks.ts` guarda una lista por usuario en `@gestorDeTareas/tasks:v1:<userId>`. La sesión aporta el usuario; el formulario no permite elegir otro propietario.
- Home usa `FlatList` y recarga las tareas al recibir foco. También permite actualizar deslizando hacia abajo.
- **Marcar como completada** guarda el estado y muestra el título tachado. **Marcar como pendiente** permite reabrirla. Home cuenta pendientes y completadas por separado; las tareas anteriores sin estado se consideran pendientes. Las completadas siguen visibles y se pueden eliminar.
- Eliminar pide confirmación y modifica la lista solo después de guardar correctamente. Las cuentas y las tareas de otros usuarios se conservan.
- Los errores de lectura se distinguen de una lista vacía. Ante fallos de escritura se conservan el formulario o la tarea, con posibilidad de reintentar. Los datos corruptos no se reemplazan automáticamente.
- Las escrituras se procesan en orden por usuario para evitar que operaciones simultáneas sobrescriban tareas.

### Comprobación manual después de compilar

1. Registrar dos usuarios e iniciar sesión con el primero.
2. Guardar tareas con y sin recordatorio; cancelar otro formulario.
3. Completar una tarea y comprobar el contador. Cerrar completamente la app, volver a abrirla e iniciar sesión: las tareas y sus estados deben seguir ahí. Volver a marcar la tarea como pendiente.
4. Iniciar sesión con el segundo usuario: su lista debe estar separada.
5. Volver al primero, cancelar una eliminación y luego confirmar otra. Reabrir la app para comprobar que la tarea eliminada no reaparece.

### Ejecutar y verificar

Usar los comandos sin `sudo`:

```sh
npm start
# En otra terminal, con el simulador de iPhone abierto:
npm run ios

# Tests de autenticación, validaciones, navegación y componentes:
npm test
```

Después de instalar dependencias nativas en un clon nuevo:

```sh
npm ci
bundle install
cd ios
bundle exec pod install
cd ..
```

Los tests usan el navegador real y simulan AsyncStorage y las áreas seguras del dispositivo. Cubren registro/login, cierre de sesión, errores y reintentos, duplicados, validaciones y conservación de las cuentas al remontar App. El cierre y reapertura reales deben comprobarse en el dispositivo tras compilar. También cubren TaskItem, validaciones, creación, eliminación, separación por usuario, operaciones simultáneas y conservación de tareas al remontar App. La persistencia real al cerrar el proceso se verifica con el recorrido manual anterior.
