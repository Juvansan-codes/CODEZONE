importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodideReadyPromise;

async function loadPyodideAndPackages() {
    self.pyodide = await loadPyodide({
        stdout: (text) => {
            self.postMessage({ type: 'stdout', text });
        },
        stderr: (text) => {
            self.postMessage({ type: 'stderr', text });
        }
    });
    // Add any necessary packages here if needed later
}

pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async (event) => {
    const { id, python_code, input_data } = event.data;

    try {
        await pyodideReadyPromise;
        const pyodide = self.pyodide;

        // Ensure pyodide is initialized
        if (!pyodide) {
            throw new Error("Pyodide not loaded yet");
        }

        // Setup standard input piping via sys.stdin
        const setupCode = `
import sys
import io

# Setup custom stdin buffer
sys.stdin = io.StringIO("""${input_data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")}""")
`;
        await pyodide.runPythonAsync(setupCode);

        // Run user code
        await pyodide.runPythonAsync(python_code);

        // Notify completion
        self.postMessage({ type: 'done', id });

    } catch (error) {
        self.postMessage({ type: 'error', id, text: error.toString() });
    }
};
