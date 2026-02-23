import { useState, useEffect, useRef, useCallback } from 'react';

interface PyodideResult {
  output: string;
  error?: string;
  isTimeout?: boolean;
}

export function usePyodide() {
  const [isInitializing, setIsInitializing] = useState(true);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Determine base URL dynamically (for GitHub Pages compatibility)
    const basePath = import.meta.env.BASE_URL || '/';

    // Initialize the WebWorker
    const worker = new Worker(`${basePath}pyodideWorker.js`);
    workerRef.current = worker;

    // We can't strictly know when Pyodide finishes loading inside the worker just from instantiation,
    // but the worker script immediately starts downloading it. We'll set initializing to false after a slight delay
    // or we could add a specific message from the worker.

    const handleInitMessage = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        setIsInitializing(false);
      }
    }
    worker.addEventListener('message', handleInitMessage);

    // Fallback: assume it's loading in the background. It will queue commands if not ready.
    setTimeout(() => setIsInitializing(false), 2000);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runPython = useCallback(
    (code: string, inputData: string = '', timeoutMs: number = 5000): Promise<PyodideResult> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve({ output: '', error: 'Worker not initialized' });
          return;
        }

        const id = Math.random().toString(36).substring(7);
        let outputBuffer = '';
        let errorBuffer = '';

        const timeoutId = setTimeout(() => {
          // Terminate the worker if it takes too long (infinite loop)
          if (workerRef.current) {
            workerRef.current.terminate();

            // Re-initialize the worker for future runs
            const basePath = import.meta.env.BASE_URL || '/';
            workerRef.current = new Worker(`${basePath}pyodideWorker.js`);

            resolve({
              output: outputBuffer,
              error: 'Time Limit Exceeded (Infinite loop detected)',
              isTimeout: true,
            });
          }
        }, timeoutMs);

        const handleMessage = (e: MessageEvent) => {
          const { type, text, id: msgId } = e.data;

          if (type === 'stdout') {
            outputBuffer += text;
          } else if (type === 'stderr') {
            errorBuffer += text;
          } else if (type === 'error' && msgId === id) {
            clearTimeout(timeoutId);
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve({ output: outputBuffer, error: errorBuffer || text });
          } else if (type === 'done' && msgId === id) {
            clearTimeout(timeoutId);
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve({ output: outputBuffer, error: errorBuffer || undefined });
          }
        };

        workerRef.current.addEventListener('message', handleMessage);

        workerRef.current.postMessage({
          id,
          python_code: code,
          input_data: inputData,
        });
      });
    },
    []
  );

  return { runPython, isInitializing };
}
