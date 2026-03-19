import { useState, useCallback } from 'react';

let id = 0;

export function useToast() {
  const [list, setList] = useState([]);

  const add = useCallback((msg, type) => {
    const tid = ++id;
    setList(p => [...p, { id: tid, msg, type }]);
    setTimeout(() => setList(p => p.filter(t => t.id !== tid)), 3500);
  }, []);

  return {
    toasts:  list,
    success: useCallback(m => add(m, 'ok'),  [add]),
    error:   useCallback(m => add(m, 'err'), [add]),
  };
}

export function Toasts({ list }) {
  if (!list.length) return null;
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={'toast toast-' + t.type}>
          {t.type === 'ok' ? '✓' : '✗'} {t.msg}
        </div>
      ))}
    </div>
  );
}
