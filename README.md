## Organización del código

`index.js` registra la aplicación. `App.tsx` configura los proveedores globales y muestra la pantalla inicial.

| Carpeta           | Responsabilidad                                                                 |
| ----------------- | ------------------------------------------------------------------------------- |
| `src/components/` | Componentes reutilizables, como el futuro `TaskItem`.                           |
| `src/screens/`    | Pantallas. Actualmente contiene `WelcomeScreen`, la bienvenida del boilerplate. |
| `src/navigation/` | Configuración de React Navigation y sus stacks.                                 |
| `src/context/`    | Estado compartido mediante Context, como la autenticación.                      |
| `src/services/`   | Acceso a AsyncStorage y programación de notificaciones.                         |
| `src/utils/`      | Funciones auxiliares y validaciones.                                            |
| `src/types/`      | Tipos de TypeScript compartidos.                                                |
| `__tests__/`      | Tests automatizados.                                                            |

Las carpetas pendientes de implementar contienen un archivo `.gitkeep` para conservarlas en Git. Se reemplazará al agregar el primer archivo de código. La navegación, autenticación, tareas y notificaciones se implementarán en las próximas etapas.
