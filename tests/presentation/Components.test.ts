import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  EmptyState,
  ActionButton,
  DataBoundary,
  DemoNotice,
} from '../../src/presentation/components/UI';
import {
  StatusBadge,
  statusLabels,
} from '../../src/presentation/components/StatusBadge';
import { TeamCard } from '../../src/presentation/components/PreviewCards';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const { demo } = vi.hoisted(() => ({
  demo: { status: 'ready' as 'ready' | 'loading' | 'error', reload: vi.fn() },
}));
vi.mock('../../src/presentation/demo/DemoProvider', () => ({
  useDemo: () => demo,
}));

describe('shared native presentation rendered through React Native Web', () => {
  it('makes the demonstration and absence of persistence visible', () => {
    const markup = renderToStaticMarkup(createElement(DemoNotice));
    expect(markup).toContain('Demonstração');
    expect(markup).toContain('Nenhuma alteração é salva');
  });
  it('renders an accessible empty state without inventing data', () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        title: 'Nenhuma manutenção',
        description: 'Sem dados para exibir.',
      }),
    );
    expect(markup).toContain('Nenhuma manutenção');
    expect(markup).toContain('Sem dados para exibir.');
    expect(markup).toContain('role="heading"');
  });
  it.each(Object.entries(statusLabels))(
    'renders a textual status for %s, independent of color',
    (status, label) => {
      const markup = renderToStaticMarkup(
        createElement(StatusBadge, {
          status: status as keyof typeof statusLabels,
        }),
      );
      expect(markup).toContain(label);
    },
  );
  it('renders a labeled button with the correct accessibility role', () => {
    const markup = renderToStaticMarkup(
      createElement(ActionButton, {
        label: 'Ver manutenções',
        onPress: vi.fn(),
      }),
    );
    expect(markup).toContain('role="button"');
    expect(markup).toContain('Ver manutenções');
  });
  it('renders only public fields even if an object has additional private properties', () => {
    const item = {
      id: 'demo-person',
      name: 'Pessoa de exemplo',
      role: 'member' as const,
      phone: 'PRIVATE-1234',
      performance: 'PRIVATE-PERFORMANCE',
    };
    const markup = renderToStaticMarkup(createElement(TeamCard, { item }));
    expect(markup).toContain('Pessoa de exemplo');
    expect(markup).toContain('Membro');
    expect(markup).not.toContain('PRIVATE');
  });
  it('shows loading without rendering stale content', () => {
    demo.status = 'loading';
    const markup = renderToStaticMarkup(
      createElement(DataBoundary, null, 'STALE-DATA'),
    );
    expect(markup).toContain('Carregando');
    expect(markup).toContain('role="progressbar"');
    expect(markup).not.toContain('STALE-DATA');
    demo.status = 'ready';
  });
  it('shows an explicit failure and retry instead of fictitious success', () => {
    demo.status = 'error';
    const markup = renderToStaticMarkup(
      createElement(DataBoundary, null, 'STALE-DATA'),
    );
    expect(markup).toContain('Não foi possível carregar');
    expect(markup).toContain('Tentar novamente');
    expect(markup).not.toContain('STALE-DATA');
    demo.status = 'ready';
  });
});
