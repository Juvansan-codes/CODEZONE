require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { default: PQueue } = require('p-queue');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Setup an in-memory priority queue to handle high concurrency 
// and prevent overloading the Piston API or local memory.
const queue = new PQueue({ concurrency: 5 }); // Process max 5 submissions at a time

// Piston API Details
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

/**
 * Normalizes newlines and trailing spaces for comparison
 */
function normalizeOutput(str) {
    if (typeof str !== 'string') return String(str).trim();
    return str.replace(/\r\n/g, '\n').trim();
}

const { spawn } = require('child_process');

/**
 * Code Execution Job using local Python
 */
async function processSubmission(code, testCases) {
    const runnerCode = `
import json
import sys
import time
import subprocess
import os
import tempfile

user_code = """${code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")}"""

# Write user code to a temporary file
with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
    f.write(user_code)
    temp_module = f.name

# Read test cases from stdin
raw_input = sys.stdin.read()
try:
    test_cases = json.loads(raw_input)
except:
    test_cases = []

results = []
all_passed = True

for i, tc in enumerate(test_cases):
    inp_val = str(tc.get("input", ""))
    expected_out = str(tc.get("output", "")).strip()
    
    start_time = time.time()
    
    try:
        # Run the script as a subprocess, passing input via stdin
        process = subprocess.run(
            [sys.executable, temp_module],
            input=inp_val,
            text=True,
            capture_output=True,
            timeout=3.0 # 3 second timeout for individual test case
        )
        exec_time = time.time() - start_time
        
        # Check for runtime errors
        if process.returncode != 0:
            error_msg = process.stderr.strip()
            if not error_msg:
                error_msg = f"Process exited with code {process.returncode}"
            
            all_passed = False
            results.append({
                "test_idx": i,
                "status": "Runtime Error",
                "error_message": error_msg
            })
            continue

        # Check outcome
        actual_out = process.stdout.strip()
        passed = actual_out == expected_out
        if not passed:
            all_passed = False
            
        results.append({
            "test_idx": i,
            "status": "Passed" if passed else "Failed",
            "expected_output": expected_out,
            "actual_output": actual_out,
            "time_ms": round(exec_time * 1000, 2)
        })

    except subprocess.TimeoutExpired:
        all_passed = False
        results.append({
            "test_idx": i,
            "status": "Time Limit Exceeded",
            "error_message": "Execution timed out (3.0s)"
        })
    except Exception as e:
        all_passed = False
        results.append({
            "test_idx": i,
            "status": "Runtime Error",
            "error_message": str(e)
        })

output_data = {
    "all_passed": all_passed,
    "results": results
}

print("===JSON_START===")
print(json.dumps(output_data))
print("===JSON_END===")

try:
    os.remove(temp_module)
except:
    pass
`;

    return new Promise((resolve) => {
        const pythonProcess = spawn('python', ['-c', runnerCode]);
        let stdoutData = '';
        let stderrData = '';

        // Timeout (15 seconds for the whole runner — individual tests have 3s each)
        const timeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            resolve({ error: 'Time Limit Exceeded (TLE). The overall execution took too long.' });
        }, 15000);

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pythonProcess.on('close', (exitCode) => {
            clearTimeout(timeout);
            const output = stdoutData + stderrData;
            const jsonMatch = output.match(/===JSON_START===([\s\S]*?)===JSON_END===/);

            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsed = JSON.parse(jsonMatch[1].trim());
                    resolve(parsed);
                } catch (e) {
                    resolve({ error: 'Failed to parse judge JSON output. Raw: ' + jsonMatch[1].substring(0, 300) });
                }
            } else {
                // Surface the real error so the frontend can display it
                const errorSnippet = output.substring(0, 500) || '(no output from runner)';
                resolve({ error: 'Runner error (exit ' + exitCode + '):\n' + errorSnippet });
            }
        });

        // Pass test cases via stdin
        pythonProcess.stdin.write(JSON.stringify(testCases));
        pythonProcess.stdin.end();
    });
}

// POST endpoint for submissions
app.post('/api/submit', async (req, res) => {
    const { code, testCases } = req.body;

    // Validation
    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'Code cannot be empty.' });
    }

    if (code.trim().length < 5) {
        return res.status(400).json({ error: 'Code is too short to be valid.' });
    }

    // Queue the submission
    try {
        const result = await queue.add(() => processSubmission(code, testCases || []));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Queue processing failed.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', queueSize: queue.size, pending: queue.pending });
});

app.listen(PORT, () => {
    console.log(`Judge Service running on port ${PORT}`);
});
