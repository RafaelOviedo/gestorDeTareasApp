## Organización del código

`index.js` registra la aplicación. `App.tsx` configura los proveedores globales y muestra la pantalla inicial.

| Carpeta           | Responsabilidad                                            |
| ----------------- | ---------------------------------------------------------- |
| `src/components/` | Componentes reutilizables, como el futuro `TaskItem`.      |
| `src/screens/`    | Pantallas Login, Registro, Home y Crear tarea.             |
| `src/navigation/` | Configuración de React Navigation y sus stacks.            |
| `src/context/`    | Estado compartido mediante Context, como la autenticación. |
| `src/services/`   | Acceso a AsyncStorage y programación de notificaciones.    |
| `src/utils/`      | Funciones auxiliares y validaciones.                       |
| `src/types/`      | Tipos de TypeScript compartidos.                           |
| `__tests__/`      | Tests automatizados.                                       |

Las carpetas pendientes de implementar contienen un archivo `.gitkeep` para conservarlas en Git. Se reemplazará al agregar el primer archivo de código. La navegación y autenticación local ya están implementadas. La persistencia de tareas y las notificaciones se implementarán en las próximas etapas.

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

Se eliminó el acceso de demo. El guardado de tareas y los recordatorios siguen deshabilitados hasta los puntos 5 y 6. `TasksPreviewNotice` informa esa limitación dentro de las pantallas de tareas.

`Screen`, `FormField`, `FormMessage`, `AppButton` y `TasksPreviewNotice` son componentes reutilizables. Los colores y estilos compartidos están en `src/styles.ts`.

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

Los tests usan el navegador real y simulan AsyncStorage y las áreas seguras del dispositivo. Cubren registro/login, cierre de sesión, errores y reintentos, duplicados, validaciones y conservación de las cuentas al remontar App. El cierre y reapertura reales deben comprobarse en el dispositivo tras compilar. La lógica de tareas se agregará en el punto 5.
