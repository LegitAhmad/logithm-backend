const fs = require('fs');

function patch(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  const index = source.indexOf(before);
  if (index === -1 || source.indexOf(before, index + before.length) !== -1) {
    throw new Error(`Review upstream Piston integration before upgrading: ${file}`);
  }
  fs.writeFileSync(file, source.replace(before, after));
}

patch('/piston_api/src/index.js',
  'app.use(body_parser.json());',
  'app.use(body_parser.json({ limit: "6mb" }));');

// Destroying the stream immediately after end() discards queued input writes.
// A program exiting without reading stdin may legitimately close its pipe.
// Decode UTF-8 incrementally; Buffer-to-string conversion per chunk corrupts
// multibyte characters split across pipe reads.
patch('/piston_api/src/job.js',
  'proc.stdin.write(this.stdin);\n            proc.stdin.end();\n            proc.stdin.destroy();',
  `proc.stdout.setEncoding('utf8');
            proc.stderr.setEncoding('utf8');
            proc.stdin.on('error', error => {
                if (error.code !== 'EPIPE') throw error;
            });
            proc.stdin.end(this.stdin);`);

// Process exit can precede pipe EOF; do not return a partial typed envelope.
patch('/piston_api/src/job.js',
  "proc.on('exit', (_, signal) => {",
  "proc.on('close', (_, signal) => {");
