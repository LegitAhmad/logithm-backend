import type { ExecutionContract, ValueType } from '../../question/execution-contract';

export interface ExecutionFile { name: string; content: string }
export interface WrappedProgram { files: ExecutionFile[]; stdin: string }
export const RETURN_TYPE_MARKER = 'LOGITHM_RETURN_TYPE:';

const pythonValueCheck = `
def logithm_check(value, schema, path):
    kind = schema['type']
    if kind == 'null': valid = value is None
    elif kind == 'boolean': valid = type(value) is bool
    elif kind == 'string': valid = type(value) is str
    elif kind in ('number', 'integer'):
        valid = type(value) in (int, float) and abs(value) <= 9007199254740991 and logithm_math.isfinite(value)
        if kind == 'integer': valid = valid and type(value) is int
    elif kind == 'array':
        valid = type(value) is list
        if valid:
            for index, item in enumerate(value): logithm_check(item, schema['items'], path + '[' + str(index) + ']')
    else:
        valid = type(value) is dict and set(value.keys()) == set(schema['properties'].keys())
        if valid:
            for key, item_type in schema['properties'].items(): logithm_check(value[key], item_type, path + '[' + repr(key) + ']')
    if not valid: raise TypeError(path + ': expected ' + kind)
`;

function pythonProgram(code: string, execution: ExecutionContract): string {
  return `import json as logithm_json, sys as logithm_sys, contextlib as logithm_context, math as logithm_math
${pythonValueCheck}
logithm_args = logithm_json.loads(logithm_sys.stdin.read())
logithm_namespace = {'__name__': '__student__'}
with logithm_context.redirect_stdout(logithm_sys.stderr):
    exec(${JSON.stringify(code)}, logithm_namespace)
    logithm_value = logithm_namespace[${JSON.stringify(execution.functionName)}](*logithm_args)
    try:
        logithm_check(logithm_value, logithm_json.loads(${JSON.stringify(JSON.stringify(execution.returnType))}), 'return')
    except TypeError as logithm_error:
        logithm_sys.stderr.write('${RETURN_TYPE_MARKER}' + str(logithm_error) + '\\n')
        logithm_sys.exit(2)
logithm_sys.stdout.write(logithm_json.dumps({'version': 1, 'value': logithm_value}, allow_nan=False, separators=(',', ':')))
`;
}

function javascriptProgram(code: string, execution: ExecutionContract): string {
  return `// @ts-nocheck
const logithm_fs = require('fs');
const logithm_args = JSON.parse(logithm_fs.readFileSync(0, 'utf8'));
const logithm_stdout = process.stdout.write.bind(process.stdout);
function logithm_check(value, schema, path) {
  const kind = schema.type;
  let valid = false;
  if (kind === 'null') valid = value === null;
  else if (kind === 'boolean' || kind === 'string') valid = typeof value === kind;
  else if (kind === 'number' || kind === 'integer') valid = typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && (kind !== 'integer' || Number.isSafeInteger(value));
  else if (kind === 'array') {
    valid = Array.isArray(value);
    if (valid) for (let index = 0; index < value.length; index++) logithm_check(value[index], schema.items, path + '[' + index + ']');
  } else {
    valid = value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === Object.keys(schema.properties).length && Object.keys(schema.properties).every(key => Object.prototype.hasOwnProperty.call(value, key));
    if (valid) for (const key of Object.keys(schema.properties)) logithm_check(value[key], schema.properties[key], path + '[' + JSON.stringify(key) + ']');
  }
  if (!valid) throw new TypeError(path + ': expected ' + kind);
}
(async () => {
  process.stdout.write = process.stderr.write.bind(process.stderr);
  try {
    const logithm_value = await (async () => {
${code}
return await ${execution.functionName}(...logithm_args);
    })();
    try { logithm_check(logithm_value, ${JSON.stringify(execution.returnType)}, 'return'); }
    catch (error) {
      process.stderr.write('${RETURN_TYPE_MARKER}' + error.message + '\\n');
      process.exitCode = 2;
      return;
    }
    logithm_stdout(JSON.stringify({version: 1, value: logithm_value}));
  } catch (error) {
    process.stderr.write(String(error && error.stack || error));
    process.exitCode = 1;
  }
})();
`;
}

