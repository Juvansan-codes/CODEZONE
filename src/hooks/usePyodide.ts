import { useState, useEffect, useCallback, useRef } from 'react';

interface PyodideInstance {
  runPython: (code: string) => any;
  runPythonAsync: (code: string) => Promise<any>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: any;
}

interface TestCase {
  input: string;
  expected: string;
  description?: string;
}

interface TestResult {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error?: string;
  executionTime: number;
}

interface ExecutionResult {
  output: string;
  error: string | null;
  executionTime: number;
  testResults?: TestResult[];
}

export const usePyodide = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pyodideRef = useRef<PyodideInstance | null>(null);

  // Load Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      try {
        setIsLoading(true);
        setLoadingProgress(10);

        // Load the Pyodide script
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide'));
          document.head.appendChild(script);
        });

        setLoadingProgress(40);

        // Initialize Pyodide
        const pyodide = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        });

        setLoadingProgress(80);

        // Set up stdout/stderr capture
        await pyodide.runPythonAsync(`
import sys
from io import StringIO

class CaptureOutput:
    def __init__(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        
    def capture(self):
        sys.stdout = self.stdout
        sys.stderr = self.stderr
        
    def release(self):
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__
        
    def get_output(self):
        return self.stdout.getvalue()
        
    def get_error(self):
        return self.stderr.getvalue()
        
    def clear(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        sys.stdout = self.stdout
        sys.stderr = self.stderr

_capture = CaptureOutput()
        `);

        setLoadingProgress(100);
        pyodideRef.current = pyodide;
        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load Pyodide:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Python');
        setIsLoading(false);
      }
    };

    loadPyodide();

    return () => {
      // Cleanup
      pyodideRef.current = null;
    };
  }, []);

  // Execute Python code
  const runCode = useCallback(async (code: string): Promise<ExecutionResult> => {
    if (!pyodideRef.current || !isReady) {
      return {
        output: '',
        error: 'Python environment not ready',
        executionTime: 0,
      };
    }

    const startTime = performance.now();

    try {
      // Capture output
      await pyodideRef.current.runPythonAsync(`
_capture.clear()
_capture.capture()
      `);

      // Run user code
      await pyodideRef.current.runPythonAsync(code);

      // Get output
      const output = await pyodideRef.current.runPythonAsync(`
_capture.release()
_capture.get_output()
      `);

      const errorOutput = await pyodideRef.current.runPythonAsync(`
_capture.get_error()
      `);

      const executionTime = performance.now() - startTime;

      return {
        output: output || '',
        error: errorOutput || null,
        executionTime,
      };
    } catch (err) {
      const executionTime = performance.now() - startTime;
      
      // Release capture on error
      try {
        await pyodideRef.current.runPythonAsync('_capture.release()');
      } catch {}

      return {
        output: '',
        error: err instanceof Error ? err.message : String(err),
        executionTime,
      };
    }
  }, [isReady]);

  // Run code with test cases
  const runWithTests = useCallback(async (
    code: string,
    testCases: TestCase[],
    functionName: string
  ): Promise<ExecutionResult> => {
    if (!pyodideRef.current || !isReady) {
      return {
        output: '',
        error: 'Python environment not ready',
        executionTime: 0,
        testResults: [],
      };
    }

    const startTime = performance.now();
    const testResults: TestResult[] = [];

    try {
      // First, define the user's function
      await pyodideRef.current.runPythonAsync(code);

      // Run each test case
      for (const testCase of testCases) {
        const testStart = performance.now();
        
        try {
          // Prepare input and call function
          const testCode = `
result = ${functionName}(${testCase.input})
str(result)
          `;

          const result = await pyodideRef.current.runPythonAsync(testCode);
          const actual = String(result);
          const expected = testCase.expected.trim();
          const passed = actual.trim() === expected;

          testResults.push({
            passed,
            input: testCase.input,
            expected,
            actual,
            executionTime: performance.now() - testStart,
          });
        } catch (err) {
          testResults.push({
            passed: false,
            input: testCase.input,
            expected: testCase.expected,
            actual: '',
            error: err instanceof Error ? err.message : String(err),
            executionTime: performance.now() - testStart,
          });
        }
      }

      const allPassed = testResults.every(r => r.passed);
      const passedCount = testResults.filter(r => r.passed).length;

      return {
        output: `${passedCount}/${testResults.length} tests passed`,
        error: allPassed ? null : 'Some tests failed',
        executionTime: performance.now() - startTime,
        testResults,
      };
    } catch (err) {
      return {
        output: '',
        error: err instanceof Error ? err.message : String(err),
        executionTime: performance.now() - startTime,
        testResults: [],
      };
    }
  }, [isReady]);

  // Reset the Python environment
  const reset = useCallback(async () => {
    if (!pyodideRef.current) return;

    try {
      await pyodideRef.current.runPythonAsync(`
# Clear user-defined variables
for name in list(globals().keys()):
    if not name.startswith('_') and name not in ['sys', 'StringIO', 'CaptureOutput']:
        del globals()[name]
      `);
    } catch (err) {
      console.error('Failed to reset Python environment:', err);
    }
  }, []);

  return {
    isLoading,
    isReady,
    loadingProgress,
    error,
    runCode,
    runWithTests,
    reset,
  };
};
