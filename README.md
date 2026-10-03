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

Las carpetas pendientes de implementar contienen un archivo `.gitkeep` para conservarlas en Git. Se reemplazará al agregar el primer archivo de código. La navegación ya está implementada. La autenticación, persistencia y notificaciones se implementarán en las próximas etapas.

## Navegación (punto 3)

Se usa React Navigation 7 con Native Stack y rutas tipadas en `src/types/navigation.ts`.

- Login → Registro → volver a Login.
- Login → **Explorar demo** → Home → Crear tarea → cancelar o usar Atrás.
- **Salir de la demo** elimina el grupo de pantallas Home/Crear tarea y vuelve a Login.

El modo demo es temporal y no representa autenticación. Los formularios conservan datos solamente mientras están montados; iniciar sesión, crear cuentas y guardar tareas están deshabilitados. Elegir un recordatorio no programa una notificación. En el punto 4, AuthContext reemplazará el acceso de demo.

`Screen`, `FormField`, `AppButton` y `DemoNotice` son componentes reutilizables. Los colores y estilos compartidos están en `src/styles.ts`.

### Ejecutar y verificar

Usar los comandos sin `sudo`:

```sh
npm start
# En otra terminal, con el simulador de iPhone abierto:
npm run ios

# Tests de navegación y del botón reutilizable:
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

Los tests usan el navegador real y simulan el contexto de áreas seguras del dispositivo. La validación de credenciales y la lógica de tareas se agregarán junto con sus funcionalidades.
