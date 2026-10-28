import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import type { PropsWithChildren } from 'react';
import type {
  PresentationSnapshot,
  PresentationSource,
} from './PresentationSource';

export type DemoScenario = 'examples' | 'empty' | 'loading';
const emptySnapshot: PresentationSnapshot = Object.freeze({
  maintenances: [],
  problems: [],
  team: [],
});
interface DemoContextValue {
  readonly data: PresentationSnapshot;
  readonly status: 'loading' | 'ready' | 'error';
  readonly scenario: DemoScenario;
  readonly setScenario: (scenario: DemoScenario) => void;
  readonly reload: () => void;
}
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({
  source,
  children,
}: PropsWithChildren<{ source: PresentationSource }>) {
  const [scenario, setScenario] = useState<DemoScenario>('examples');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    source: PresentationSource;
    attempt: number;
    data: PresentationSnapshot;
    status: 'ready' | 'error';
  } | null>(null);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => source.load())
      .then(
        (snapshot) => {
          if (active)
            setResult({ source, attempt, data: snapshot, status: 'ready' });
        },
        () => {
          if (active)
            setResult({
              source,
              attempt,
              data: emptySnapshot,
              status: 'error',
            });
        },
      );
    return () => {
      active = false;
    };
  }, [source, attempt]);
  const current =
    result?.source === source && result.attempt === attempt ? result : null;
  return (
    <DemoContext.Provider
      value={{
        data:
          scenario === 'empty'
            ? emptySnapshot
            : (current?.data ?? emptySnapshot),
        status:
          scenario === 'loading' ? 'loading' : (current?.status ?? 'loading'),
        scenario,
        setScenario,
        reload,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context)
    throw new Error('A fonte de apresentação deve ser fornecida na composição');
  return context;
}
