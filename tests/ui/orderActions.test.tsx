import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import { OrderActions } from '../../src/components/OrderActions';
import { MOCK_ACTORS, createMockRepository } from '../../src/services/orders/orderRepository';
import type { Order } from '../../src/types/domain';

// Cada test recibe su propio repositorio con datos de ejemplo limpios.
function setup() {
  const { repo } = createMockRepository();
  const get = (id: string): Order => {
    const box: { order: Order | null } = { order: null };
    repo.subscribe(id, (o) => { box.order = o; }, () => {})();
    if (!box.order) throw new Error(`No existe el pedido ${id}`);
    return box.order;
  };
  return { repo, get };
}

const startMinutes = () => screen.getByLabelText(/Tiempo estimado de preparación en minutos/);

describe('OrderActions: iniciar preparación (restaurante)', () => {
  it('pide la estimación al iniciar la preparación', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1024')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    expect(startMinutes()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar preparación' })).toBeTruthy();
  });

  it('sin minutos muestra el mensaje y no cambia el estado', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1024')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar preparación' }));
    expect(screen.getByText(/Indica el tiempo estimado/)).toBeTruthy();
    expect(get('UC1024').status).toBe('received');
  });

  it.each(['0', '181', '2.5', 'abc'])('rechaza "%s" minutos', async (value) => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1024')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    await fireEvent.changeText(startMinutes(), value);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar preparación' }));
    expect(screen.getByText(/Indica el tiempo estimado/)).toBeTruthy();
    expect(get('UC1024').status).toBe('received');
  });

  it('con minutos válidos pasa a en preparación con su estimación', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1024')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    await fireEvent.changeText(startMinutes(), '20');
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar preparación' }));

    await waitFor(() => expect(get('UC1024').status).toBe('preparing'));
    expect(get('UC1024').estimateMinutes).toBe(20);
  });
});

describe('OrderActions: actualizar la estimación', () => {
  it('el restaurante actualiza los minutos de un pedido en preparación', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1028')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    await fireEvent.changeText(screen.getByLabelText(/Nueva estimación de preparación/), '30');
    await fireEvent.press(screen.getByRole('button', { name: 'Actualizar estimación' }));

    await waitFor(() => expect(get('UC1028').estimateMinutes).toBe(30));
    expect(get('UC1028').status).toBe('preparing');
  });

  it('rechaza una estimación fuera de rango', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1028')} actor={MOCK_ACTORS.restaurant} repository={repo} />);
    await fireEvent.changeText(screen.getByLabelText(/Nueva estimación de preparación/), '181');
    await fireEvent.press(screen.getByRole('button', { name: 'Actualizar estimación' }));
    expect(screen.getByText(/Indica el nuevo tiempo estimado/)).toBeTruthy();
    expect(get('UC1028').estimateMinutes).toBe(20);
  });
});

describe('OrderActions: según el rol', () => {
  it('el estudiante no ve la estimación ni "Iniciar preparación", pero sí puede cancelar', async () => {
    const { repo, get } = setup();
    await render(<OrderActions order={get('UC1024')} actor={MOCK_ACTORS.student} repository={repo} />);
    expect(screen.queryByRole('button', { name: 'Iniciar preparación' })).toBeNull();
    expect(screen.queryByLabelText(/Tiempo estimado de preparación/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeTruthy();
  });
});