/** Go object fields are F0, F1, ... in declaration order, with JSON tags. */
export function goType(schema: ValueType): string {
  switch (schema.type) {
    case 'string': return 'string';
    case 'number': return 'float64';
    case 'integer': return 'int64';
    case 'boolean': return 'bool';
    case 'null': return 'interface{}';
    case 'array': return `[]${goType(schema.items)}`;
    case 'object': return `struct { ${Object.entries(schema.properties).map(([key, type], index) => {
      // Go's encoding/json tags cannot represent commas or arbitrary punctuation.
      if (!/^[A-Za-z0-9_ -]+$/.test(key)) throw new Error(`Go adapter cannot represent object property ${JSON.stringify(key)}; use Python, JavaScript, or TypeScript`);
      return `F${index} ${goType(type)} ${JSON.stringify(`json:${JSON.stringify(key)}`)}`;
    }).join('; ')} }`;
  }
}

function goProgram(code: string, execution: ExecutionContract): string {
  const types = execution.parameters.map((parameter) => goType(parameter.type));
  goType(execution.returnType); // Fail before contacting the sandbox for unsupported object tags.
  const source = code.replace(/^[ \t]*package[ \t]+main[ \t]*;?[ \t]*\r?$/m, '');
  return `package main
import (
 logithmjson "encoding/json"
 logithmfmt "fmt"
 logithmos "os"
)
${source}
func main() {
 var logithmargs []logithmjson.RawMessage
 if err := logithmjson.NewDecoder(logithmos.Stdin).Decode(&logithmargs); err != nil { panic(err) }
 ${types.map((type, index) => `var logithma${index} ${type}\n if err := logithmjson.Unmarshal(logithmargs[${index}], &logithma${index}); err != nil { panic(err) }`).join('\n')}
 logithmout := logithmos.Stdout
 logithmos.Stdout = logithmos.Stderr
 logithmvalue := ${execution.functionName}(${types.map((_, index) => `logithma${index}`).join(', ')})
 logithmos.Stdout = logithmout
 logithmencoded, logithmerr := logithmjson.Marshal(struct { Version int \`json:"version"\`; Value interface{} \`json:"value"\` }{1, logithmvalue})
 if logithmerr != nil { logithmfmt.Fprintln(logithmos.Stderr, \"${RETURN_TYPE_MARKER}return: value cannot be represented as JSON\"); logithmos.Exit(2) }
 logithmfmt.Fprint(logithmout, string(logithmencoded))
}
`;
}

export function wrapProgram(language: string, code: string, execution: ExecutionContract, args: unknown[]): WrappedProgram {
  if (language === 'python') return { files: [{ name: 'main.py', content: pythonProgram(code, execution) }], stdin: JSON.stringify(args) };
  if (language === 'javascript' || language === 'typescript') return { files: [{ name: language === 'typescript' ? 'main.ts' : 'main.js', content: javascriptProgram(code, execution) }], stdin: JSON.stringify(args) };
  if (language === 'go') return { files: [{ name: 'main.go', content: goProgram(code, execution) }], stdin: JSON.stringify(args) };
  throw new Error(`No typed function adapter for ${language}`);
}

/** Teacher code gets only JSON values in a second sandbox, never student code. */
export function wrapCustomValidator(code: string, actual: unknown, expected: unknown, args: unknown[]): WrappedProgram {
  return {
    files: [{ name: 'validator.py', content: `import json as logithm_json, sys as logithm_sys, contextlib as logithm_context
logithm_payload = logithm_json.loads(logithm_sys.stdin.read())
logithm_namespace = {'__name__': '__validator__'}
with logithm_context.redirect_stdout(logithm_sys.stderr):
    exec(${JSON.stringify(code)}, logithm_namespace)
    logithm_result = logithm_namespace['validate'](logithm_payload['actual'], logithm_payload['expected'], logithm_payload['args'])
    if type(logithm_result) is not bool: raise TypeError('validate must return a strict bool')
logithm_sys.stdout.write(logithm_json.dumps({'version': 1, 'value': logithm_result}))
` }],
    stdin: JSON.stringify({ actual, expected, args }),
  };
}
