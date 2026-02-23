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
import traceback
import tempfile
import os

user_code = """${code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")}"""

# Write user code to a temporary module to allow proper importing
with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
    f.write(user_code)
    temp_module = f.name

module_dir = os.path.dirname(temp_module)
module_name = os.path.basename(temp_module)[:-3]

if module_dir not in sys.path:
    sys.path.insert(0, module_dir)

try:
    solution_module = __import__(module_name)
    solution = getattr(solution_module, 'solution')
except AttributeError:
    print("===JSON_START===")
    print(json.dumps({"error": "Function 'solution' not found in your code."}))
    print("===JSON_END===")
    os.remove(temp_module)
    sys.exit(0)
except Exception as e:
    print("===JSON_START===")
    print(json.dumps({"error": "Syntax or Runtime Error.\\n" + traceback.format_exc()}))
    print("===JSON_END===")
    os.remove(temp_module)
    sys.exit(0)

raw_input = sys.stdin.read()
try:
    test_cases = json.loads(raw_input)
except:
    test_cases = []

results = []
all_passed = True

for i, tc in enumerate(test_cases):
    inp_val = tc.get("input")
    expected_out = str(tc.get("output", "")).strip()
    
    try:
        # Try to parse input logically (e.g. lists, dicts, numbers)
        try:
            inp = eval(inp_val)
        except:
            inp = inp_val
            
        start_time = time.time()
        result_raw = solution(inp)
        exec_time = time.time() - start_time
        
        actual_out = str(result_raw).strip()
        
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

        // Timeout (3 seconds limit)
        const timeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            resolve({ error: 'Time Limit Exceeded (TLE).' });
        }, 3000);

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);
            const output = stdoutData + stderrData;
            const jsonMatch = output.match(/===JSON_START===([\\s\\S]*?)===JSON_END===/);

            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    resolve(parsed);
                } catch (e) {
                    resolve({ error: 'Failed to parse JSON output.' });
                }
            } else {
                resolve({ error: 'Execution Error. Raw Output:\\n' + output.substring(0, 500) });
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
