import { AppState, type AppStateStatus } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import DevicePermissions from '../src/components/DevicePermissions';
import {
  checkResourcePermission,
  requestResourcePermission,
  openDeviceSettings,
  type ResourcePermission,
} from '../src/services/devicePermissions';

jest.mock('../src/services/devicePermissions', () => ({
  ...jest.requireActual('../src/services/devicePermissions'),
  checkResourcePermission: jest.fn(),
  requestResourcePermission: jest.fn(),
  openDeviceSettings: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  jest.mocked(checkResourcePermission).mockResolvedValue('denied');
  jest.mocked(requestResourcePermission).mockResolvedValue('granted');
  jest.mocked(openDeviceSettings).mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

async function renderPanel() {
  const result = render(<DevicePermissions />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Actualizar permisos' }),
    ).toBeEnabled(),
  );
  return result;
}

test('consulta sin pedir permisos y solo solicita el recurso pulsado', async () => {
  await renderPanel();
  expect(requestResourcePermission).not.toHaveBeenCalled();
  expect(screen.getAllByText('Pendiente de autorización.')).toHaveLength(5);
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  await waitFor(() =>
    expect(screen.getByText('Acceso concedido.')).toBeVisible(),
  );
  expect(requestResourcePermission).toHaveBeenCalledTimes(1);
  expect(requestResourcePermission).toHaveBeenCalledWith('camera');
});

test('informa rechazo y permite reintentar sin bloquear las tareas', async () => {
  jest.mocked(requestResourcePermission).mockResolvedValueOnce('denied');
  await renderPanel();
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  await waitFor(() =>
    expect(
      screen.getByText(
        'Permiso rechazado. Podés seguir usando tus tareas sin este acceso.',
      ),
    ).toBeVisible(),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  await waitFor(() =>
    expect(screen.getByText('Acceso concedido.')).toBeVisible(),
  );
});

test('bloquea solicitudes simultáneas y evita dobles pulsaciones', async () => {
  let resolve!: (status: ResourcePermission) => void;
  jest.mocked(requestResourcePermission).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  await renderPanel();
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar contactos' }));
  expect(requestResourcePermission).toHaveBeenCalledTimes(1);
  await act(async () => resolve('granted'));
});

test('abre ajustes para bloqueados y actualiza al volver a la app', async () => {
  let listener!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      listener = callback;
      return { remove };
    });
  jest
    .mocked(checkResourcePermission)
    .mockImplementation(async resource =>
      resource === 'camera' ? 'blocked' : 'denied',
    );
  const result = await renderPanel();
  fireEvent.press(
    screen.getByRole('button', { name: 'Abrir ajustes de cámara' }),
  );
  await waitFor(() => expect(openDeviceSettings).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Actualizar permisos' }),
    ).toBeEnabled(),
  );
  jest.mocked(checkResourcePermission).mockResolvedValue('granted');
  await act(async () => listener('active'));
  expect(screen.getAllByText('Acceso concedido.')).toHaveLength(5);
  expect(requestResourcePermission).not.toHaveBeenCalled();
  result.unmount();
  expect(remove).toHaveBeenCalled();
});

test('no pierde un bloqueo conocido cuando Android responde denied al consultar', async () => {
  await renderPanel();
  jest.mocked(requestResourcePermission).mockResolvedValueOnce('blocked');
  fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Abrir ajustes de cámara' }),
    ).toBeEnabled(),
  );
  await act(async () =>
    fireEvent.press(
      screen.getByRole('button', { name: 'Actualizar permisos' }),
    ),
  );
  expect(
    screen.getByRole('button', { name: 'Abrir ajustes de cámara' }),
  ).toBeEnabled();
});

test('distingue acceso limitado, selector del sistema y recurso no disponible', async () => {
  jest
    .mocked(checkResourcePermission)
    .mockImplementation(async resource =>
      resource === 'gallery'
        ? 'system-picker'
        : resource === 'location'
        ? 'limited'
        : 'unavailable',
    );
  await renderPanel();
  expect(screen.getByText('Acceso a la ubicación aproximada.')).toBeVisible();
  expect(
    screen.getByText(
      'El selector del sistema permite elegir fotos sin autorizar toda la galería.',
    ),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Autorizar cámara' })).toBeNull();
});

test('recupera errores de consulta y de solicitud', async () => {
  jest
    .mocked(checkResourcePermission)
    .mockRejectedValueOnce(new Error('native'));
  await renderPanel();
  expect(
    screen.getByText('No se pudo consultar el permiso. Intentá nuevamente.'),
  ).toBeVisible();
  await act(async () =>
    fireEvent.press(
      screen.getByRole('button', { name: 'Actualizar permisos' }),
    ),
  );
  jest
    .mocked(requestResourcePermission)
    .mockRejectedValueOnce(new Error('native'));
  await act(async () =>
    fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' })),
  );
  expect(
    screen.getByText('No se pudo solicitar el permiso. Intentá nuevamente.'),
  ).toBeVisible();
  await act(async () =>
    fireEvent.press(screen.getByRole('button', { name: 'Autorizar cámara' })),
  );
  expect(screen.getByText('Acceso concedido.')).toBeVisible();
});

test('informa si no puede abrir ajustes', async () => {
  jest.mocked(checkResourcePermission).mockResolvedValue('blocked');
  jest.mocked(openDeviceSettings).mockRejectedValueOnce(new Error('native'));
  await renderPanel();
  await act(async () =>
    fireEvent.press(
      screen.getByRole('button', { name: 'Abrir ajustes de cámara' }),
    ),
  );
  expect(
    screen.getByText('No se pudieron abrir los ajustes. Intentá nuevamente.'),
  ).toBeVisible();
});
